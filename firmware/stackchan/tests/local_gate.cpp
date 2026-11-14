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
}
