#pragma once
#include "Protocol.h"

// Synthetic protocol fixture checks run locally before provisioning/network.
// No credentials or private content; failures disable networking in setup.
inline bool controlProtocolCheck() {
  const char* ready=R"({"protocol_version":1,"event_id":"fixture-ready","session_id":null,"turn_id":null,"generation":0,"sequence":0,"type":"device.ready","payload":{"mode":"live","deviceId":"stackchan-alex","profileId":"profile-alex","credentialExpiresAt":"2030-01-01T00:00:00.000Z","audio":false,"camera":false,"controls":["start","stop","pause","resume","mute","help"]}})";
  const char* idle=R"({"protocol_version":1,"event_id":"fixture-state","session_id":null,"turn_id":null,"generation":0,"sequence":1,"type":"state.changed","payload":{"mode":"live","session":null}})";
  ControlPolicy s; bool hb=false;
  cJSON* root=protocol::parse(ready,strlen(ready));
  const auto expiry=protocol::expiry(protocol::field(protocol::field(root,"payload"),"credentialExpiresAt"));
  bool ok=expiry>0 && protocol::event(root,s,expiry,hb) && s.ready && s.stopped && !s.snapshot;
  // A duplicate sequence is rejected rather than reapplying a state/control.
  ok=ok && !protocol::event(root,s,expiry,hb); cJSON_Delete(root);
  root=protocol::parse(idle,strlen(idle)); ok=ok && protocol::event(root,s,expiry,hb) && s.snapshot && s.stopped; cJSON_Delete(root);
  const char* grant=R"({"protocol_version":1,"event_id":"bad-grant","session_id":"fixture-session","turn_id":null,"generation":0,"sequence":2,"type":"state.changed","payload":{"mode":"live","session":{"id":"fixture-session","profileId":"profile-alex","mode":"live","phase":"listening","generation":0,"profileRevision":0,"privacyRevision":0,"policyRevision":0,"leaseId":"fixture-lease","micMuted":false,"captureGrant":{"turnId":"turn","generation":0,"leaseId":"fixture-lease"},"endpoint":"robot"}}})";
  root=protocol::parse(grant,strlen(grant)); ok=ok && !protocol::event(root,s,expiry,hb); cJSON_Delete(root);
  root=protocol::parse(ready,strlen(ready)); ControlPolicy foreign;
  auto p=protocol::field(root,"payload"); cJSON_ReplaceItemInObjectCaseSensitive(p,"profileId",cJSON_CreateString("profile-other"));
  ok=ok && !protocol::event(root,foreign,expiry,hb); cJSON_Delete(root);
  root=protocol::parse(ready,strlen(ready)); ControlPolicy persistent;
  p=protocol::field(root,"payload"); cJSON_ReplaceItemInObjectCaseSensitive(p,"credentialExpiresAt",cJSON_CreateNull());
  ok=ok && protocol::event(root,persistent,0,hb) && persistent.stopped;
  ControlPolicy wrongExpiry; ok=ok && !protocol::event(root,wrongExpiry,expiry,hb);
  cJSON_ReplaceItemInObjectCaseSensitive(p,"credentialExpiresAt",cJSON_CreateString("invalid"));
  ControlPolicy invalidExpiry; ok=ok && !protocol::event(root,invalidExpiry,0,hb);
  cJSON_DeleteItemFromObjectCaseSensitive(p,"credentialExpiresAt");
  ControlPolicy missingExpiry; ok=ok && !protocol::event(root,missingExpiry,0,hb); cJSON_Delete(root);
  // Deployed endpoint gateway adds handoff (eight controls with text). A
  // control-only robot must accept that descriptor without negotiating audio.
  root=protocol::parse(ready,strlen(ready)); ControlPolicy endpoints;
  p=protocol::field(root,"payload"); auto controls=protocol::field(p,"controls");
  cJSON_AddItemToArray(controls,cJSON_CreateString("handoff"));
  cJSON_AddItemToArray(controls,cJSON_CreateString("text"));
  cJSON_AddBoolToObject(p,"teaching",true);
  cJSON_AddBoolToObject(p,"photoStory",false);
  ok=ok && protocol::event(root,endpoints,expiry,hb) && endpoints.handoffSupported;
  ControlPolicy malformed;
  cJSON_ReplaceItemInObjectCaseSensitive(p,"teaching",cJSON_CreateString("true"));
  ok=ok && !protocol::event(root,malformed,expiry,hb) && !malformed.ready;
  cJSON_Delete(root);
  char nested[65]; for (int i=0;i<32;++i) { nested[i]='['; nested[63-i]=']'; } nested[64]=0;
  root=protocol::parse(nested,64); ok=ok && !root; cJSON_Delete(root);
  return ok;
}
