#pragma once
#include "../lemmi_control/ControlPolicy.h"
#include <stddef.h>

namespace lemmi {
struct SendToken {uint32_t epoch,input;bool capture;};
inline bool currentSendScope(const ControlPolicy& state,const ControlPolicy& expected,
                             const SendToken* tokens,size_t count,uint32_t epoch,uint32_t input,
                             bool stopped,bool muted,int64_t utc){
  if(stopped||!state.ordinary()||strcmp(state.session,expected.session)||
     state.generation!=expected.generation||strcmp(state.lease,expected.lease)||
     state.profileRevision!=expected.profileRevision||state.privacyRevision!=expected.privacyRevision||
     state.policyRevision!=expected.policyRevision||!strcmp(state.phase,"paused"))return false;
  for(size_t i=0;i<count;++i){
    const auto& token=tokens[i];
    if(token.epoch!=epoch)return false;
    if(token.capture&&(muted||state.serverMuted||token.input!=input||!state.hasGrant||
       state.grantExpires<=utc||strcmp(state.grantTurn,expected.grantTurn)||
       strcmp(state.grantStream,expected.grantStream)))return false;
  }
  return true;
}
}
