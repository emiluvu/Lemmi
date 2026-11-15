#include "../audio/SendScope.h"
#include "../audio/PendingWrite.h"
#include <cassert>
#include <cstdio>

int main(){
  ControlPolicy initial;
  initial.ready=initial.snapshot=initial.ownsEndpoint=initial.hasGrant=true;
  initial.stopped=initial.serverMuted=false;
  strcpy(initial.session,"fictional-session");strcpy(initial.lease,"fictional-lease");
  strcpy(initial.phase,"listening");strcpy(initial.grantTurn,"fictional-turn");
  strcpy(initial.grantStream,"fictional-stream");initial.grantExpires=200;
  lemmi::SendToken capture{3,5,true},receipt{3,5,false};
  auto allowed=[&](const ControlPolicy& now,const lemmi::SendToken& token,uint32_t input=5,bool muted=false){
    return lemmi::currentSendScope(now,initial,&token,1,3,input,false,muted,100);
  };
  assert(allowed(initial,capture));
  for(int reason=0;reason<12;++reason){
    auto now=initial;
    switch(reason){
      case 0:++now.generation;break;
      case 1:++now.profileRevision;break;
      case 2:++now.privacyRevision;break;
      case 3:++now.policyRevision;break;
      case 4:strcpy(now.lease,"replacement");break;
      case 5:strcpy(now.session,"replacement");break;
      case 6:now.ownsEndpoint=false;break;
      case 7:now.hasGrant=false;break;
      case 8:now.grantExpires=100;break;
      case 9:strcpy(now.grantTurn,"replacement");break;
      case 10:strcpy(now.grantStream,"replacement");break;
      case 11:strcpy(now.phase,"paused");break;
    }
    assert(!allowed(now,capture));
    lemmi::PendingWrite pending;
    assert(pending.begin("x",1,0,240));
    unsigned attempts=0;
    assert(pending.step(100,allowed(now,capture),-2,-3,[&](const char*,size_t){
      ++attempts;return lemmi::PendingWrite::Attempt{1,true};
    })==lemmi::PendingWrite::CancelledSafe);
    assert(attempts==0);
  }
  assert(!allowed(initial,capture,6));
  assert(!allowed(initial,capture,5,true));
  auto muted=initial;muted.serverMuted=true;
  assert(!allowed(muted,capture));
  // Mute invalidates the input turn, not truthful receipts for already-approved
  // unrelated playback. Stop/epoch/revisions still invalidate either kind.
  assert(allowed(muted,receipt,6,true));
  assert(!lemmi::currentSendScope(initial,initial,&receipt,1,4,6,false,true,100));
  assert(!lemmi::currentSendScope(initial,initial,&receipt,1,3,5,true,false,100));
  puts("PASS: queued send revision/grant/owner/Stop invalidation and independent mute tokens");
}
