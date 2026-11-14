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

namespace {
constexpr const char* Host = "lemmi.chaoswarrior.dev";
struct Provision { char ssid[33], password[64], access[257], pairing[101], code[25]; } cfg = {};
struct Command { uint32_t epoch; uint64_t generation; char session[101]; uint8_t kind; bool muted; };
enum : uint8_t { Start, Pause, Resume, Mute, Help };
QueueHandle_t commands;
TaskHandle_t task;
std::atomic<bool> busy{false}, configured{false}, paired{false}, latch{true}, micMuted{true}, stopRequested{false}, abortConnect{false};
std::atomic<uint32_t> controlEpoch{0};
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
  portENTER_CRITICAL(&uiLock); view=state;
  if (status) snprintf(statusText,sizeof(statusText),"%s",status);
  portEXIT_CRITICAL(&uiLock); dirty.store(true);
}
void fixedEvent(const char* name) { Serial.printf("event=control_%s capture=off camera=off\n",name); }
bool headerValue(const cJSON* p, size_t min, size_t max) {
  if (!protocol::string(p,max) || strlen(p->valuestring)<min) return false;
  for (const char* s=p->valuestring; *s; ++s) if (*s<33 || *s>126) return false;
  return true;
}
void provision(char* input, size_t n) {
  if (!protocolOK || busy.load()) { fixedEvent("provision_busy"); return; }
  cJSON* p=protocol::parse(input,n);
  const char* allowed[]={"ssid","password","accessKey","pairingId","code","utcEpoch"};
  if (!protocol::keys(p,allowed,6) || cJSON_GetArraySize(p)!=6 || !protocol::string(protocol::field(p,"ssid"),32) || !protocol::string(protocol::field(p,"password"),63,false) || !headerValue(protocol::field(p,"accessKey"),32,256) || !protocol::string(protocol::field(p,"pairingId"),100) || !headerValue(protocol::field(p,"code"),24,24) || !protocol::number(protocol::field(p,"utcEpoch")) || protocol::field(p,"utcEpoch")->valuedouble<1735689600 || protocol::field(p,"utcEpoch")->valuedouble>2051222400) {
    discardJSON(p); fixedEvent("provision_invalid"); return;
  }
  wipe(&cfg,sizeof(cfg)); wipe(credential,sizeof(credential)); paired.store(false);
  strcpy(cfg.ssid,protocol::field(p,"ssid")->valuestring); strcpy(cfg.password,protocol::field(p,"password")->valuestring);
  strcpy(cfg.access,protocol::field(p,"accessKey")->valuestring); strcpy(cfg.pairing,protocol::field(p,"pairingId")->valuestring); strcpy(cfg.code,protocol::field(p,"code")->valuestring);
  timeval t={time_t(protocol::field(p,"utcEpoch")->valuedouble),0}; settimeofday(&t,nullptr);
  discardJSON(p); configured.store(true); fixedEvent("provisioned"); publish(view,"Confirm pairing locally");
}

bool claim() {
  cJSON* request=cJSON_CreateObject();
  cJSON_AddStringToObject(request,"pairingId",cfg.pairing); cJSON_AddStringToObject(request,"code",cfg.code); cJSON_AddBoolToObject(request,"localConfirmed",true);
  char* body=cJSON_PrintUnformatted(request); discardJSON(request);
  // A claim is single-use. Ambiguous failure requires new provisioning/pairing.
  wipe(cfg.code,sizeof(cfg.code)); wipe(cfg.pairing,sizeof(cfg.pairing)); configured.store(false);
  if (!body) return false;
  esp_http_client_config_t c={}; c.url="https://lemmi.chaoswarrior.dev/v1/device-pairings/claim";
  c.method=HTTP_METHOD_POST; c.timeout_ms=3000; c.disable_auto_redirect=true; c.crt_bundle_attach=esp_crt_bundle_attach;
  c.buffer_size=1024; c.buffer_size_tx=1024;
  auto http=esp_http_client_init(&c); bool ok=false; char response[4097]={};
  if (http) {
    esp_http_client_set_header(http,"Content-Type","application/json"); esp_http_client_set_header(http,"X-Lemmi-Access-Key",cfg.access);
    if (esp_http_client_open(http,strlen(body))==ESP_OK && esp_http_client_write(http,body,strlen(body))==int(strlen(body))) {
      int64_t length=esp_http_client_fetch_headers(http);
      if (esp_http_client_get_status_code(http)==200 && length>=0 && length<=4096) {
        int n=esp_http_client_read_response(http,response,4096);
        if (n>0 && esp_http_client_is_complete_data_received(http)) {
          cJSON* root=protocol::parse(response,n); auto data=protocol::field(root,"data");
          if (protocol::unique(root) && cJSON_IsTrue(protocol::field(root,"ok")) && protocol::unique(data) && protocol::equal(protocol::field(data,"deviceId"),"stackchan-alex") && protocol::equal(protocol::field(data,"profileId"),"profile-alex") && headerValue(protocol::field(data,"credential"),40,100)) {
            time_t end=protocol::expiry(protocol::field(data,"expiresAt"));
            if (end>time(nullptr) && end<=time(nullptr)+3600) { strcpy(credential,protocol::field(data,"credential")->valuestring); credentialExpiry=end; paired.store(true); ok=true; }
          }
          discardJSON(root);
        }
      }
    }
    esp_http_client_cleanup(http);
  }
  wipe(response,sizeof(response)); wipe(body,strlen(body)); cJSON_free(body); return ok;
}

