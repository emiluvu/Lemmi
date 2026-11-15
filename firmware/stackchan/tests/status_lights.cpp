#include "../presentation/StatusLights.h"
#include "../presentation/AvatarPresentation.h"
#include <assert.h>
#include <stdio.h>
int main() {
  using namespace StatusLights;
  assert(choose(false,false,false,false)==Color::Off);
  assert(choose(false,false,false,true)==Color::Pink);
  for(int pet=0;pet<2;++pet)for(int mic=0;mic<2;++mic)for(int speech=0;speech<2;++speech) {
    assert(choose(false,mic,speech,pet,true)==Color::Yellow);
    assert(choose(true,mic,speech,pet,true)==Color::Off);
  }
  assert(choose(false,false,false,false,false)==Color::Off); // request/start/end are not active
  // A pet cannot hide capture or speech. Stop dominates every combination.
  for(int pet=0;pet<2;++pet) {
    assert(choose(false,true,false,pet)==Color::Green);
    assert(choose(false,false,true,pet)==Color::Blue);
    assert(choose(false,true,true,pet)==Color::Green);
    for(int mic=0;mic<2;++mic)for(int speech=0;speech<2;++speech)
      assert(choose(true,mic,speech,pet)==Color::Off);
  }
  AvatarPresentation p;
  const AvatarPresentation::Scope scope={1,1,1,1};
  assert(p.select("lemming",scope,true)); // static mouth still shows speech light
  const auto token=p.arm(scope,true,true,true);
  assert(token&&!p.playbackActive()); // queued/authorized is not audible
  assert(p.playbackStarted(token,0));
  assert(p.frame(0)==AvatarPresentation::Frame::Closed);
  assert(choose(false,false,p.playbackActive(),true)==Color::Blue);
  p.playbackIdle(token);
  assert(choose(false,false,p.playbackActive(),true)==Color::Pink);
  assert(p.playbackStarted(token,1));
  p.completed(token);
  assert(!p.playbackActive()&&!p.playbackStarted(token,2));
  const auto next=p.arm(scope,true,true,true);
  assert(next&&p.playbackStarted(next,3));
  p.invalidate(); // Stop/disconnect/watchdog/revision cancellation
  assert(!p.playbackActive()&&!p.playbackStarted(next,4));
  assert(choose(false,false,p.playbackActive(),false)==Color::Off);
  puts("PASS: light priority, actual playback, static mode, buffering and stale callbacks");
}
