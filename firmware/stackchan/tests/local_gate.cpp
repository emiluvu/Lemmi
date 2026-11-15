#include "../lemmi_feasibility/LocalGate.h"
#include <cassert>
int main() {
  LocalGate g;
  assert(g.muted && g.mode == LocalGate::Ready);
  assert(!g.enter(LocalGate::Camera, 0));
  assert(!g.enter(LocalGate::Microphone, 0));
  assert(g.enter(LocalGate::Requested, 0));
  assert(!g.enter(LocalGate::Tone, 0));
  assert(!g.enter(LocalGate::Camera, 30000));
  g.stop(); g.ready();
  assert(g.enter(LocalGate::Requested, 1));
  assert(g.enter(LocalGate::Camera, 2));
  auto old = g.generation;
  assert(g.accepts(old));
  assert(!g.expired(15001) && g.expired(15002));
  g.stop(); g.muted = false;
  assert(g.mode == LocalGate::Stopped && !g.accepts(old));
  assert(!g.enter(LocalGate::Microphone, 3));
  assert(!g.enter(LocalGate::Camera, 3)); // delayed Allow after Stop
  assert(!g.enter(LocalGate::Tone, 3));
  g.ready(); assert(g.enter(LocalGate::Microphone, 0xfffffff0u));
  assert(!g.expired(0x10u) && g.expired(0x1400u));
  assert(!g.enter(LocalGate::Requested, 1));
  g.stop();g.ready();
  assert(g.enter(LocalGate::Tone,100));
  const auto tone=g.generation;
  assert(!g.toneTestActive(100)); // initialization/failed submission is not blue
  assert(g.acceptTone(tone,1500)); // slow initialization must not spend playback time
  assert(g.toneTestActive(1500)&&g.toneTestActive(2499));
  assert(!g.acceptTone(tone,2000)); // duplicate cannot extend the test
  assert(!g.toneTestActive(2500)&&g.expired(2500));
  g.stop();assert(!g.toneTestActive(2000)&&!g.acceptTone(tone,2000));
  g.ready();assert(g.enter(LocalGate::Requested,2600));
  assert(g.enter(LocalGate::Camera,2601));
  assert(!g.acceptTone(tone,2602)&&!g.toneTestActive(2602));
  g.stop();g.ready();assert(g.enter(LocalGate::Tone,0xfffffff0u));
  assert(g.acceptTone(g.generation,0xfffffff0u));
  assert(g.toneTestActive(0x10u)&&!g.toneTestActive(0x400u));
}
