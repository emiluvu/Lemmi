#include <M5Unified.h>
#include <WiFi.h>
#include <esp_http_client.h>
#include <esp_crt_bundle.h>
#include <esp_transport_ssl.h>
#include <esp_transport_ws.h>
#include <esp_log.h>
#include <esp_system.h>
#include <sys/time.h>
#include <atomic>
#include "Protocol.h"
#include "ProtocolCheck.h"
#ifdef LEMMI_VOICE
#ifndef LEMMI_VOICE_VERSION
#define LEMMI_VOICE_VERSION "lemmi-voice/0.9"
#endif
#include "../audio/VoiceBridge.h"
#include "../audio/WsFrameReader.h"
#include "../audio/WsFrameWriter.h"
#include "../audio/BoundedWrite.h"
#include "../audio/WsFrameBatch.h"
#include <esp_tls_errors.h>
#include "../motion/BodyHardware.h"
#include <mbedtls/base64.h>
#include <esp_wifi.h>
#include <lwip/sockets.h>
#include <lwip/tcp.h>
#endif

namespace {
#ifdef LEMMI_VOICE
VoiceBridge voice;
BodyHardware voiceBody;
bool voiceLights=false;
StatusLights::Color voiceColor=StatusLights::Color::Off;
std::atomic<uint32_t> voiceWorkerMin{0},voiceMaxSendMs{0};
std::atomic<uint32_t> voiceCaptureSent{0};
uint8_t voiceSendFailure=0;
lemmi::WriteResult voiceWriteResult={lemmi::WriteResult::Complete,0,0};
lemmi::WsFrameBatch voiceBatch;
struct VoiceBatchToken {uint32_t epoch,input;bool capture;};
VoiceBatchToken voiceBatchTokens[4]={};
bool voiceBatching=false;
unsigned voiceBatchCapture=0;
#endif
constexpr const char* Host = "lemmi.chaoswarrior.dev";
struct Provision { char ssid[33], password[64], access[257], pairing[101], code[25]; bool wifiOnly; } cfg = {};
struct Command { uint32_t epoch; uint64_t generation; char session[101]; uint8_t kind; bool muted; };
enum : uint8_t { Start, Pause, Resume, Mute, Help, Handoff, Speak };
QueueHandle_t commands;
TaskHandle_t task;
std::atomic<bool> busy{false}, configured{false}, paired{false}, latch{true}, micMuted{true}, stopRequested{false}, abortConnect{false};
std::atomic<uint32_t> controlEpoch{0};
std::atomic<uint16_t> wifiDisconnectReason{0};
portMUX_TYPE uiLock = portMUX_INITIALIZER_UNLOCKED;
ControlPolicy view;
char statusText[27] = "Provision via USB";
std::atomic<bool> dirty{true};
bool protocolOK = false;
char credential[101] = {};
time_t credentialExpiry = 0;
uint64_t outgoing = 0;
esp_transport_handle_t ws = nullptr, tls = nullptr;

void wipe(void* p, size_t n) { volatile uint8_t* b=static_cast<volatile uint8_t*>(p); while(n--) *b++=0; }
void eraseJSON(cJSON* p) {
  if (!p) return;
  for (cJSON* child=p->child; child; child=child->next) eraseJSON(child);
  if (cJSON_IsString(p) && p->valuestring) wipe(p->valuestring,strlen(p->valuestring));
}
void discardJSON(cJSON* p) { eraseJSON(p); cJSON_Delete(p); }
void publish(const ControlPolicy& state, const char* status) {
  portENTER_CRITICAL(&uiLock);
  bool changed=view.serverMuted!=state.serverMuted || view.audioSupported!=state.audioSupported || strcmp(view.language,state.language)!=0 || strcmp(view.phase,state.phase)!=0 || view.ownsEndpoint!=state.ownsEndpoint || view.handoffSupported!=state.handoffSupported;
  view=state;
  if (status) { char next[sizeof(statusText)]; snprintf(next,sizeof(next),"%s",status); changed=changed || strcmp(statusText,next)!=0; strcpy(statusText,next); }
  portEXIT_CRITICAL(&uiLock); if (changed) dirty.store(true);
}
void fixedEvent(const char* name) {
#ifdef LEMMI_VOICE
  // Provisioning handshake stays compatible; it only runs offline, audio off.
  if(!strcmp(name,"provision_ready")||!strcmp(name,"provisioned")||!strcmp(name,"provision_invalid")||!strcmp(name,"provision_busy"))
    Serial.printf("event=control_%s capture=off camera=off\n",name);
  else Serial.printf("event=voice_control_%s camera=off\n",name);
#else
  Serial.printf("event=control_%s capture=off camera=off\n",name);
#endif
}
bool headerValue(const cJSON* p, size_t min, size_t max) {
  if (!protocol::string(p,max) || strlen(p->valuestring)<min) return false;
  for (const char* s=p->valuestring; *s; ++s) if (*s<33 || *s>126) return false;
  return true;
}
void provision(char* input, size_t n) {
  if (!protocolOK || busy.load()) { fixedEvent("provision_busy"); return; }
  cJSON* p=protocol::parse(input,n);
  const char* allowed[]={"ssid","password","accessKey","pairingId","code","utcEpoch"};
  const char* wifiKeys[]={"ssid","password","wifiOnly","utcEpoch"};
  const char* credentialKeys[]={"ssid","password","accessKey","credential","expiresAt","utcEpoch"};
  bool wifiOnly=cJSON_IsTrue(protocol::field(p,"wifiOnly"));
  bool direct=protocol::field(p,"credential")!=nullptr;
  bool shape=wifiOnly ? !direct && protocol::keys(p,wifiKeys,4) && cJSON_GetArraySize(p)==4 : direct ? protocol::keys(p,credentialKeys,6) && cJSON_GetArraySize(p)==6 : protocol::keys(p,allowed,6) && cJSON_GetArraySize(p)==6;
  bool wifiFields=protocol::string(protocol::field(p,"ssid"),32) && protocol::string(protocol::field(p,"password"),63,false);
  auto expires=protocol::field(p,"expiresAt");
  time_t directExpiry=direct?protocol::expiry(expires):0;
  auto clock=protocol::field(p,"utcEpoch");
  bool directValid=headerValue(protocol::field(p,"credential"),40,100) && (cJSON_IsNull(expires) || (directExpiry>0 && protocol::number(clock) && double(directExpiry)>clock->valuedouble));
  bool pairingFields=wifiOnly || (headerValue(protocol::field(p,"accessKey"),32,256) && (direct?directValid:protocol::string(protocol::field(p,"pairingId"),100) && headerValue(protocol::field(p,"code"),24,24)));
  if (!shape || !wifiFields || !pairingFields || !protocol::number(protocol::field(p,"utcEpoch")) || protocol::field(p,"utcEpoch")->valuedouble<1735689600 || protocol::field(p,"utcEpoch")->valuedouble>2051222400) {
    discardJSON(p); fixedEvent("provision_invalid"); return;
  }
  wipe(&cfg,sizeof(cfg)); wipe(credential,sizeof(credential)); credentialExpiry=0; paired.store(false);
  cfg.wifiOnly=wifiOnly;
  strcpy(cfg.ssid,protocol::field(p,"ssid")->valuestring); strcpy(cfg.password,protocol::field(p,"password")->valuestring);
  if (!wifiOnly) {
    strcpy(cfg.access,protocol::field(p,"accessKey")->valuestring);
    if (direct) { strcpy(credential,protocol::field(p,"credential")->valuestring); credentialExpiry=directExpiry; paired.store(true); }
    else { strcpy(cfg.pairing,protocol::field(p,"pairingId")->valuestring); strcpy(cfg.code,protocol::field(p,"code")->valuestring); }
  }
  timeval t={time_t(protocol::field(p,"utcEpoch")->valuedouble),0}; settimeofday(&t,nullptr);
  discardJSON(p); configured.store(true); fixedEvent("provisioned"); publish(view,wifiOnly?"Confirm Wi-Fi test locally":direct?"Confirm Connect locally":"Confirm pairing locally");
}

bool claim() {
  cJSON* request=cJSON_CreateObject();
  cJSON_AddStringToObject(request,"pairingId",cfg.pairing); cJSON_AddStringToObject(request,"code",cfg.code); cJSON_AddBoolToObject(request,"localConfirmed",true);
  char* body=cJSON_PrintUnformatted(request); discardJSON(request);
  // A claim is single-use. Ambiguous failure requires new provisioning/pairing.
  wipe(cfg.code,sizeof(cfg.code)); wipe(cfg.pairing,sizeof(cfg.pairing)); configured.store(false);
  if (!body) { fixedEvent("claim_build_failed"); return false; }
  esp_http_client_config_t c={}; c.url="https://lemmi.chaoswarrior.dev/v1/device-pairings/claim";
  c.method=HTTP_METHOD_POST; c.timeout_ms=3000; c.disable_auto_redirect=true; c.crt_bundle_attach=esp_crt_bundle_attach;
  c.buffer_size=1024; c.buffer_size_tx=1024;
  auto http=esp_http_client_init(&c); bool ok=false; char response[4097]={};
  const char* stage="init"; int error=0, status=0, received=0, socketError=0; int64_t length=-1;
  if (http) {
    do {
      stage="headers";
      error=esp_http_client_set_header(http,"Content-Type","application/json"); if (error!=ESP_OK) break;
      error=esp_http_client_set_header(http,"X-Lemmi-Access-Key",cfg.access); if (error!=ESP_OK) break;
      stage="open"; error=esp_http_client_open(http,strlen(body)); if (error!=ESP_OK) break;
      stage="write"; received=esp_http_client_write(http,body,strlen(body)); if (received!=int(strlen(body))) break;
      stage="status"; received=0; length=esp_http_client_fetch_headers(http); status=esp_http_client_get_status_code(http);
      if (status!=200) break;
      stage="size"; if (length<0 || length>4096) break;
      stage="read"; received=esp_http_client_read_response(http,response,4096);
      if (received>0 && esp_http_client_is_complete_data_received(http)) {
          stage="shape";
          cJSON* root=protocol::parse(response,received); auto data=protocol::field(root,"data");
          if (protocol::unique(root) && cJSON_IsTrue(protocol::field(root,"ok")) && protocol::unique(data) && protocol::equal(protocol::field(data,"deviceId"),"stackchan-alex") && protocol::equal(protocol::field(data,"profileId"),"profile-alex") && headerValue(protocol::field(data,"credential"),40,100)) {
            stage="expiry"; time_t end=protocol::expiry(protocol::field(data,"expiresAt"));
            if (cJSON_IsNull(protocol::field(data,"expiresAt")) || (end>time(nullptr) && end<=time(nullptr)+3600)) { strcpy(credential,protocol::field(data,"credential")->valuestring); credentialExpiry=end; paired.store(true); ok=true; }
          }
          discardJSON(root);
      }
    } while (false);
    socketError=esp_http_client_get_errno(http);
    esp_http_client_cleanup(http);
  }
  // Fixed vocabulary and numbers only. Never emit headers, bodies or credentials.
  Serial.printf("event=control_claim_result stage=%s http=%d error=%d errno=%d length=%lld received=%d capture=off camera=off\n",ok?"ok":stage,status,error,socketError,(long long)length,received);
  wipe(response,sizeof(response)); wipe(body,strlen(body)); cJSON_free(body); return ok;
}

#ifdef LEMMI_VOICE
void resetTransportProbe(){
#ifdef LEMMI_VOICE_DIAGNOSTICS
  transportProbe=lemmi::TransportProbe{};
#endif
}
int voiceTransportWrite(const char* p,size_t n,uint32_t ms){
#ifdef LEMMI_VOICE_DIAGNOSTICS
  transportProbeTask.store(xTaskGetCurrentTaskHandle());
#endif
  int result=esp_transport_write(tls,p,n,ms);
#ifdef LEMMI_VOICE_DIAGNOSTICS
  transportProbeTask.store(nullptr);
#endif
  return result;
}
void reportTransportProbe(){
#ifdef LEMMI_VOICE_DIAGNOSTICS
  Serial.printf("event=voice_transport_probe polls=%u poll_zero=%u poll_error=%u poll_max_us=%u writes=%u write_zero=%u write_want=%u write_error=%u write_max_us=%u camera=off\n",
    unsigned(transportProbe.polls),unsigned(transportProbe.pollZero),unsigned(transportProbe.pollError),unsigned(transportProbe.pollMaxUs),
    unsigned(transportProbe.writes),unsigned(transportProbe.writeZero),unsigned(transportProbe.writeWant),unsigned(transportProbe.writeError),unsigned(transportProbe.writeMaxUs));
#endif
}
int writeVoiceFrame(uint8_t opcode,const char* payload,size_t bytes,int timeout,const VoiceBridge::Outbound* scope=nullptr){
  static lemmi::WsFrameWriter frame; // only network worker accesses this buffer
  uint8_t mask[4];esp_fill_random(mask,sizeof(mask));
  if(!frame.prepare(opcode,payload,bytes,mask)){wipe(mask,sizeof(mask));return -1;}
  wipe(mask,sizeof(mask));
  if(voiceBatching&&scope){
    size_t index=voiceBatch.count();
    bool ok=voiceBatch.append(frame);frame.clear();
    if(!ok)return -1;
    voiceBatchTokens[index]={scope->localEpoch,scope->inputEpoch,scope->kind!=VoiceBridge::Receipt};
    return int(bytes);
  }
  resetTransportProbe();
  voiceWriteResult=lemmi::boundedWrite(frame.data(),frame.size(),uint32_t(timeout),
    ESP_TLS_ERR_SSL_WANT_READ,ESP_TLS_ERR_SSL_WANT_WRITE,
    [](const char* p,size_t n,uint32_t ms){return voiceTransportWrite(p,n,ms);},
    [scope]{return !abortConnect.load()&&(!scope||(!latch.load()&&scope->localEpoch==controlEpoch.load()&&
      (scope->kind==VoiceBridge::Receipt||(!micMuted.load()&&scope->inputEpoch==voice.inputEpoch.load()))));},
    []{return millis();},[]{vTaskDelay(pdMS_TO_TICKS(2));});
  bool ok=voiceWriteResult.status==lemmi::WriteResult::Complete;frame.clear();
  return ok?int(bytes):-1;
}
bool flushVoiceBatch(){
  if(!voiceBatch.size())return true;
  resetTransportProbe();
  voiceWriteResult=lemmi::boundedWrite(voiceBatch.data(),voiceBatch.size(),100,
    ESP_TLS_ERR_SSL_WANT_READ,ESP_TLS_ERR_SSL_WANT_WRITE,
    [](const char* p,size_t n,uint32_t ms){return voiceTransportWrite(p,n,ms);},
    []{
      if(abortConnect.load()||latch.load())return false;
      for(size_t i=0;i<voiceBatch.count();++i){
        const auto& token=voiceBatchTokens[i];
        if(token.epoch!=controlEpoch.load()||
           (token.capture&&(micMuted.load()||token.input!=voice.inputEpoch.load())))return false;
      }
      return true;
    },[]{return millis();},[]{vTaskDelay(pdMS_TO_TICKS(2));});
  bool complete=voiceWriteResult.status==lemmi::WriteResult::Complete;
  if(complete)voiceCaptureSent.fetch_add(voiceBatchCapture);
  bool safelyCancelled=voiceWriteResult.status==lemmi::WriteResult::Cancelled&&!voiceWriteResult.sent;
  voiceBatch.clear();wipe(voiceBatchTokens,sizeof(voiceBatchTokens));voiceBatchCapture=0;
  if(!complete&&!safelyCancelled)voiceSendFailure=6;
  return complete||safelyCancelled;
}
#endif
bool send(ControlPolicy& state, const char* type, bool muted=false, bool initial=false, char* sentId=nullptr) {
  cJSON* root=cJSON_CreateObject(); char id[37]; uint8_t bytes[16]; esp_fill_random(bytes,sizeof(bytes));
  snprintf(id,sizeof(id),"%08lx-%08lx-%08lx-%08lx",(unsigned long)(uint32_t(bytes[0])<<24|uint32_t(bytes[1])<<16|uint32_t(bytes[2])<<8|bytes[3]),(unsigned long)esp_random(),(unsigned long)esp_random(),(unsigned long)esp_random());
  if (sentId) strcpy(sentId,id);
  cJSON_AddNumberToObject(root,"protocol_version",1); cJSON_AddStringToObject(root,"event_id",id);
  if (initial || !state.session[0]) cJSON_AddNullToObject(root,"session_id"); else cJSON_AddStringToObject(root,"session_id",state.session);
  cJSON_AddNullToObject(root,"turn_id"); cJSON_AddNumberToObject(root,"generation",initial?0:double(state.generation)); cJSON_AddNumberToObject(root,"sequence",double(outgoing++)); cJSON_AddStringToObject(root,"type",type);
  auto p=cJSON_AddObjectToObject(root,"payload");
  if (!strcmp(type,"device.hello")) {
#ifdef LEMMI_VOICE
    cJSON_AddStringToObject(p,"firmwareVersion",LEMMI_VOICE_VERSION);cJSON_AddStringToObject(p,"endpoint","robot");
    cJSON_AddBoolToObject(p,"cameraSupported",false);cJSON_AddBoolToObject(p,"pettingSupported",false);
    auto a=cJSON_AddObjectToObject(p,"audio");cJSON_AddStringToObject(a,"encoding","pcm_s16le");
    cJSON_AddNumberToObject(a,"sampleRate",16000);cJSON_AddNumberToObject(a,"channels",1);cJSON_AddNumberToObject(a,"frameMs",20);
    auto playback=cJSON_AddObjectToObject(p,"playback");cJSON_AddStringToObject(playback,"encoding","pcm_s16le");
    cJSON_AddNumberToObject(playback,"channels",1);cJSON_AddNumberToObject(playback,"outputWindowChunks",12);
    auto rates=cJSON_AddArrayToObject(playback,"sampleRates");
    for(int rate:{16000,22050,24000,44100,48000})cJSON_AddItemToArray(rates,cJSON_CreateNumber(rate));
#else
    cJSON_AddStringToObject(p,"firmwareVersion","lemmi-control/0.9"); cJSON_AddStringToObject(p,"endpoint","robot"); cJSON_AddBoolToObject(p,"cameraSupported",false); cJSON_AddBoolToObject(p,"pettingSupported",false);
    auto a=cJSON_AddObjectToObject(p,"audio"); cJSON_AddBoolToObject(a,"supported",false);
#endif
  } else if(!strcmp(type,"input.speak")) {
    cJSON_AddStringToObject(p,"language",state.language);
  } else if (!strcmp(type,"input.mute")) cJSON_AddBoolToObject(p,"muted",muted);
  char* json=cJSON_PrintUnformatted(root); cJSON_Delete(root);
#ifdef LEMMI_VOICE
  bool ok=json&&strlen(json)<=4096&&writeVoiceFrame(1,json,strlen(json),100)==int(strlen(json));
#else
  bool ok=json && strlen(json)<=4096 && esp_transport_ws_send_raw(ws,ws_transport_opcodes_t(WS_TRANSPORT_OPCODES_TEXT|WS_TRANSPORT_OPCODES_FIN),json,strlen(json),250)==int(strlen(json));
#endif
  if (json) { wipe(json,strlen(json)); cJSON_free(json); } return ok;
}
#ifdef LEMMI_VOICE
bool sendVoice(ControlPolicy& s,VoiceBridge::Outbound& o) {
  voiceSendFailure=0;voiceWriteResult={lemmi::WriteResult::Complete,0,0};
  bool current=s.ordinary()&&o.localEpoch==controlEpoch.load()&&!latch.load()&&
    !strcmp(o.session,s.session)&&o.generation==s.generation&&!strcmp(o.lease,s.lease)&&
    o.profileRevision==s.profileRevision&&o.privacyRevision==s.privacyRevision&&o.policyRevision==s.policyRevision;
  if(o.kind!=VoiceBridge::Receipt)current=current&&!micMuted.load()&&!s.serverMuted&&s.hasGrant&&
    o.inputEpoch==voice.inputEpoch.load()&&!strcmp(o.turn,s.grantTurn)&&!strcmp(o.stream,s.grantStream)&&s.grantExpires>time(nullptr);
  if(!current)return true; // stale work is discarded, never replayed
  if(o.kind!=VoiceBridge::Receipt&&uint32_t(millis()-o.queuedAt)>=VoiceBridge::CaptureQueueMs){voiceSendFailure=2;voice.fail(VoiceBridge::OutgoingFull);return false;}
  cJSON* root=cJSON_CreateObject();char id[37];snprintf(id,sizeof(id),"voice-%08lx-%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());
  cJSON_AddNumberToObject(root,"protocol_version",1);cJSON_AddStringToObject(root,"event_id",id);
  cJSON_AddStringToObject(root,"session_id",o.session);cJSON_AddStringToObject(root,"turn_id",o.turn);
  cJSON_AddNumberToObject(root,"generation",double(o.generation));cJSON_AddNumberToObject(root,"sequence",double(outgoing++));
  cJSON_AddStringToObject(root,"type",o.kind==VoiceBridge::InputChunk?"audio.chunk":o.kind==VoiceBridge::InputEnd?"audio.end":"audio.receipt");
  auto p=cJSON_AddObjectToObject(root,"payload");cJSON_AddStringToObject(p,"leaseId",o.lease);cJSON_AddStringToObject(p,"streamId",o.stream);
  if(o.kind==VoiceBridge::InputChunk) {
    unsigned char encoded[857]={};size_t size=0;
    if(mbedtls_base64_encode(encoded,sizeof(encoded),&size,o.pcm,sizeof(o.pcm))!=0||size!=856){voiceSendFailure=3;discardJSON(root);return false;}
    cJSON_AddStringToObject(p,"encoding","pcm_s16le");cJSON_AddNumberToObject(p,"chunkIndex",o.count);
    cJSON_AddStringToObject(p,"data",reinterpret_cast<char*>(encoded));wipe(encoded,sizeof(encoded));
  } else if(o.kind==VoiceBridge::InputEnd)cJSON_AddNumberToObject(p,"chunkCount",o.count);
  else {cJSON_AddStringToObject(p,"status",o.status);cJSON_AddNumberToObject(p,"playedChunks",o.count);}
  char* json=cJSON_PrintUnformatted(root);discardJSON(root);
  bool stillCurrent=o.localEpoch==controlEpoch.load()&&!latch.load()&&
    (o.kind==VoiceBridge::Receipt||(o.inputEpoch==voice.inputEpoch.load()&&!micMuted.load()));
  // A local cancellation before writing is a stale frame, not a transport
  // failure. Keep the connection to deliver its Stop/mute command.
  bool ok=!stillCurrent;
  if(stillCurrent){
    if(!json){voiceSendFailure=4;ok=false;}
    else{
      ok=writeVoiceFrame(1,json,strlen(json),100,&o)==int(strlen(json));
      if(!ok&&voiceWriteResult.status==lemmi::WriteResult::Cancelled&&voiceWriteResult.sent==0)ok=true;
      else if(!ok)voiceSendFailure=6;
      if(ok&&voiceWriteResult.status==lemmi::WriteResult::Complete&&o.kind==VoiceBridge::InputChunk){
        if(voiceBatching)++voiceBatchCapture;else voiceCaptureSent.fetch_add(1);
      }
    }
  }
  if(json){wipe(json,strlen(json));cJSON_free(json);}return ok;
}
#endif
void cleanup() {
  if (ws) { esp_transport_close(ws); esp_transport_destroy(ws); ws=nullptr; }
  if (tls) { esp_transport_destroy(tls); tls=nullptr; }
  WiFi.disconnect(false,false); WiFi.mode(WIFI_OFF);
}
void worker(void*) {
  for (;;) {
    ulTaskNotifyTake(pdTRUE,portMAX_DELAY);
    ControlPolicy state; const char* result="Connection failed";
    const char* event="connect_failed";
    const char* exitStage="wifi";
    int ioResult=0, upgrade=0, lastOpcode=256;
    uint32_t connectionAt=millis();
    outgoing=0;
#ifdef LEMMI_VOICE
    voiceMaxSendMs.store(0);voiceCaptureSent.store(0);
    voiceBatch.clear();voiceBatchCapture=0;voiceBatching=false;
#endif
    do {
      wifiDisconnectReason.store(0);
      publish(state,"Connecting Wi-Fi");
      WiFi.persistent(false); WiFi.setAutoReconnect(false); WiFi.mode(WIFI_STA); WiFi.begin(cfg.ssid,cfg.password);
      uint32_t started=millis();
      while (WiFi.status()!=WL_CONNECTED && !abortConnect.load() && uint32_t(millis()-started)<15000) vTaskDelay(pdMS_TO_TICKS(20));
      if (WiFi.status()!=WL_CONNECTED || abortConnect.load()) {
        if (!abortConnect.load()) {
          result="Wi-Fi association failed";
          Serial.printf("event=control_wifi_failure status=%u reason=%u capture=off camera=off\n",unsigned(WiFi.status()),unsigned(wifiDisconnectReason.load()));
        }
        break;
      }
      if (cfg.wifiOnly) { result="Wi-Fi association passed"; event="wifi_ready"; exitStage="wifi_test"; break; }
#ifdef LEMMI_VOICE
      wifi_ps_type_t powerSave=WIFI_PS_MIN_MODEM;
      if(esp_wifi_set_ps(WIFI_PS_NONE)!=ESP_OK||esp_wifi_get_ps(&powerSave)!=ESP_OK||powerSave!=WIFI_PS_NONE){result="Wi-Fi latency setup failed";exitStage="wifi";break;}
#endif
      exitStage="claim";
      if (!paired.load()) publish(state,"Claiming local pairing");
      if (!paired.load() && !claim()) { result="Claim failed - see USB"; event="claim_failed"; break; }
      if (abortConnect.load()) break;
      if (credentialExpiry && time(nullptr)>=credentialExpiry) { paired.store(false); wipe(credential,sizeof(credential)); result="Credential expired"; event="expired"; break; }
      publish(state,"Connecting verified WSS");
      exitStage="tls_init"; tls=esp_transport_ssl_init(); if (!tls) break;
      esp_transport_ssl_crt_bundle_attach(tls,esp_crt_bundle_attach);
      exitStage="ws_init"; ws=esp_transport_ws_init(tls); if (!ws) break;
      char auth[110]; snprintf(auth,sizeof(auth),"Bearer %s",credential);
      char headers[300]; snprintf(headers,sizeof(headers),"X-Lemmi-Access-Key: %s\r\n",cfg.access);
      esp_transport_ws_set_path(ws,"/v1/device-stream");
      bool settings=esp_transport_ws_set_auth(ws,auth)==ESP_OK && esp_transport_ws_set_headers(ws,headers)==ESP_OK;
      wipe(auth,sizeof(auth)); wipe(headers,sizeof(headers));
      exitStage="headers"; if (!settings) break;
      exitStage="connect";
      int connected=esp_transport_connect(ws,Host,443,4000);
      ioResult=connected; upgrade=esp_transport_ws_get_upgrade_request_status(ws);
      if (upgrade==401 || upgrade==403) { paired.store(false); wipe(credential,sizeof(credential)); result="Re-pair/key check needed"; event="expired"; }
      if (connected<0 || upgrade!=101 || abortConnect.load()) break;
#ifdef LEMMI_VOICE
      // The SDK writes WS header/payload separately. Do not let Nagle hold
      // small control/receipt payloads waiting for a delayed TCP acknowledgment.
      int socket=esp_transport_get_socket(tls),nodelay=1; socklen_t optionSize=sizeof(nodelay);
      if(socket<0||setsockopt(socket,IPPROTO_TCP,TCP_NODELAY,&nodelay,sizeof(nodelay))!=0||
         getsockopt(socket,IPPROTO_TCP,TCP_NODELAY,&nodelay,&optionSize)!=0||nodelay!=1){result="TCP latency setup failed";exitStage="headers";break;}
      Serial.println("event=voice_link nodelay=1 wifi_sleep=0 camera=off");
#endif
      exitStage="hello"; if (!send(state,"device.hello",false,true)) break;
      exitStage="link";
      started=millis(); uint32_t lastSend=started, messageAt=0; size_t used=0; char incoming[4097]={};
#ifdef LEMMI_VOICE
      uint32_t lastAudioBatch=started;
#endif
#ifdef LEMMI_VOICE
      lemmi::WsFrameReader reader(incoming,sizeof(incoming));
#endif
      publish(state,"Awaiting device.ready");
      StopIntent stop; stop.epoch=controlEpoch.load();
      char startId[37]={}, stopId[37]={};
      while (WiFi.status()==WL_CONNECTED && !abortConnect.load()) {
        if (credentialExpiry && time(nullptr)>=credentialExpiry) { paired.store(false); wipe(credential,sizeof(credential)); result="Credential expired"; event="expired"; exitStage="expiry"; break; }
        if ((!state.ready && uint32_t(millis()-started)>=6000) || state.watchdog(millis())) { result="Heartbeat timeout"; event="watchdog"; exitStage="watchdog"; break; }
        stop.changedEpoch(controlEpoch.load());
        if (stopRequested.load() && stop.canSend(state)) {
          if (!stop.markSent() || !send(state,"input.stop",false,false,stopId)) { exitStage="stop_send"; break; }
        }
        if (stopRequested.load() && stop.complete(state)) { stopRequested.store(false); stop.sent=false; }
        if (state.ready && uint32_t(millis()-lastSend)>=2000) { if (!send(state,"heartbeat")) { exitStage="heartbeat_send"; break; } lastSend=millis(); }
        Command command;
        if (!stopRequested.load() && xQueueReceive(commands,&command,0)==pdTRUE) {
          if (state.currentCommand(command.epoch,controlEpoch.load(),command.session,command.generation,command.kind==Start || command.kind==Help)) {
            state.stopped=latch.load();
            const char* type=nullptr;
            if (command.kind==Start && !stop.startInFlight && state.start()) { type="input.start"; }
            else if (command.kind==Help) type="input.help";
            else if (command.kind==Handoff && state.canHandoff()) type="input.handoff";
            else if (command.kind==Mute && state.active() && state.ownsEndpoint) type="input.mute";
#ifdef LEMMI_VOICE
            else if(command.kind==Speak&&state.audioSupported&&state.ordinary())type="input.speak";
#endif
            else if (state.canPause() && command.kind==Pause) type="input.pause";
            else if (state.canResume() && command.kind==Resume) type="input.resume";
            if (type && command.epoch==controlEpoch.load()) {
              if (!send(state,type,command.muted,command.kind==Start,command.kind==Start?startId:nullptr)) { exitStage="control_send"; break; }
              if (command.kind==Start) stop.startInFlight=true;
            } else publish(state,"Control needs fresh state");
          }
        }
#ifdef LEMMI_VOICE
        static VoiceBridge::Outbound audio; // one worker, wiped after every use
        voiceWorkerMin.store(uxTaskGetStackHighWaterMark(nullptr));
        // Gather ~three 20ms capture frames per TLS write rather than paying
        // network scheduling overhead fifty times/second. Control handling and
        // reads continue between these bounded 60ms batch opportunities.
        if(!voice.captureActive.load()||uint32_t(millis()-lastAudioBatch)>=60||voice.outgoing.size()>=4){
        lastAudioBatch=millis();voiceBatch.clear();voiceBatchCapture=0;voiceBatching=true;
        bool batchOK=true;uint32_t batchAt=millis();
        for(int i=0;i<4&&voice.outgoing.pop(audio);++i) {
          bool ok=sendVoice(state,audio);

          wipe(&audio,sizeof(audio));
          if(!ok){batchOK=false;break;}
        }
        voiceBatching=false;
        if(batchOK)batchOK=flushVoiceBatch();else{voiceBatch.clear();voiceBatchCapture=0;}
        uint32_t duration=millis()-batchAt;
        if(duration>voiceMaxSendMs.load())voiceMaxSendMs.store(duration);
        if(!batchOK){
            latch.store(true);controlEpoch.fetch_add(1);
            Serial.printf("event=voice_send_failed reason=%u status=%u result=%d bytes=%u send_max_ms=%u capture_sent=%u camera=off\n",unsigned(voiceSendFailure),unsigned(voiceWriteResult.status),voiceWriteResult.last,unsigned(voiceWriteResult.sent),unsigned(voiceMaxSendMs.load()),unsigned(voiceCaptureSent.load()));
            if(voiceSendFailure==6)reportTransportProbe();
            exitStage="control_send";result="Audio send failed";abortConnect.store(true);break;
        }
        }
        if(abortConnect.load())break;
        if(reader.expired(millis())){result="Incomplete server frame";event="protocol_error";exitStage="partial";break;}
        int poll=esp_transport_poll_read(tls,2);
#else
        int poll=esp_transport_poll_read(ws,20);
#endif
        if (poll<0) { exitStage="poll"; ioResult=poll; break; }
        if (poll>0) {
#ifdef LEMMI_VOICE
          // After the verified SDK HTTP upgrade, read incrementally from its
          // TLS parent. SDK WS read_exact_size loses partial headers on timeout
          // and maps timeout to the same -1 as FIN. Never guess/retry that -1.
          lastOpcode=reader.opcode();
          int n=esp_transport_read(tls,reader.destination(),std::min(size_t(1024),reader.writable()),20);
          if(n<0){exitStage="read";ioResult=n;break;}
          if(!n)continue; // TLS WANT_READ/timeout preserves the current frame
          if(!reader.received(size_t(n),millis())){result="Invalid server frame";event="protocol_error";exitStage="frame";break;}
          lastOpcode=reader.opcode();
          if(!reader.ready())continue;
          const auto opcode=reader.opcode();const int length=int(reader.length());
          if(opcode==WS_TRANSPORT_OPCODES_PING){
            int sent=writeVoiceFrame(10,incoming,length,100);
            reader.clear();if(sent!=length){exitStage="control_send";break;}continue;
          }
          if(opcode==WS_TRANSPORT_OPCODES_PONG){reader.clear();continue;}
          if(opcode==WS_TRANSPORT_OPCODES_CLOSE){
            writeVoiceFrame(8,nullptr,0,100);
            exitStage="close";ioResult=length>=2?int((uint16_t(uint8_t(incoming[0]))<<8)|uint8_t(incoming[1])):0;break;
          }
          if(length<=0){result="Invalid server frame";event="protocol_error";exitStage="frame";break;}
          used=size_t(length);
#else
          int n=esp_transport_read(ws,incoming+used,4096-used,100);
          auto opcode=esp_transport_ws_get_read_opcode(ws);
          lastOpcode=int(opcode);
          int length=esp_transport_ws_get_read_payload_len(ws);
          if (n<0 || opcode==WS_TRANSPORT_OPCODES_CLOSE) { exitStage=opcode==WS_TRANSPORT_OPCODES_CLOSE?"close":"read"; ioResult=n; break; }
          if (n==0) { if (used && uint32_t(millis()-messageAt)>=1000) { exitStage="partial"; break; } continue; }
          if (opcode!=WS_TRANSPORT_OPCODES_TEXT || !esp_transport_ws_get_fin_flag(ws) || length<=0 || length>4096 || used+size_t(n)>size_t(length)) { result="Invalid server frame"; event="protocol_error"; exitStage="frame"; break; }
          if (!used) messageAt=millis();
          used+=n;
#endif
          if (used==size_t(length)) {
            incoming[used]=0; cJSON* root=protocol::parse(incoming,used); bool heartbeat=false;
            bool wasReady=state.ready;
            bool wasOwner=state.ownsEndpoint;
#ifdef LEMMI_VOICE
            char previousPhase[16];strcpy(previousPhase,state.phase);
            uint64_t previousGeneration=state.generation;bool wasSnapshot=state.snapshot;
#endif
            const char* rejection=nullptr;
#ifdef LEMMI_VOICE
            static speechwire::Output audioEvent; // one worker, wiped below
            bool hasOutput=false;
            state.stopped=latch.load();
            bool valid=speechwire::event(root,state,credentialExpiry,heartbeat,audioEvent,hasOutput,&rejection);
            if(valid&&hasOutput&&!voice.offer(audioEvent,controlEpoch.load())){valid=false;rejection="reply_binding";}
            wipe(&audioEvent,sizeof(audioEvent));
#else
            bool valid=protocol::event(root,state,credentialExpiry,heartbeat,&rejection);
#endif
            if (!valid) {
              latch.store(true);controlEpoch.fetch_add(1);
              // Fixed parser stage only: never print server text, IDs or payloads.
#ifdef LEMMI_VOICE
              Serial.printf("event=voice_reject stage=%s camera=off\n",rejection?rejection:"reply_binding");
#else
              Serial.printf("event=control_protocol_reject stage=%s capture=off camera=off\n",rejection);
#endif
              discardJSON(root); wipe(incoming,sizeof(incoming)); used=0;
              result="Invalid server state"; event="protocol_error"; exitStage="message"; break;
            }
            const bool stateEvent=protocol::equal(protocol::field(root,"type"),"state.changed");
            const bool ackEvent=protocol::equal(protocol::field(root,"type"),"command.ack");
            const bool applied=cJSON_IsTrue(protocol::field(protocol::field(root,"payload"),"applied"));
            const bool error=protocol::equal(protocol::field(root,"type"),"error");
            auto replyPayload=protocol::field(root,"payload");
#ifdef LEMMI_VOICE
            auto ackId=protocol::field(replyPayload,"commandId");
            bool receiptAck=protocol::string(ackId,100)&&!strncmp(ackId->valuestring,"voice-",6);
#endif
            if (stateEvent) stop.stateChanged(state);
            if (error || (ackEvent && !applied)) {
              stop.rejected(startId[0] && protocol::equal(protocol::field(replyPayload,"commandId"),startId),
                stopRequested.load() && stopId[0] && protocol::equal(protocol::field(replyPayload,"commandId"),stopId) && protocol::equal(protocol::field(replyPayload,"code"),"REVISION_CONFLICT"));
            }
            const bool unauthorized=error && protocol::equal(protocol::field(protocol::field(root,"payload"),"code"),"UNAUTHORIZED");
            discardJSON(root); wipe(incoming,sizeof(incoming)); used=0;
#ifdef LEMMI_VOICE
            reader.clear();
#endif
            if (wasOwner && !state.ownsEndpoint) { controlEpoch.fetch_add(1); xQueueReset(commands); micMuted.store(true); }
            if (state.forceLocalStop(stateEvent)) latch.store(true);
#ifdef LEMMI_VOICE
            if(stateEvent&&(!wasSnapshot||wasOwner!=state.ownsEndpoint||previousGeneration!=state.generation||strcmp(previousPhase,state.phase)))
              Serial.printf("event=voice_state phase=%s stopped=%u owner=%u camera=off\n",state.phase,unsigned(latch.load()),unsigned(state.ownsEndpoint));
            if(ackEvent&&(!applied||!receiptAck))Serial.printf("event=voice_ack applied=%u camera=off\n",unsigned(applied));
#else
            if (stateEvent) Serial.printf("event=control_state phase=%s stopped=%u capture=off camera=off\n",state.phase,unsigned(latch.load()));
            if (stateEvent && state.session[0]) Serial.printf("event=control_owner local=%u capture=off camera=off\n",unsigned(state.ownsEndpoint));
            if (ackEvent) Serial.printf("event=control_ack applied=%u capture=off camera=off\n",unsigned(applied));
#endif
            if (!wasReady && state.ready) {
              state.heartbeatAt=millis(); fixedEvent("ready");
#ifdef LEMMI_VOICE
              Serial.printf("event=voice_ready audio=%u output_window=%u language=%s camera=off\n",unsigned(state.audioSupported),unsigned(state.outputWindowChunks),state.language);
#endif
            }
            if (heartbeat) state.heartbeatAt=millis();
            if (unauthorized) { paired.store(false); wipe(credential,sizeof(credential)); result="Device access rejected"; event="expired"; exitStage="auth"; break; }
            char connectedStatus[27];
#ifdef LEMMI_VOICE
            snprintf(connectedStatus,sizeof(connectedStatus),"%s / camera off",state.phase);
#else
            snprintf(connectedStatus,sizeof(connectedStatus),"%s / capture off",state.phase);
#endif
            publish(state,error ? "Control rejected/unavailable" : state.canHandoff()?"Other endpoint owns session":latch.load() ? "Stopped locally" : connectedStatus);
          }
        }
#ifndef LEMMI_VOICE
        if (used && uint32_t(millis()-messageAt)>=1000) { result="Incomplete server frame"; event="protocol_error"; exitStage="partial"; break; }
#endif
        vTaskDelay(pdMS_TO_TICKS(2));
      }
      wipe(incoming,sizeof(incoming));
    } while(false);
    // Invalidate before diagnostics or network cleanup can block. The UI task
    // stops local audio independently, using this latch on its next iteration.
    latch.store(true);controlEpoch.fetch_add(1);
    // Capture before cleanup changes socket/Wi-Fi state. No close reason text,
    // transport payload, headers, identifiers or credentials are emitted.
#ifdef LEMMI_VOICE
    Serial.printf("event=voice_transport_exit stage=%s result=%d opcode=%d upgrade=%d errno=%d wifi=%u reason=%u ready=%u age_ms=%lu camera=off\n",
#else
    Serial.printf("event=control_transport_exit stage=%s result=%d opcode=%d upgrade=%d errno=%d wifi=%u reason=%u ready=%u age_ms=%lu capture=off camera=off\n",
#endif
      exitStage,ioResult,lastOpcode,upgrade,tls?esp_transport_get_errno(tls):0,unsigned(WiFi.status()),unsigned(wifiDisconnectReason.load()),unsigned(state.ready),(unsigned long)(millis()-connectionAt));
    cleanup(); xQueueReset(commands); state.disconnected();
    if (abortConnect.load()) { result="Stopped / disconnected"; event="disconnected"; }
    publish(state,result); fixedEvent(event); busy.store(false); dirty.store(true);
  }
}
void button(int x,int y,int w,const char* label,uint32_t color=TFT_DARKGREY,int h=30) {
  M5.Display.fillRect(x,y,w,h,color); M5.Display.setTextColor(TFT_WHITE,color); M5.Display.setCursor(x+8,y+7); M5.Display.print(label);
}
void draw() {
  ControlPolicy state; char status[27];
  portENTER_CRITICAL(&uiLock); state=view; strcpy(status,statusText); portEXIT_CRITICAL(&uiLock);
  const bool effectiveMuted=state.micIsMuted(micMuted.load());
  static bool painted=false;
  static char shownStatus[27]={};
  static const char* shownLabels[4]={};
  const char* labels[]={busy.load()?"DISCONNECT":configured.load() && cfg.wifiOnly?"TEST WI-FI (no pairing)":paired.load()?"CONNECT (stays stopped)":configured.load()?"PAIR + CONNECT Alex":"Provision via USB first",
    state.canHandoff()?"USE ROBOT (pauses)":!strcmp(state.phase,"paused")?"RESUME":"PAUSE",effectiveMuted?"UNMUTE (stays off)":"MUTE microphone",latch.load()?"STOPPED / STOP":"STOP"};
  M5.Display.setTextSize(2);
  if (!painted) {
    M5.Display.fillScreen(TFT_BLACK); M5.Display.setTextColor(TFT_WHITE,TFT_BLACK);
    M5.Display.setCursor(5,4); M5.Display.print("Camera / microphone off");
    button(4,88,150,"START"); button(158,88,158,"GET HELP");
  }
#ifdef LEMMI_VOICE
  M5.Display.fillRect(0,0,320,25,TFT_BLACK);M5.Display.setTextColor(TFT_WHITE,TFT_BLACK);M5.Display.setCursor(5,4);
  M5.Display.print(voice.capturing()?"MIC ON / I'm listening":voice.speaking()?"Lemmi speaking / mic off":state.hasGrant&&!latch.load()?"Listening - starting":"Microphone / camera off");
  button(4,88,150,!state.active()?"START":!strcmp(state.phase,"paused")?"RESUME FIRST":!state.audioSupported?"VOICE OFFLINE":voice.capturing()?"FINISHED":(!strcmp(state.phase,"speaking")||!strcmp(state.phase,"processing"))?"PAUSE TO TALK":effectiveMuted?"UNMUTE FIRST":!strcmp(state.language,"de")?"SPEAK (DE)":"SPEAK (EN)");
#endif
  if (!painted || strcmp(status,shownStatus)) {
    M5.Display.fillRect(0,26,320,24,TFT_BLACK); M5.Display.setTextColor(TFT_WHITE,TFT_BLACK);
    M5.Display.setCursor(5,28); M5.Display.print(status); strcpy(shownStatus,status);
  }
  const int positions[]={54,122,156,192};
  for (int i=0;i<4;++i) if (!painted || strcmp(labels[i],shownLabels[i])) {
    button(4,positions[i],312,labels[i],i==3?TFT_RED:TFT_DARKGREY,i==3?48:30); shownLabels[i]=labels[i];
  }
  painted=true;
}
void localStop() {
  latch.store(true); controlEpoch.fetch_add(1); stopRequested.store(true); xQueueReset(commands);
#ifdef LEMMI_VOICE
  voice.cancelAll();
#endif
  // Connection establishment cannot act on a late local confirmation after Stop.
  portENTER_CRITICAL(&uiLock); bool ready=view.ready; portEXIT_CRITICAL(&uiLock);
  if (!ready) abortConnect.store(true);
  M5.Mic.end(); M5.Speaker.stop(); M5.Speaker.end();
  dirty.store(true); fixedEvent("local_stop");
}
void enqueue(uint8_t kind) {
  Command c={};
  portENTER_CRITICAL(&uiLock); strcpy(c.session,view.session); c.generation=view.generation; portEXIT_CRITICAL(&uiLock);
  c.epoch=controlEpoch.load(); c.kind=kind; c.muted=micMuted.load();
  if (xQueueSend(commands,&c,0)!=pdTRUE) { localStop(); abortConnect.store(true); fixedEvent("queue_full"); }
}
}
void setup() {
  setenv("TZ","UTC0",1); tzset();
  // SDK TLS/HTTP/WS diagnostics can contain headers/body; keep them disabled.
  esp_log_level_set("*",ESP_LOG_NONE);
  auto c=M5.config(); c.serial_baudrate=115200;
#ifdef LEMMI_VOICE
  c.internal_mic=true;c.internal_spk=true;
#else
  c.internal_mic=false; c.internal_spk=false;
#endif
  c.internal_imu=false; c.internal_rtc=false;
  M5.begin(c); M5.Mic.end(); M5.Speaker.end();
  esp_log_level_set("*",ESP_LOG_NONE);
  WiFi.onEvent([](arduino_event_id_t event, arduino_event_info_t info) {
    if (event==ARDUINO_EVENT_WIFI_STA_DISCONNECTED) wifiDisconnectReason.store(info.wifi_sta_disconnected.reason);
  });
  protocolOK=controlProtocolCheck();
  if (!protocolOK) { strcpy(statusText,"Protocol check failed"); draw(); fixedEvent("selftest_failed"); return; }
  fixedEvent("selftest_passed");
#ifdef LEMMI_VOICE
  voiceLights=voiceBody.begin();
  if(!voice.begin()||!voiceLights){strcpy(statusText,"Voice unavailable");draw();protocolOK=false;return;}
#endif
  commands=xQueueCreate(4,sizeof(Command));
  if (!commands || xTaskCreatePinnedToCore(worker,"control",24576,nullptr,1,&task,0)!=pdPASS) esp_restart();
  draw(); fixedEvent("boot");
#ifdef LEMMI_VOICE
  Serial.printf("firmware=%s display=%dx%d capture=off camera=off\n",LEMMI_VOICE_VERSION,M5.Display.width(),M5.Display.height());
  Serial.printf("event=voice_boot reset=%u heap_free=%u loop_min=%u camera=off\n",unsigned(esp_reset_reason()),unsigned(ESP.getFreeHeap()),unsigned(uxTaskGetStackHighWaterMark(nullptr)));
#else
  Serial.printf("firmware=lemmi-control/0.9 display=%dx%d capture=off camera=off\n",M5.Display.width(),M5.Display.height());
#endif
}
void loop() {
  M5.update();
  if (!protocolOK) { delay(10); return; }
  for (int i=0;i<M5.Touch.getCount();++i) {
    auto t=M5.Touch.getDetail(i); if (!t.isPressed()) continue;
    if (t.y>=192) { if (t.wasPressed()) localStop(); break; }
    if (!t.wasPressed()) continue;
    if (t.y>=54 && t.y<84) {
      if (busy.load()) { localStop(); abortConnect.store(true); }
      else if (configured.load() || paired.load()) { abortConnect.store(false); stopRequested.store(false); xQueueReset(commands); busy.store(true); dirty.store(true); xTaskNotifyGive(task); }
    } else if (t.y>=88 && t.y<118) {
      if (t.x>=158) {
#ifdef LEMMI_VOICE
        controlEpoch.fetch_add(1);voice.cancelAll();
#endif
        enqueue(Help);
      }
      else {
        ControlPolicy current; portENTER_CRITICAL(&uiLock); current=view; portEXIT_CRITICAL(&uiLock);
#ifdef LEMMI_VOICE
        if(current.ordinary()&&!latch.load()&&strcmp(current.phase,"paused")) {
          if(voice.capturing())voice.finish(millis());
          else if(!strcmp(current.phase,"speaking")||!strcmp(current.phase,"processing")) {
            controlEpoch.fetch_add(1);voice.cancelAll();enqueue(Pause);
          }
          else if((!strcmp(current.phase,"ready")||!strcmp(current.phase,"waiting"))&&!current.micIsMuted(micMuted.load())&&current.audioSupported&&!stopRequested.load()) {
            controlEpoch.fetch_add(1);voice.speak();enqueue(Speak);dirty.store(true);
          }
        } else
#endif
        if (current.start()) { latch.store(false); enqueue(Start); dirty.store(true); }
      }
    }
    else if (t.y>=122 && t.y<152) {
      ControlPolicy current; portENTER_CRITICAL(&uiLock); current=view; portEXIT_CRITICAL(&uiLock);
      if (current.canHandoff() && !stopRequested.load()) {
#ifdef LEMMI_VOICE
        voice.cancelAll();
#endif
        // Explicit handoff cancels our pending controls and stays locally stopped.
        latch.store(true); micMuted.store(true); controlEpoch.fetch_add(1); xQueueReset(commands);
        enqueue(Handoff); fixedEvent("handoff_requested"); dirty.store(true);
      } else if (current.canResume()) {
        // Only the UI task clears local Stop, at the explicit tap. The network
        // task must never clear a newer physical Stop while sending this request.
        if (!stopRequested.load()) { latch.store(false); enqueue(Resume); dirty.store(true); }
      }
      else {
#ifdef LEMMI_VOICE
        controlEpoch.fetch_add(1);voice.cancelAll();
#endif
        enqueue(Pause);
      }
    }
    else if (t.y>=156 && t.y<186) {
      ControlPolicy current;portENTER_CRITICAL(&uiLock);current=view;portEXIT_CRITICAL(&uiLock);
      micMuted.store(!current.micIsMuted(micMuted.load()));
#ifdef LEMMI_VOICE
      if(micMuted.load())voice.mute();
#endif
      enqueue(Mute); dirty.store(true); fixedEvent(micMuted.load()?"mic_muted":"mic_unmuted"); }
    break;
  }
  // One bounded provisioning line, accepted only offline. Never echoed or logged.
  static char input[2049]; static size_t used=0; static bool overflow=false; static uint32_t inputAt=0;
  for (int n=0;n<128 && Serial.available();++n) {
    char ch=Serial.read(); if (!used) inputAt=millis();
    if (ch=='\n') { if (!overflow && used) {
      input[used]=0;
      if (!strcmp(input,"control.probe")) fixedEvent("provision_ready");
      else provision(input,used);
    } wipe(input,sizeof(input)); used=0; overflow=false; }
    else if (used<sizeof(input)-1) input[used++]=ch;
    else overflow=true;
  }
  if ((used || overflow) && uint32_t(millis()-inputAt)>5000) { wipe(input,sizeof(input)); used=0; overflow=false; fixedEvent("provision_invalid"); }
#ifdef LEMMI_VOICE
  ControlPolicy current;portENTER_CRITICAL(&uiLock);current=view;portEXIT_CRITICAL(&uiLock);
  // Paint listening permission before any microphone initialization.
  static char lastPhase[16]={};static bool lastCapture=false,lastSpeech=false;
  if(strcmp(lastPhase,current.phase)){strcpy(lastPhase,current.phase);dirty.store(true);}
  if(dirty.exchange(false))draw();
  if(voice.fault.exchange(false)) {
    const unsigned reason=voice.failure.exchange(VoiceBridge::NoFailure);
    localStop();abortConnect.store(true);
    Serial.printf("event=voice_fault code=%u send_max_ms=%u capture_sent=%u heap_free=%u camera=off\n",reason,unsigned(voiceMaxSendMs.load()),unsigned(voiceCaptureSent.load()),unsigned(ESP.getFreeHeap()));
    fixedEvent("audio_error");
  }
  else if(current.watchdog(millis())&&!abortConnect.load()){fixedEvent("watchdog");localStop();abortConnect.store(true);}
  else voice.tick(current,controlEpoch.load(),latch.load(),micMuted.load(),millis());
  auto color=StatusLights::choose(latch.load(),voice.captureActive.load(),voice.speaking(),false);
  if(color!=voiceColor) {
    if(!voiceBody.lights(color)){
      localStop();abortConnect.store(true);protocolOK=false;
      publish(current,"Voice lights unavailable");draw();
    }
    else voiceColor=color;
  }
  const bool capture=voice.captureActive.load(),speech=voice.speaking();
  static uint32_t memoryAt=0;
  if(uint32_t(millis()-memoryAt)>=5000) {
    memoryAt=millis();
    Serial.printf("event=voice_memory loop_min=%u worker_min=%u heap_free=%u camera=off\n",unsigned(uxTaskGetStackHighWaterMark(nullptr)),unsigned(voiceWorkerMin.load()),unsigned(ESP.getFreeHeap()));
    Serial.printf("event=voice_stream received=%u consumed=%u buffer_waits=%u camera=off\n",unsigned(voice.receivedChunks()),unsigned(voice.consumedChunks()),unsigned(voice.bufferWaits()));
  }
  if(capture!=lastCapture||speech!=lastSpeech) {
    Serial.printf("event=voice_audio capture=%s playback=%s camera=off\n",capture?"on":"off",speech?"on":"off");
    lastCapture=capture;lastSpeech=speech;dirty.store(true);
  }
#endif
  if (dirty.exchange(false)) draw();
  delay(2);
}
