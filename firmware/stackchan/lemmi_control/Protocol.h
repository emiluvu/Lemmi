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
// Only consume safe control fields; unsupported media grants close the connection.
// Additional participant state fields are bounded by the outer 4KiB limit.
inline bool event(cJSON* root, ControlPolicy& state, time_t credentialExpiry, bool& heartbeat) {
  const char* names[] = {"protocol_version","event_id","session_id","turn_id","generation","sequence","type","payload"};
  if (!keys(root, names, 8) || cJSON_GetArraySize(root) != 8 || !number(field(root,"protocol_version")) || field(root,"protocol_version")->valuedouble != 1 || !string(field(root,"event_id"),100) || !number(field(root,"generation")) || !number(field(root,"sequence"))) return false;
  auto sid = field(root,"session_id");
  if (!cJSON_IsNull(sid) && !string(sid,100)) return false;
  auto type = field(root,"type"), p = field(root,"payload");
  if (equal(type,"response.text")) { if (!string(field(root,"turn_id"),100)) return false; }
  else if (!cJSON_IsNull(field(root,"turn_id"))) return false;
  if (!unique(p) || !state.sequence(uint64_t(field(root,"sequence")->valuedouble))) return false;
  heartbeat = false;
  if (equal(type,"device.ready")) {
    const char* allowed[] = {"mode","deviceId","profileId","credentialExpiresAt","audio","camera","textChat","controls"};
    if (state.ready || !keys(p,allowed,8) || !equal(field(p,"mode"),"live") || !equal(field(p,"deviceId"),"stackchan-alex") || !equal(field(p,"profileId"),"profile-alex") || !cJSON_IsFalse(field(p,"audio")) || !cJSON_IsFalse(field(p,"camera")) || expiry(field(p,"credentialExpiresAt")) != credentialExpiry || !cJSON_IsArray(field(p,"controls")) || cJSON_GetArraySize(field(p,"controls")) > 7) return false;
    for (cJSON* c = field(p,"controls")->child; c; c=c->next) {
      if (!equal(c,"start") && !equal(c,"stop") && !equal(c,"pause") && !equal(c,"resume") && !equal(c,"mute") && !equal(c,"help") && !equal(c,"text")) return false;
    }
    const char* required[]={"start","stop","pause","resume","mute","help"};
    for (auto name : required) { bool found=false; for (cJSON* c=field(p,"controls")->child;c;c=c->next) if (equal(c,name)) found=true; if (!found) return false; }
    if (field(p,"textChat") && !cJSON_IsBool(field(p,"textChat"))) return false;
    state.ready = true; return true;
  }
  if (!state.ready) return false;
  if (equal(type,"heartbeat")) { if (!equal(field(p,"mode"),"live")) return false; heartbeat = true; return true; }
  if (equal(type,"state.changed")) {
    if (!equal(field(p,"mode"),"live")) return false;
    auto s = field(p,"session");
    if (cJSON_IsNull(s)) { state.session[0]=0; strcpy(state.phase,"none"); state.generation=0; state.snapshot=true; return true; }
    if (!unique(s) || !string(field(s,"id"),100) || !equal(field(s,"profileId"),"profile-alex") || !equal(field(s,"mode"),"live") || !phase(field(s,"phase")) || !number(field(s,"generation")) || !number(field(s,"profileRevision")) || !number(field(s,"privacyRevision")) || !number(field(s,"policyRevision")) || !string(field(s,"leaseId"),100) || !cJSON_IsBool(field(s,"micMuted")) || !cJSON_IsNull(field(s,"captureGrant")) || (!equal(field(s,"endpoint"),"robot") && !equal(field(s,"endpoint"),"browser")) || !equal(sid,field(s,"id")->valuestring) || field(root,"generation")->valuedouble != field(s,"generation")->valuedouble) return false;
    strcpy(state.session,field(s,"id")->valuestring); strcpy(state.phase,field(s,"phase")->valuestring);
    state.generation=uint64_t(field(s,"generation")->valuedouble); state.snapshot=true;
    if (!strcmp(state.phase,"ended")) state.stop();
    // A server snapshot never unmutes or clears a local Stop.
    return true;
  }
  if (equal(type,"command.ack")) return equal(field(p,"mode"),"live") && string(field(p,"commandId"),100) && cJSON_IsBool(field(p,"applied"));
  if (equal(type,"error")) {
    auto code=field(p,"code");
    return (equal(code,"UNAUTHORIZED") || equal(code,"FORBIDDEN") || equal(code,"REVISION_CONFLICT") || equal(code,"UNAVAILABLE") || equal(code,"NOT_FOUND") || equal(code,"VALIDATION_ERROR") || equal(code,"SAVE_FAILED")) && string(field(p,"message"),300,false);
  }
  // Control-only UI deliberately does not request text or render model replies.
  // Validate an unsolicited reply's bounded shape, then discard it in RAM.
  if (equal(type,"response.text")) return string(field(p,"turnId"),100) && string(field(p,"text"),600) && equal(field(root,"turn_id"),field(p,"turnId")->valuestring) && (equal(field(p,"language"),"en") || equal(field(p,"language"),"de")) && (equal(field(p,"source"),"model") || equal(field(p,"source"),"fixed"));
  return false;
}
} // namespace protocol
