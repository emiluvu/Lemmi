#include "../presentation/AvatarPresentation.h"
#include <assert.h>
#include <stdio.h>

int main(){
  using P=AvatarPresentation;
  const P::Scope scope={3,5,7,9};
  P p;
  assert(p.avatar()==P::Avatar::Unavailable);
  assert(p.frame(0)==P::Frame::Closed);
  assert(!p.arm(scope,true,true,true));
  const char* names[]={"dog","cat","bunny","bird","lemming"};
  for(int i=0;i<5;i++){
    assert(p.select(names[i],scope,false));
    assert(p.avatar()==static_cast<P::Avatar>(i));
  }
  assert(!p.select("hamster",scope,false));
  assert(p.avatar()==P::Avatar::Unavailable);
  assert(!p.select(nullptr,scope,false));
  assert(p.select("bird",scope,false));
  assert(!p.arm(scope,false,true,true));
  assert(!p.arm(scope,true,false,true));
  assert(!p.arm(scope,true,true,false));
  auto token=p.arm(scope,true,true,true);assert(token);
  assert(p.frame(100)==P::Frame::Closed); // response.start/queue isn't playback
  assert(p.playbackStarted(token,100));assert(p.frame(100)==P::Frame::Open);
  assert(p.frame(280)==P::Frame::Closed);
  p.playbackIdle(token);assert(p.frame(460)==P::Frame::Closed);
  assert(p.playbackStarted(token,500));
  p.invalidate(); // Stop/pause/help/camera/disconnect must use this before cleanup
  assert(!p.playbackStarted(token,600));assert(p.frame(600)==P::Frame::Closed);
  auto newer=p.arm(scope,true,true,true);assert(newer>token);
  p.completed(token);assert(p.current(newer)); // stale end cannot stop new output
  assert(!p.playbackStarted(token,0));
  assert(p.playbackStarted(newer,UINT32_MAX-50));
  assert(p.frame(10)==P::Frame::Open); // monotonic wrap
  p.reconcile(scope,false,true);assert(!p.current(newer));
  for(int field=0;field<4;field++){
    assert(p.select("bunny",scope,false));
    token=p.arm(scope,true,true,true);assert(p.playbackStarted(token,0));
    auto changed=scope;
    if(field==0)changed.generation++;
    if(field==1)changed.profileRevision++;
    if(field==2)changed.privacyRevision++;
    if(field==3)changed.policyRevision++;
    p.reconcile(changed,true,true);
    assert(p.avatar()==P::Avatar::Unavailable);
    assert(!p.playbackStarted(token,1));
  }
  assert(p.select("cat",scope,true));
  token=p.arm(scope,true,true,true);assert(p.playbackStarted(token,0));
  assert(p.frame(0)==P::Frame::Closed&&p.frame(360)==P::Frame::Closed);
  auto old=scope;old.profileRevision--;
  assert(!p.select("dog",old,false));assert(!p.current(token));
  assert(p.avatar()==P::Avatar::Unavailable);
  puts("PASS: five identities, missing/unknown choice, actual-playback gating, stale callbacks, cancellation, revisions, ownership, buffering, static mode and rollover");
}