bool send(ControlPolicy& state, const char* type, bool muted=false, bool initial=false, char* sentId=nullptr) {
  cJSON* root=cJSON_CreateObject(); char id[37]; uint8_t bytes[16]; esp_fill_random(bytes,sizeof(bytes));
  snprintf(id,sizeof(id),"%08lx-%08lx-%08lx-%08lx",(unsigned long)(uint32_t(bytes[0])<<24|uint32_t(bytes[1])<<16|uint32_t(bytes[2])<<8|bytes[3]),(unsigned long)esp_random(),(unsigned long)esp_random(),(unsigned long)esp_random());
  if (sentId) strcpy(sentId,id);
  cJSON_AddNumberToObject(root,"protocol_version",1); cJSON_AddStringToObject(root,"event_id",id);
  if (initial || !state.session[0]) cJSON_AddNullToObject(root,"session_id"); else cJSON_AddStringToObject(root,"session_id",state.session);
  cJSON_AddNullToObject(root,"turn_id"); cJSON_AddNumberToObject(root,"generation",initial?0:double(state.generation)); cJSON_AddNumberToObject(root,"sequence",double(outgoing++)); cJSON_AddStringToObject(root,"type",type);
  auto p=cJSON_AddObjectToObject(root,"payload");
  if (!strcmp(type,"device.hello")) {
    cJSON_AddStringToObject(p,"firmwareVersion","lemmi-control/0.1"); cJSON_AddBoolToObject(p,"cameraSupported",false); cJSON_AddBoolToObject(p,"pettingSupported",false);
    auto a=cJSON_AddObjectToObject(p,"audio"); cJSON_AddBoolToObject(a,"supported",false);
  } else if (!strcmp(type,"input.mute")) cJSON_AddBoolToObject(p,"muted",muted);
  char* json=cJSON_PrintUnformatted(root); cJSON_Delete(root);
  bool ok=json && strlen(json)<=4096 && esp_transport_ws_send_raw(ws,ws_transport_opcodes_t(WS_TRANSPORT_OPCODES_TEXT|WS_TRANSPORT_OPCODES_FIN),json,strlen(json),250)==int(strlen(json));
  if (json) { wipe(json,strlen(json)); cJSON_free(json); } return ok;
}
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
    outgoing=0;
    do {
      publish(state,"Connecting Wi-Fi");
      WiFi.persistent(false); WiFi.setAutoReconnect(false); WiFi.mode(WIFI_STA); WiFi.begin(cfg.ssid,cfg.password);
      uint32_t started=millis();
      while (WiFi.status()!=WL_CONNECTED && !abortConnect.load() && uint32_t(millis()-started)<15000) vTaskDelay(pdMS_TO_TICKS(20));
      if (WiFi.status()!=WL_CONNECTED || abortConnect.load()) break;
      if (!paired.load()) publish(state,"Claiming local pairing");
      if (!paired.load() && !claim()) { result="Need new pairing code"; event="claim_failed"; break; }
      if (abortConnect.load()) break;
      if (time(nullptr)>=credentialExpiry) { paired.store(false); wipe(credential,sizeof(credential)); result="Credential expired"; event="expired"; break; }
      publish(state,"Connecting verified WSS");
      tls=esp_transport_ssl_init(); if (!tls) break;
      esp_transport_ssl_crt_bundle_attach(tls,esp_crt_bundle_attach);
      ws=esp_transport_ws_init(tls); if (!ws) break;
      char auth[110]; snprintf(auth,sizeof(auth),"Bearer %s",credential);
      char headers[300]; snprintf(headers,sizeof(headers),"X-Lemmi-Access-Key: %s\r\n",cfg.access);
      esp_transport_ws_set_path(ws,"/v1/device-stream");
      bool settings=esp_transport_ws_set_auth(ws,auth)==ESP_OK && esp_transport_ws_set_headers(ws,headers)==ESP_OK;
      wipe(auth,sizeof(auth)); wipe(headers,sizeof(headers));
      if (!settings) break;
      int connected=esp_transport_connect(ws,Host,443,4000);
      int upgrade=esp_transport_ws_get_upgrade_request_status(ws);
      if (upgrade==401 || upgrade==403) { paired.store(false); wipe(credential,sizeof(credential)); result="Re-pair/key check needed"; event="expired"; }
      if (connected<0 || upgrade!=101 || abortConnect.load()) break;
      if (!send(state,"device.hello",false,true)) break;
      started=millis(); uint32_t lastSend=started, messageAt=0; size_t used=0; char incoming[4097]={};
      publish(state,"Awaiting device.ready");
      StopIntent stop; stop.epoch=controlEpoch.load();
      char startId[37]={}, stopId[37]={};
      while (WiFi.status()==WL_CONNECTED && !abortConnect.load()) {
        if (time(nullptr)>=credentialExpiry) { paired.store(false); wipe(credential,sizeof(credential)); result="Credential expired"; event="expired"; break; }
        if ((!state.ready && uint32_t(millis()-started)>=6000) || state.watchdog(millis())) { result="Heartbeat timeout"; event="watchdog"; break; }
        stop.changedEpoch(controlEpoch.load());
        if (stopRequested.load() && stop.canSend(state)) {
          if (!stop.markSent() || !send(state,"input.stop",false,false,stopId)) break;
        }
        if (stopRequested.load() && stop.complete(state)) { stopRequested.store(false); stop.sent=false; }
        if (state.ready && uint32_t(millis()-lastSend)>=2000) { if (!send(state,"heartbeat")) break; lastSend=millis(); }
        Command command;
        if (!stopRequested.load() && xQueueReceive(commands,&command,0)==pdTRUE) {
          if (state.currentCommand(command.epoch,controlEpoch.load(),command.session,command.generation,command.kind==Start || command.kind==Help)) {
            state.stopped=latch.load();
            const char* type=nullptr;
            if (command.kind==Start && state.start()) { type="input.start"; }
            else if (command.kind==Help) type="input.help";
            else if (command.kind==Mute && state.session[0] && strcmp(state.phase,"ended")) type="input.mute";
            else if (state.ordinary() && command.kind==Pause) type="input.pause";
            else if (state.ordinary() && command.kind==Resume && !strcmp(state.phase,"paused")) type="input.resume";
            if (type && command.epoch==controlEpoch.load()) {
              if (!send(state,type,command.muted,command.kind==Start,command.kind==Start?startId:nullptr)) break;
              if (command.kind==Start) stop.startInFlight=true;
            } else publish(state,"Control needs fresh state");
          }
        }
        int poll=esp_transport_poll_read(ws,20);
        if (poll<0) break;
        if (poll>0) {
          int n=esp_transport_read(ws,incoming+used,4096-used,100);
          auto opcode=esp_transport_ws_get_read_opcode(ws);
          int length=esp_transport_ws_get_read_payload_len(ws);
          if (n<0 || opcode==WS_TRANSPORT_OPCODES_CLOSE) break;
          if (n==0) { if (used && uint32_t(millis()-messageAt)>=1000) break; continue; }
          if (opcode!=WS_TRANSPORT_OPCODES_TEXT || !esp_transport_ws_get_fin_flag(ws) || length<=0 || length>4096 || used+size_t(n)>size_t(length)) { result="Invalid server frame"; event="protocol_error"; break; }
          if (!used) messageAt=millis();
          used+=n;
          if (used==size_t(length)) {
            incoming[used]=0; cJSON* root=protocol::parse(incoming,used); bool heartbeat=false;
            bool wasReady=state.ready;
            bool valid=protocol::event(root,state,credentialExpiry,heartbeat);
            const bool stateEvent=protocol::equal(protocol::field(root,"type"),"state.changed");
            const bool ackEvent=protocol::equal(protocol::field(root,"type"),"command.ack");
            const bool applied=cJSON_IsTrue(protocol::field(protocol::field(root,"payload"),"applied"));
            const bool error=protocol::equal(protocol::field(root,"type"),"error");
            auto replyPayload=protocol::field(root,"payload");
            if (stateEvent) stop.stateChanged(state);
            if (error || (ackEvent && !applied)) {
              stop.rejected(startId[0] && protocol::equal(protocol::field(replyPayload,"commandId"),startId),
                stopRequested.load() && stopId[0] && protocol::equal(protocol::field(replyPayload,"commandId"),stopId) && protocol::equal(protocol::field(replyPayload,"code"),"REVISION_CONFLICT"));
            }
            const bool unauthorized=error && (protocol::equal(protocol::field(protocol::field(root,"payload"),"code"),"UNAUTHORIZED") || protocol::equal(protocol::field(protocol::field(root,"payload"),"code"),"FORBIDDEN"));
            discardJSON(root); wipe(incoming,sizeof(incoming)); used=0;
            if (!valid) { result="Invalid server state"; event="protocol_error"; break; }
            if (stateEvent) Serial.printf("event=control_state phase=%s stopped=%u capture=off camera=off\n",state.phase,unsigned(latch.load()));
            if (ackEvent) Serial.printf("event=control_ack applied=%u capture=off camera=off\n",unsigned(applied));
            if (!wasReady && state.ready) { state.heartbeatAt=millis(); fixedEvent("ready"); }
            if (heartbeat) state.heartbeatAt=millis();
            if (unauthorized) { paired.store(false); wipe(credential,sizeof(credential)); result="Re-pair required"; event="expired"; break; }
            if (!strcmp(state.phase,"ended")) latch.store(true);
            publish(state,error ? "Control rejected/unavailable" : latch.load() ? "Stopped locally" : "Connected / capture off");
          }
        }
        if (used && uint32_t(millis()-messageAt)>=1000) { result="Incomplete server frame"; event="protocol_error"; break; }
        vTaskDelay(pdMS_TO_TICKS(2));
      }
      wipe(incoming,sizeof(incoming));
    } while(false);
    cleanup(); latch.store(true); xQueueReset(commands); state.disconnected();
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
  M5.Display.fillScreen(TFT_BLACK); M5.Display.setTextSize(2); M5.Display.setTextColor(TFT_WHITE,TFT_BLACK);
  M5.Display.setCursor(5,4); M5.Display.print("Camera / microphone off");
  M5.Display.setCursor(5,28); M5.Display.print(status);
  button(4,54,312,busy.load()?"DISCONNECT":paired.load()?"CONNECT (stays stopped)":configured.load()?"PAIR + CONNECT Alex":"Provision via USB first");
  button(4,88,150,"START"); button(158,88,158,"GET HELP");
  button(4,122,312,!strcmp(state.phase,"paused")?"RESUME":"PAUSE");
  button(4,156,312,micMuted.load()?"UNMUTE (stays off)":"MUTE microphone");
  button(4,192,312,latch.load()?"STOPPED / STOP":"STOP",TFT_RED,48);
}
void localStop() {
  latch.store(true); controlEpoch.fetch_add(1); stopRequested.store(true); xQueueReset(commands);
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
  auto c=M5.config(); c.serial_baudrate=115200; c.internal_mic=false; c.internal_spk=false; c.internal_imu=false; c.internal_rtc=false;
  M5.begin(c); M5.Mic.end(); M5.Speaker.end();
  esp_log_level_set("*",ESP_LOG_NONE);
  protocolOK=controlProtocolCheck();
  if (!protocolOK) { strcpy(statusText,"Protocol check failed"); draw(); fixedEvent("selftest_failed"); return; }
  fixedEvent("selftest_passed");
  commands=xQueueCreate(4,sizeof(Command));
  if (!commands || xTaskCreatePinnedToCore(worker,"control",24576,nullptr,1,&task,0)!=pdPASS) esp_restart();
  draw(); fixedEvent("boot");
  Serial.printf("firmware=lemmi-control/0.1 display=%dx%d capture=off camera=off\n",M5.Display.width(),M5.Display.height());
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
      if (t.x>=158) enqueue(Help);
      else {
        ControlPolicy current; portENTER_CRITICAL(&uiLock); current=view; portEXIT_CRITICAL(&uiLock);
        if (current.start()) { latch.store(false); enqueue(Start); dirty.store(true); }
      }
    }
    else if (t.y>=122 && t.y<152) { portENTER_CRITICAL(&uiLock); bool paused=!strcmp(view.phase,"paused"); portEXIT_CRITICAL(&uiLock); enqueue(paused?Resume:Pause); }
    else if (t.y>=156 && t.y<186) { micMuted.store(!micMuted.load()); enqueue(Mute); dirty.store(true); fixedEvent(micMuted.load()?"mic_muted":"mic_unmuted"); }
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
  if (dirty.exchange(false)) draw();
  delay(2);
}
