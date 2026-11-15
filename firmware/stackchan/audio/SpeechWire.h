#pragma once
#include "PlaybackWindow.h"
#include "../lemmi_control/Protocol.h"

namespace speechwire {
// Canonical base64, no whitespace/alternate encodings, fixed output bound.
inline int digit(char c) {
  if(c>='A'&&c<='Z')return c-'A';
  if(c>='a'&&c<='z')return c-'a'+26;
  if(c>='0'&&c<='9')return c-'0'+52;
  return c=='+'?62:c=='/'?63:-1;
}
inline size_t decode(const char* value,uint8_t* out,size_t capacity) {
  if(!value||!out)return 0;
  size_t n=strlen(value),used=0; if(!n||n%4||n>2560)return 0;
  for(size_t i=0;i<n;i+=4) {
    int a=digit(value[i]),b=digit(value[i+1]);
    bool cpad=value[i+2]=='=',dpad=value[i+3]=='=';
    int c=cpad?0:digit(value[i+2]),d=dpad?0:digit(value[i+3]);
    size_t bytes=cpad?1:dpad?2:3;
    if(a<0||b<0||c<0||d<0||(cpad&&!dpad)||((cpad||dpad)&&i+4!=n)||
       (cpad&&(b&15))||(!cpad&&dpad&&(c&3))||used+bytes>capacity)return 0;
    out[used++]=uint8_t((a<<2)|(b>>4));
    if(bytes>1)out[used++]=uint8_t((b<<4)|(c>>2));
    if(bytes>2)out[used++]=uint8_t((c<<6)|d);
  }
  return used;
}
inline bool rate(const cJSON* p) {
  return protocol::number(p)&&(p->valuedouble==16000||p->valuedouble==22050||p->valuedouble==24000||p->valuedouble==44100||p->valuedouble==48000);
}
inline bool readyAudio(const cJSON* p) {
  using namespace protocol;
  const char* keysA[]={"encoding","sampleRate","channels","frameMs","maxCaptureMs","playback","outputWindowChunks"};
  const char* keysP[]={"encoding","channels","sampleRates","outputWindowChunks"};
  auto playback=field(p,"playback"),rates=field(playback,"sampleRates");
  if(!keys(p,keysA,7)||cJSON_GetArraySize(p)!=7||!equal(field(p,"encoding"),"pcm_s16le")||
     !number(field(p,"sampleRate"))||field(p,"sampleRate")->valuedouble!=16000||
     !number(field(p,"channels"))||field(p,"channels")->valuedouble!=1||
     !number(field(p,"frameMs"))||field(p,"frameMs")->valuedouble!=20||
     !number(field(p,"maxCaptureMs"))||field(p,"maxCaptureMs")->valuedouble!=20000||
     !number(field(p,"outputWindowChunks"))||(field(p,"outputWindowChunks")->valuedouble!=4&&field(p,"outputWindowChunks")->valuedouble!=12)||
     !keys(playback,keysP,4)||!equal(field(playback,"encoding"),"pcm_s16le")||
     !number(field(playback,"channels"))||field(playback,"channels")->valuedouble!=1||
     !cJSON_IsArray(rates)||cJSON_GetArraySize(rates)<1||cJSON_GetArraySize(rates)>5)return false;
  auto window=field(playback,"outputWindowChunks");
  if(window&&(!number(window)||(window->valuedouble!=4&&window->valuedouble!=12)))return false;
  for(auto r=rates->child;r;r=r->next) {
    if(!rate(r))return false;
    for(auto next=r->next;next;next=next->next)if(cJSON_IsNumber(next)&&r->valuedouble==next->valuedouble)return false;
  }
  return true;
}
enum Kind : uint8_t { Start, Chunk, End, Cancel };
struct Output {
  Kind kind;
  uint32_t localEpoch;
  uint64_t generation,profileRevision,privacyRevision,policyRevision;
  char session[101],turn[101],lease[101],stream[101];
  lemmi::PlaybackWindow::Format format;
  uint16_t index,count,bytes;
  uint8_t outputWindowChunks;
  uint8_t pcm[1920];
};
inline bool output(cJSON* root,const ControlPolicy& s,Output& out) {
  using namespace protocol;
  const char* base[]={"protocol_version","event_id","session_id","turn_id","generation","sequence","type","payload"};
  auto p=field(root,"payload"),type=field(root,"type");
  const bool cancelling=equal(type,"response.cancel");
  if(!s.audioSupported||!s.ready||!s.snapshot||(!cancelling&&(!s.active()||!s.ownsEndpoint))||!keys(root,base,8)||cJSON_GetArraySize(root)!=8||
     !number(field(root,"protocol_version"))||field(root,"protocol_version")->valuedouble!=1||
     !string(field(root,"event_id"),100)||!equal(field(root,"session_id"),s.session)||
     !number(field(root,"generation"))||field(root,"generation")->valuedouble!=double(s.generation)||
     !number(field(root,"sequence"))||!string(field(root,"turn_id"),100)||!unique(p)||
     !string(field(p,"leaseId"),100)||(!cancelling&&!equal(field(p,"leaseId"),s.lease))||!string(field(p,"streamId"),100))return false;
  out={}; out.generation=s.generation; out.profileRevision=s.profileRevision;
  out.privacyRevision=s.privacyRevision; out.policyRevision=s.policyRevision;
  out.outputWindowChunks=s.outputWindowChunks;
  strcpy(out.session,s.session); strcpy(out.turn,field(root,"turn_id")->valuestring);
  strcpy(out.lease,field(p,"leaseId")->valuestring); strcpy(out.stream,field(p,"streamId")->valuestring);
  if(equal(type,"response.start")) {
    const char* names[]={"turnId","leaseId","streamId","encoding","channels","sampleRate","chunkBytes","chunkCount","byteLength"};
    if(!keys(p,names,9)||cJSON_GetArraySize(p)!=9||!equal(field(p,"turnId"),out.turn)||
       !equal(field(p,"encoding"),"pcm_s16le")||!number(field(p,"channels"))||field(p,"channels")->valuedouble!=1||
       !rate(field(p,"sampleRate"))||!number(field(p,"chunkBytes"))||field(p,"chunkBytes")->valuedouble>1920||
       !number(field(p,"chunkCount"))||field(p,"chunkCount")->valuedouble>1501||
       !number(field(p,"byteLength"))||field(p,"byteLength")->valuedouble>2880000)return false;
    out.kind=Start;
    out.format={uint32_t(field(p,"sampleRate")->valuedouble),uint32_t(field(p,"byteLength")->valuedouble),uint16_t(field(p,"chunkBytes")->valuedouble),uint16_t(field(p,"chunkCount")->valuedouble)};
    return lemmi::PlaybackWindow::validFormat(out.format);
  }
  if(equal(type,"audio.chunk")) {
    const char* names[]={"leaseId","streamId","chunkIndex","encoding","data"};
    if(!keys(p,names,5)||cJSON_GetArraySize(p)!=5||!equal(field(p,"encoding"),"pcm_s16le")||
       !number(field(p,"chunkIndex"))||field(p,"chunkIndex")->valuedouble>1500||!string(field(p,"data"),2560))return false;
    out.kind=Chunk; out.index=uint16_t(field(p,"chunkIndex")->valuedouble);
    out.bytes=decode(field(p,"data")->valuestring,out.pcm,sizeof(out.pcm));
    return out.bytes&&out.bytes%2==0;
  }
  if(equal(type,"audio.end")) {
    const char* names[]={"leaseId","streamId","chunkCount"};
    if(!keys(p,names,3)||cJSON_GetArraySize(p)!=3||!number(field(p,"chunkCount"))||field(p,"chunkCount")->valuedouble<1||field(p,"chunkCount")->valuedouble>1501)return false;
    out.kind=End; out.count=uint16_t(field(p,"chunkCount")->valuedouble); return true;
  }
  if(equal(type,"response.cancel")) {
    const char* names[]={"leaseId","streamId","reason"};
    out.kind=Cancel;return keys(p,names,3)&&cJSON_GetArraySize(p)==3&&equal(field(p,"reason"),"interrupted");
  }
  return false;
}

inline bool event(cJSON* root,ControlPolicy& state,time_t expiry,bool& heartbeat,
                  Output& out,bool& hasOutput,const char** rejection) {
  using namespace protocol;
  auto type=field(root,"type"),p=field(root,"payload");
  hasOutput=false;
  if(equal(type,"device.ready")) {
    if(!unique(p)){if(rejection)*rejection="ready_fields";return false;}
    auto audio=field(p,"audio"); bool negotiated=readyAudio(audio);
    if(!negotiated&&!cJSON_IsFalse(audio)){if(rejection)*rejection="ready_media";return false;}
    if(!negotiated)return protocol::event(root,state,expiry,heartbeat,rejection,true);
    // Reuse the control handshake validator; only this opt-in wrapper validates
    // and accepts a real audio descriptor. Restore the original JSON afterward.
    auto saved=cJSON_DetachItemFromObjectCaseSensitive(p,"audio");
    cJSON_AddFalseToObject(p,"audio");
    bool ok=protocol::event(root,state,expiry,heartbeat,rejection,true);
    cJSON_DeleteItemFromObjectCaseSensitive(p,"audio");cJSON_AddItemToObject(p,"audio",saved);
    if(ok){state.audioSupported=true;state.outputWindowChunks=uint8_t(field(saved,"outputWindowChunks")->valuedouble);}
    return ok;
  }
  if(equal(type,"response.start")||equal(type,"audio.chunk")||equal(type,"audio.end")||equal(type,"response.cancel")) {
    ControlPolicy next=state;
    if(!output(root,state,out)||!next.sequence(uint64_t(field(root,"sequence")->valuedouble))){if(rejection)*rejection="reply_binding";return false;}
    state=next;heartbeat=false;hasOutput=true;return true;
  }
  return protocol::event(root,state,expiry,heartbeat,rejection,state.audioSupported);
}
} // namespace speechwire
