#include "../audio/SpeechWire.h"
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <string>

// Fictional fixtures also validated by check_backend_contract.cjs against the
// fetched canonical Zod schemas. No live request or device credential involved.
static const char* voiceHello=R"({"firmwareVersion":"lemmi-voice/0.9","endpoint":"robot","cameraSupported":false,"pettingSupported":false,"audio":{"encoding":"pcm_s16le","sampleRate":16000,"channels":1,"frameMs":20},"playback":{"encoding":"pcm_s16le","channels":1,"sampleRates":[16000,22050,24000,44100,48000],"outputWindowChunks":12}})";
static const char* voiceReady=R"({"mode":"live","deviceId":"stackchan-alex","profileId":"profile-alex","language":"en","credentialExpiresAt":null,"audio":{"encoding":"pcm_s16le","sampleRate":16000,"channels":1,"frameMs":20,"maxCaptureMs":20000,"playback":{"encoding":"pcm_s16le","channels":1,"sampleRates":[16000,22050,24000,44100,48000],"outputWindowChunks":4},"outputWindowChunks":4},"camera":false,"textChat":true,"teaching":true,"photoStory":false,"controls":["start","stop","pause","resume","mute","help","handoff","text","speak"]})";
static const char* voiceSession=R"({"mode":"live","session":{"id":"fixture-session","profileId":"profile-alex","generation":2,"profileRevision":1,"privacyRevision":1,"policyRevision":1,"phase":"listening","endpoint":"robot","activeEndpointId":"stackchan-alex","leaseId":"fixture-lease","micMuted":false,"captureGrant":{"turnId":"fixture-turn","generation":2,"leaseId":"fixture-lease","streamId":"fixture-input","language":"en","expiresAt":"2030-01-01T00:00:20Z"},"communicationSupport":{"preset":"quiet","configVersion":1},"conversationMode":"open","teaching":null,"mode":"live"}})";
static const char* voiceOutputStart=R"({"turnId":"fixture-turn","leaseId":"fixture-lease","streamId":"fixture-output","encoding":"pcm_s16le","channels":1,"sampleRate":22050,"chunkBytes":882,"chunkCount":1,"byteLength":2})";
static cJSON* packet(const char* type,int seq,const char* payload,bool bound=false,bool turn=false){
  std::string value="{\"protocol_version\":1,\"event_id\":\"fixture-event\",\"session_id\":";
  value+=bound?"\"fixture-session\"":"null";
  value+=",\"turn_id\":";value+=turn?"\"fixture-turn\"":"null";
  value+=",\"generation\":";value+=bound?"2":"0";
  value+=",\"sequence\":"+std::to_string(seq)+",\"type\":\""+std::string(type)+"\",\"payload\":"+payload+"}";
  return protocol::parse(value.c_str(),value.size());
}
static bool receive(cJSON* root,ControlPolicy& state,speechwire::Output& out){
  bool hb=false,hasOutput=false;const char* reason=nullptr;
  bool ok=speechwire::event(root,state,0,hb,out,hasOutput,&reason);cJSON_Delete(root);return ok;
}
int main(){
  for(int window:{4,12}){
    ControlPolicy negotiated;speechwire::Output message={};
    auto root=packet("device.ready",0,voiceReady);
    auto audio=protocol::field(protocol::field(root,"payload"),"audio");
    cJSON_ReplaceItemInObjectCaseSensitive(audio,"outputWindowChunks",cJSON_CreateNumber(window));
    bool hb=false,has=false;const char* reason=nullptr;
    assert(speechwire::event(root,negotiated,0,hb,message,has,&reason));cJSON_Delete(root);
    assert(negotiated.audioSupported&&negotiated.outputWindowChunks==window);
  }
  for(int window:{0,8,13}){
    ControlPolicy bad;speechwire::Output message={};
    auto root=packet("device.ready",0,voiceReady);
    auto audio=protocol::field(protocol::field(root,"payload"),"audio");
    cJSON_ReplaceItemInObjectCaseSensitive(audio,"outputWindowChunks",cJSON_CreateNumber(window));
    bool hb=false,has=false;const char* reason=nullptr;
    assert(!speechwire::event(root,bad,0,hb,message,has,&reason));cJSON_Delete(root);
    assert(!bad.ready&&bad.outputWindowChunks==4);
  }
  setenv("TZ","UTC0",1);tzset();
  assert(voiceHello[0]=='{');
  ControlPolicy s;speechwire::Output out={};
  auto ready=packet("device.ready",0,voiceReady);
  bool hb=false;assert(!protocol::event(ready,s,0,hb)); // control-only stays unsupported
  assert(receive(ready,s,out)&&s.audioSupported&&s.stopped);
  assert(receive(packet("state.changed",1,voiceSession,true),s,out));
  assert(s.hasGrant&&s.grantExpires>0&&!strcmp(s.grantTurn,"fixture-turn"));
  s.stopped=false;
  assert(receive(packet("response.start",2,voiceOutputStart,true,true),s,out));
  assert(out.format.chunkBytes==882&&out.format.byteLength==2);
  const char* chunk=R"({"leaseId":"fixture-lease","streamId":"fixture-output","chunkIndex":0,"encoding":"pcm_s16le","data":"NBI="})";
  assert(receive(packet("audio.chunk",3,chunk,true,true),s,out));
  assert(out.bytes==2&&out.pcm[0]==0x34&&out.pcm[1]==0x12);
  assert(!receive(packet("audio.chunk",3,chunk,true,true),s,out)); // duplicate sequence
  for(int mode=0;mode<5;++mode){
    auto root=packet("response.start",4,voiceOutputStart,true,true);
    auto p=protocol::field(root,"payload");
    if(mode==0)cJSON_ReplaceItemInObjectCaseSensitive(root,"session_id",cJSON_CreateString("other"));
    if(mode==1)cJSON_ReplaceItemInObjectCaseSensitive(root,"generation",cJSON_CreateNumber(1));
    if(mode==2)cJSON_ReplaceItemInObjectCaseSensitive(p,"leaseId",cJSON_CreateString("other"));
    if(mode==3)cJSON_ReplaceItemInObjectCaseSensitive(p,"chunkBytes",cJSON_CreateNumber(640));
    if(mode==4)cJSON_AddNumberToObject(p,"chunkBytes",882);
    assert(!receive(root,s,out)&&s.serverSequence==3);
  }
  s.profileRevision=2;
  assert(!receive(packet("state.changed",4,voiceSession,true),s,out)&&s.profileRevision==2);
  s.profileRevision=1;s.generation=3;
  assert(!receive(packet("state.changed",4,voiceSession,true),s,out)&&s.generation==3);
  ControlPolicy duplicate;
  ready=packet("device.ready",0,voiceReady);cJSON_AddFalseToObject(protocol::field(ready,"payload"),"audio");
  assert(!receive(ready,duplicate,out)&&!duplicate.ready);
  ControlPolicy disabled;ready=packet("device.ready",0,voiceReady);
  cJSON_ReplaceItemInObjectCaseSensitive(protocol::field(ready,"payload"),"audio",cJSON_CreateFalse());
  assert(receive(ready,disabled,out)&&!disabled.audioSupported);
  assert(!receive(packet("state.changed",1,voiceSession,true),disabled,out));
  for(const char* language:{"en","de"}){
    ControlPolicy localized;
    auto root=packet("device.ready",0,voiceReady);
    cJSON_ReplaceItemInObjectCaseSensitive(protocol::field(root,"payload"),"language",cJSON_CreateString(language));
    assert(receive(root,localized,out)&&!strcmp(localized.language,language));
    root=packet("state.changed",1,voiceSession,true);
    auto grant=protocol::field(protocol::field(protocol::field(root,"payload"),"session"),"captureGrant");
    cJSON_ReplaceItemInObjectCaseSensitive(grant,"language",cJSON_CreateString(language));
    assert(receive(root,localized,out));
  }
  ControlPolicy legacy;ready=packet("device.ready",0,voiceReady);
  cJSON_DeleteItemFromObjectCaseSensitive(protocol::field(ready,"payload"),"language");
  assert(receive(ready,legacy,out)&&!strcmp(legacy.language,"en"));
  for(int mode=0;mode<5;++mode){
    ControlPolicy bad;ready=packet("device.ready",0,voiceReady);auto p=protocol::field(ready,"payload");
    if(mode==0)cJSON_ReplaceItemInObjectCaseSensitive(p,"language",cJSON_CreateString("fr"));
    if(mode==1)cJSON_ReplaceItemInObjectCaseSensitive(p,"language",cJSON_CreateNumber(1));
    if(mode==2)cJSON_ReplaceItemInObjectCaseSensitive(p,"language",cJSON_CreateNull());
    if(mode==3)cJSON_AddStringToObject(p,"language","de");
    if(mode==4)cJSON_AddTrueToObject(p,"unexpected");
    assert(!receive(ready,bad,out)&&!bad.ready&&!strcmp(bad.language,"en"));
  }
  uint8_t data[1920]={};
  for(const char* invalid:{"","NBI","NBJ=","NB==","NB I=","NBI=AAAA","====","AAAA\n"})assert(!speechwire::decode(invalid,data,sizeof(data)));
  assert(speechwire::decode("NBI=",data,sizeof(data))==2);
  assert(!speechwire::decode("NBI=",data,1));
  std::puts("PASS: negotiated voice, explicit grants, scope/revision/sequence rejection, native output metadata and canonical base64");
}
