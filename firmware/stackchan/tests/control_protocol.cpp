#include "../lemmi_control/ProtocolCheck.h"
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <string>

// Fictional protocol-v1 fixtures following fetched backend-deploy 2b833ef.
// Uses the real firmware parser + locally installed SDK cJSON source on host.
static cJSON* packet(const char* type, unsigned sequence, const char* payload,
                     const char* sid="null", unsigned generation=0) {
  std::string json="{\"protocol_version\":1,\"event_id\":\"fixture-event\",\"session_id\":";
  json+=sid;
  json+=",\"turn_id\":null,\"generation\":"+std::to_string(generation)+",\"sequence\":"+std::to_string(sequence);
  json+=",\"type\":\""+std::string(type)+"\",\"payload\":"+payload+"}";
  return protocol::parse(json.c_str(),json.size());
}
static const char* ready=R"({"mode":"live","deviceId":"stackchan-alex","profileId":"profile-alex","credentialExpiresAt":null,"audio":false,"camera":false,"textChat":true,"teaching":true,"photoStory":false,"controls":["start","stop","pause","resume","mute","help","handoff","text"]})";
static const char* session=R"({"mode":"live","session":{"id":"fixture-session","profileId":"profile-alex","generation":2,"profileRevision":1,"privacyRevision":1,"policyRevision":1,"phase":"paused","endpoint":"robot","activeEndpointId":"stackchan-alex","leaseId":"fixture-lease","micMuted":true,"captureGrant":null,"communicationSupport":{"preset":"quiet","configVersion":1},"conversationMode":"open","teaching":null,"mode":"live"}})";
static cJSON* snapshot(unsigned seq) { return packet("state.changed",seq,session,"\"fixture-session\"",2); }
static cJSON* mirror(cJSON* root) { return protocol::field(protocol::field(root,"payload"),"session"); }
static void text(cJSON* p,const char* name,const char* value) { cJSON_ReplaceItemInObjectCaseSensitive(p,name,cJSON_CreateString(value)); }
static bool receive(cJSON* root,ControlPolicy& state,const char** reason=nullptr) {
  bool heartbeat=false;bool ok=protocol::event(root,state,0,heartbeat,reason);cJSON_Delete(root);return ok;
}
int main() {
  setenv("TZ","UTC0",1);tzset();
  assert(controlProtocolCheck());
  ControlPolicy state;
  assert(receive(packet("device.ready",0,ready),state));
  assert(state.ready && state.handoffSupported && state.stopped);
  assert(receive(snapshot(1),state));
  assert(state.ownsEndpoint && state.canResume() && !state.canHandoff());
  state.stopped=false;
  assert(state.ordinary());
  // New browser ownership is safe to mirror and cannot authorize this robot.
  auto root=snapshot(2);auto s=mirror(root);text(s,"endpoint","browser");text(s,"activeEndpointId","fixture-browser");
  assert(receive(root,state));
  assert(!state.ownsEndpoint && state.stopped && !state.ordinary() && !state.canResume() && state.canHandoff());
  // A browser's valid capture grant does not belong to us; retain capture off.
  root=snapshot(3);s=mirror(root);text(s,"endpoint","browser");text(s,"activeEndpointId","fixture-browser");text(s,"phase","listening");
  cJSON_ReplaceItemInObjectCaseSensitive(s,"micMuted",cJSON_CreateFalse());
  const char* grant=R"({"turnId":"fixture-turn","generation":2,"leaseId":"fixture-lease","streamId":"fixture-stream","language":"en","expiresAt":"2030-01-01T00:00:20Z"})";
  cJSON_ReplaceItemInObjectCaseSensitive(s,"captureGrant",protocol::parse(grant,strlen(grant)));
  assert(receive(root,state));assert(!state.ownsEndpoint && state.stopped);
  // Neither an own grant nor malformed foreign grant may be accepted. Failed
  // messages must not consume sequence or partially overwrite the safe mirror.
  for (int mode=0;mode<4;++mode) {
    root=snapshot(4);s=mirror(root);text(s,"phase","listening");
    cJSON_ReplaceItemInObjectCaseSensitive(s,"micMuted",cJSON_CreateFalse());
    cJSON_ReplaceItemInObjectCaseSensitive(s,"captureGrant",protocol::parse(grant,strlen(grant)));
    if (mode) { text(s,"endpoint","browser");text(s,"activeEndpointId","fixture-browser"); }
    if (mode==1) text(protocol::field(s,"captureGrant"),"leaseId","foreign-lease");
    if (mode==2) cJSON_DeleteItemFromObjectCaseSensitive(s,"captureGrant");
    if (mode==3) cJSON_DeleteItemFromObjectCaseSensitive(s,"activeEndpointId");
    auto seq=state.serverSequence;const char* reason=nullptr;
    assert(!receive(root,state,&reason));assert(!strcmp(reason,"state_capture"));
    assert(state.serverSequence==seq && !state.ownsEndpoint && state.stopped);
  }
  // Authoritative handoff back to robot stays stopped until an explicit Resume.
  assert(receive(snapshot(4),state));assert(state.ownsEndpoint && state.stopped && state.canResume());
  state.stopped=false; assert(state.ordinary());
  // Profile/envelope/ownership/replay checks remain strict.
  for (int mode=0;mode<4;++mode) {
    root=snapshot(5);s=mirror(root);
    if (mode==0) text(s,"profileId","profile-foreign");
    if (mode==1) text(root,"session_id","foreign-session");
    if (mode==2) cJSON_ReplaceItemInObjectCaseSensitive(s,"activeEndpointId",cJSON_CreateNumber(4));
    if (mode==3) cJSON_ReplaceItemInObjectCaseSensitive(root,"generation",cJSON_CreateNumber(3));
    assert(!receive(root,state));assert(state.serverSequence==4 && state.ownsEndpoint && !state.stopped);
  }
  assert(!receive(snapshot(4),state));
  // Optional metadata is a boolean capability, never executable permission.
  for (const char* capability : {"teaching", "photoStory"}) {
  for(int mode=0;mode<8;++mode){
    ControlPolicy fresh;root=packet("device.ready",0,ready);auto p=protocol::field(root,"payload");
    if(mode==0)cJSON_DeleteItemFromObjectCaseSensitive(p,capability);
    if(mode==1)cJSON_ReplaceItemInObjectCaseSensitive(p,capability,cJSON_CreateFalse());
    if(mode==2)cJSON_ReplaceItemInObjectCaseSensitive(p,capability,cJSON_CreateString("true"));
    if(mode==3)cJSON_ReplaceItemInObjectCaseSensitive(p,capability,cJSON_CreateNull());
    if(mode==4)cJSON_ReplaceItemInObjectCaseSensitive(p,capability,cJSON_CreateNumber(1));
    if(mode==5)cJSON_AddBoolToObject(p,capability,true);
    if(mode==6)cJSON_AddBoolToObject(p,"unknownCapability",true);
    if(mode==7)cJSON_ReplaceItemInObjectCaseSensitive(p,capability,cJSON_CreateTrue());
    assert(receive(root,fresh)==(mode<2 || mode==7));
    if(mode>=2 && mode<7)assert(!fresh.ready&&!fresh.seenSequence&&fresh.stopped);
  }
  }
  // Ready accepts known optional controls; never accepts negotiated media for a
  // hello which advertised audio unsupported, unknown controls, or foreign IDs.
  for (int mode=0;mode<5;++mode) {
    ControlPolicy fresh;root=packet("device.ready",0,ready);auto p=protocol::field(root,"payload");
    if (mode==0) cJSON_AddItemToArray(protocol::field(p,"controls"),cJSON_CreateString("invented"));
    if (mode==1) cJSON_AddItemToArray(protocol::field(p,"controls"),cJSON_CreateString("stop"));
    if (mode==2) text(p,"deviceId","foreign-device");
    if (mode==3) text(p,"credentialExpiresAt","invalid");
    if (mode==4) cJSON_ReplaceItemInObjectCaseSensitive(p,"audio",cJSON_CreateObject());
    assert(!receive(root,fresh));assert(!fresh.ready && !fresh.seenSequence && fresh.stopped);
  }
  std::puts("PASS: deployed ready/handoff, ownership, observer grants, bindings and transactional rejection");
}
