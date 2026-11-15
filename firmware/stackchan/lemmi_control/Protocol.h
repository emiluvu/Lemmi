#pragma once
#include <cJSON.h>
#include <math.h>
#include <string.h>
#include <time.h>
#include "ControlPolicy.h"

namespace protocol {
inline cJSON* field(const cJSON* p, const char* k) { return cJSON_GetObjectItemCaseSensitive(p, k); }
inline bool string(const cJSON* p, size_t max, bool nonempty = true) {
  return cJSON_IsString(p) && p->valuestring && strlen(p->valuestring) <= max && (!nonempty || p->valuestring[0]);
}
inline bool number(const cJSON* p) { return cJSON_IsNumber(p) && isfinite(p->valuedouble) && p->valuedouble >= 0 && p->valuedouble <= 9007199254740991.0 && floor(p->valuedouble) == p->valuedouble; }
inline bool equal(const cJSON* p, const char* text) { return cJSON_IsString(p) && !strcmp(p->valuestring, text); }
inline bool unique(const cJSON* p) {
  if (!cJSON_IsObject(p)) return false;
  for (const cJSON* a = p->child; a; a = a->next)
    for (const cJSON* b = a->next; b; b = b->next) if (!strcmp(a->string, b->string)) return false;
  return true;
}
inline bool keys(const cJSON* p, const char* const* names, size_t n) {
  if (!unique(p)) return false;
  for (const cJSON* a = p->child; a; a = a->next) {
    bool known = false;
    for (size_t i = 0; i < n; ++i) if (!strcmp(a->string, names[i])) known = true;
    if (!known) return false;
  }
  return true;
}
inline bool phase(const cJSON* p) {
  const char* values[] = {"ready","listening","processing","speaking","waiting","paused","unavailable","ended"};
  for (auto value : values) if (equal(p, value)) return true;
  return false;
}
inline time_t expiry(const cJSON* p) {
  if (!string(p, 32)) return 0;
  tm parsed = {}; char* end = strptime(p->valuestring, "%Y-%m-%dT%H:%M:%S", &parsed);
  if (!end) return 0;
  if (*end == '.') { ++end; if (*end < '0' || *end > '9') return 0; while (*end >= '0' && *end <= '9') ++end; }
  if (strcmp(end, "Z")) return 0;
  return mktime(&parsed); // setup pins TZ=UTC0 before parsing any credentials
}
inline cJSON* parse(const char* text, size_t size) {
  if (!text || size > 4096 || memchr(text,0,size)) return nullptr;
  unsigned depth=0; bool quoted=false, escaped=false;
  for (size_t i=0;i<size;++i) {
    char c=text[i];
    if (quoted) { if (escaped) escaped=false; else if (c=='\\') escaped=true; else if (c=='"') quoted=false; }
    else if (c=='"') quoted=true;
    else if (c=='{' || c=='[') { if (++depth>24) return nullptr; }
    else if (c=='}' || c==']') { if (!depth) return nullptr; --depth; }
  }
  if (quoted || depth) return nullptr;
  const char* end = nullptr;
  cJSON* root = cJSON_ParseWithLengthOpts(text, size + 1, &end, true);
  return root;
}
inline bool credentialExpiryMatches(const cJSON* value, time_t expected) {
  return expected==0 ? cJSON_IsNull(value) : expected>0 && expiry(value)==expected;
}
// Control-only client: metadata never grants microphone or speaker access.
inline bool grantShape(const cJSON* grant, const cJSON* session) {
  const char* allowed[]={"turnId","generation","leaseId","streamId","language","expiresAt"};
  return keys(grant,allowed,6) && cJSON_GetArraySize(grant)==6 &&
    string(field(grant,"turnId"),100) && string(field(grant,"streamId"),100) &&
    number(field(grant,"generation")) && number(field(session,"generation")) &&
    field(grant,"generation")->valuedouble==field(session,"generation")->valuedouble &&
    string(field(session,"leaseId"),100) && equal(field(grant,"leaseId"),field(session,"leaseId")->valuestring) &&
    (equal(field(grant,"language"),"en") || equal(field(grant,"language"),"de")) &&
    expiry(field(grant,"expiresAt"))>0 && equal(field(session,"phase"),"listening") && cJSON_IsFalse(field(session,"micMuted"));
}
inline bool eventChecked(cJSON* root, ControlPolicy& state, time_t credentialExpiry, bool& heartbeat, const char*& reason, bool acceptAudio=false) {
  reason="envelope";
  const char* names[] = {"protocol_version","event_id","session_id","turn_id","generation","sequence","type","payload"};
  if (!keys(root, names, 8) || cJSON_GetArraySize(root) != 8 || !number(field(root,"protocol_version")) || field(root,"protocol_version")->valuedouble != 1 || !string(field(root,"event_id"),100) || !number(field(root,"generation")) || !number(field(root,"sequence"))) return false;
  auto sid = field(root,"session_id");
  if (!cJSON_IsNull(sid) && !string(sid,100)) return false;
  auto type = field(root,"type"), p = field(root,"payload");
  if (equal(type,"response.text")) { if (!string(field(root,"turn_id"),100)) return false; }
  else if (!cJSON_IsNull(field(root,"turn_id"))) return false;
  reason="sequence";
  if (!unique(p) || !state.sequence(uint64_t(field(root,"sequence")->valuedouble))) return false;
  heartbeat = false;
  if (equal(type,"device.ready")) {
    reason="ready_fields";
    const char* allowed[] = {"mode","deviceId","profileId","language","credentialExpiresAt","audio","camera","textChat","teaching","photoStory","controls"};
    if (state.ready || !keys(p,allowed,11) || !equal(field(p,"mode"),"live")) return false;
    auto language=field(p,"language");
    if(language&&!equal(language,"en")&&!equal(language,"de"))return false;
    strcpy(state.language,language?language->valuestring:"en");
    reason="ready_binding";
    if (!equal(field(p,"deviceId"),"stackchan-alex") || !equal(field(p,"profileId"),"profile-alex") || !credentialExpiryMatches(field(p,"credentialExpiresAt"),credentialExpiry)) return false;
    reason="ready_media";
    if (!cJSON_IsFalse(field(p,"audio")) || !cJSON_IsFalse(field(p,"camera"))) return false;
    reason="ready_controls";
    if (!cJSON_IsArray(field(p,"controls")) || cJSON_GetArraySize(field(p,"controls")) > 9) return false;
    for (cJSON* c = field(p,"controls")->child; c; c=c->next) {
      if (!equal(c,"start") && !equal(c,"stop") && !equal(c,"pause") && !equal(c,"resume") && !equal(c,"mute") && !equal(c,"help") && !equal(c,"text") && !equal(c,"handoff") && !equal(c,"speak")) return false;
      for (cJSON* other=c->next;other;other=other->next) if (equal(other,c->valuestring)) return false;
      if (equal(c,"handoff")) state.handoffSupported=true;
    }
    const char* required[]={"start","stop","pause","resume","mute","help"};
    for (auto name : required) { bool found=false; for (cJSON* c=field(p,"controls")->child;c;c=c->next) if (equal(c,name)) found=true; if (!found) return false; }
    if (field(p,"textChat") && !cJSON_IsBool(field(p,"textChat"))) return false;
    if (field(p,"teaching") && !cJSON_IsBool(field(p,"teaching"))) return false;
    if (field(p,"photoStory") && !cJSON_IsBool(field(p,"photoStory"))) return false;
    state.ready = true; return true;
  }
  reason="before_ready";
  if (!state.ready) return false;
  reason="event_shape";
  if (equal(type,"heartbeat")) { if (!equal(field(p,"mode"),"live")) return false; heartbeat = true; return true; }
  if (equal(type,"state.changed")) {
    reason="state_fields";
    if (!equal(field(p,"mode"),"live")) return false;
    auto s = field(p,"session");
    if (cJSON_IsNull(s)) {
      if (!cJSON_IsNull(sid) || field(root,"generation")->valuedouble!=0) return false;
      state.session[0]=state.owner[0]=state.lease[0]=0; state.ownsEndpoint=true; state.hasGrant=false;
      strcpy(state.phase,"none"); state.generation=0; state.snapshot=true; return true;
    }
    if (!unique(s) || !string(field(s,"id"),100) || !equal(field(s,"mode"),"live") || !phase(field(s,"phase")) || !number(field(s,"generation")) || !number(field(s,"profileRevision")) || !number(field(s,"privacyRevision")) || !number(field(s,"policyRevision")) || !string(field(s,"leaseId"),100) || !cJSON_IsBool(field(s,"micMuted")) || (!equal(field(s,"endpoint"),"robot") && !equal(field(s,"endpoint"),"browser"))) return false;
    reason="state_binding";
    if (!equal(field(s,"profileId"),"profile-alex") || !equal(sid,field(s,"id")->valuestring) || field(root,"generation")->valuedouble != field(s,"generation")->valuedouble) return false;
    reason="state_owner";
    auto owner=field(s,"activeEndpointId");
    if (owner && !string(owner,100)) return false;
    // Legacy snapshots lack an ID. Browser snapshots are always observers here;
    // on a handoff-capable gateway, a missing owner never grants control.
    state.ownsEndpoint=owner ? equal(owner,"stackchan-alex") && equal(field(s,"endpoint"),"robot") : !state.handoffSupported && equal(field(s,"endpoint"),"robot");
    strcpy(state.owner,owner?owner->valuestring:""); strcpy(state.lease,field(s,"leaseId")->valuestring);
    reason="state_capture";
    auto grant=field(s,"captureGrant");
    // A valid grant to another owner is observable metadata, never our permission.
    // This target never negotiated audio and must reject any grant to itself.
    if (!cJSON_IsNull(grant) && (!grantShape(grant,s) ||
        (acceptAudio&&state.ownsEndpoint&&!equal(field(grant,"language"),state.language))||
        (!acceptAudio && (state.ownsEndpoint || !owner || !strcmp(owner->valuestring,"stackchan-alex"))))) return false;
    if(acceptAudio && !strcmp(state.session,field(s,"id")->valuestring) &&
       (field(s,"generation")->valuedouble<double(state.generation)||
        field(s,"profileRevision")->valuedouble<double(state.profileRevision)||
        field(s,"privacyRevision")->valuedouble<double(state.privacyRevision)||
        field(s,"policyRevision")->valuedouble<double(state.policyRevision)))return false;
    state.profileRevision=uint64_t(field(s,"profileRevision")->valuedouble);
    state.privacyRevision=uint64_t(field(s,"privacyRevision")->valuedouble);
    state.policyRevision=uint64_t(field(s,"policyRevision")->valuedouble);
    state.serverMuted=cJSON_IsTrue(field(s,"micMuted"));
    state.hasGrant=state.ownsEndpoint&&!cJSON_IsNull(grant);
    state.grantTurn[0]=state.grantStream[0]=0;state.grantExpires=0;
    if(state.hasGrant) {
      strcpy(state.grantTurn,field(grant,"turnId")->valuestring);
      strcpy(state.grantStream,field(grant,"streamId")->valuestring);
      state.grantExpires=expiry(field(grant,"expiresAt"));
    }
    strcpy(state.session,field(s,"id")->valuestring); strcpy(state.phase,field(s,"phase")->valuestring);
    state.generation=uint64_t(field(s,"generation")->valuedouble); state.snapshot=true;
    if (!strcmp(state.phase,"ended") || !state.ownsEndpoint) state.stop();
    return true;
  }
  if (equal(type,"command.ack")) return equal(field(p,"mode"),"live") && string(field(p,"commandId"),100) && cJSON_IsBool(field(p,"applied"));
  if (equal(type,"error")) {
    auto code=field(p,"code");
    return (equal(code,"UNAUTHORIZED") || equal(code,"FORBIDDEN") || equal(code,"REVISION_CONFLICT") || equal(code,"UNAVAILABLE") || equal(code,"NOT_FOUND") || equal(code,"VALIDATION_ERROR") || equal(code,"SAVE_FAILED")) && string(field(p,"message"),300,false);
  }
  if (equal(type,"response.text")) {
    reason="reply_binding";
    if (!state.ownsEndpoint || !state.session[0] || !equal(sid,state.session) || field(root,"generation")->valuedouble!=double(state.generation)) return false;
    return string(field(p,"turnId"),100) && string(field(p,"text"),2400) && equal(field(root,"turn_id"),field(p,"turnId")->valuestring) && (equal(field(p,"language"),"en") || equal(field(p,"language"),"de")) && (equal(field(p,"source"),"model") || equal(field(p,"source"),"fixed"));
  }
  reason="unsupported_event"; return false;
}
// Commit a mirror/sequence only after the entire message validates. The worker
// never reconciles Stop or replies using a partially rejected server message.
inline bool event(cJSON* root, ControlPolicy& state, time_t credentialExpiry, bool& heartbeat, const char** rejection=nullptr, bool acceptAudio=false) {
  ControlPolicy next=state; bool nextHeartbeat=false; const char* reason="envelope";
  bool valid=eventChecked(root,next,credentialExpiry,nextHeartbeat,reason,acceptAudio);
  if (valid) { state=next; heartbeat=nextHeartbeat; }
  else heartbeat=false;
  if (rejection) *rejection=valid?"ok":reason;
  return valid;
}
} // namespace protocol
