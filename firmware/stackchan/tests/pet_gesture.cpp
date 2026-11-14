#include "../lemmi_petting/PetGesture.h"
#include <cassert>
#include <cstdio>
void release(PetGesture& g, uint32_t at) {
  assert(!g.update(0, true, at)); assert(!g.update(0, true, at + 150));
}
bool stroke(PetGesture& g, uint32_t at, bool reverse = false) {
  assert(!g.update(reverse ? 4 : 1, true, at));
  assert(!g.update(2, true, at + 100));
  return g.update(reverse ? 1 : 4, true, at + 200);
}
int main() {
  assert(petZoneMask(0x03) == 4 && petZoneMask(0x0c) == 2 && petZoneMask(0x30) == 1);
  assert(petZoneMask(0x3f) == 7 && petZoneMask(0) == 0);
  PetGesture g;
  assert(!stroke(g, 0)); // held/boot touch does not start armed
  release(g, 300);
  assert(stroke(g, 500));
  for (uint32_t t = 701; t < 2000; t += 20) assert(!g.update(4, true, t));
  release(g, 2100); assert(stroke(g, 2300, true));
  release(g, 2600); assert(!stroke(g, 2800)); // cooldown
  g.reset(); release(g, 4200);
  assert(!g.update(7, true, 4400)); // all-zone contact is not a stroke
  assert(!stroke(g, 4500));
  release(g, 4800);
  assert(!g.update(1, true, 5000)); assert(!g.update(2, true, 5001));
  assert(!g.update(4, true, 5002)); // transient noise cannot complete a pet
  release(g, 5200);
  assert(!g.update(1, true, 5400)); assert(!g.update(2, false, 5500));
  assert(!g.update(4, true, 5600)); // suppression clears in-progress gesture
  release(g, 5700);
  assert(!g.update(1, true, 5900)); assert(!g.update(2, true, 7301));
  assert(!g.update(4, true, 7401)); // excessive inter-zone gap
  PetGesture overlap;
  release(overlap, 0);
  assert(!overlap.update(3, true, 200)); // front and middle overlap at entry
  assert(overlap.update(6, true, 260)); // fast sweep into back
  for (uint32_t t = 261; t < 2000; t += 20) assert(!overlap.update(7, true, t));
  release(overlap, 2000);
  assert(!overlap.update(6, true, 2200));
  assert(overlap.update(3, true, 2260)); // reverse overlap
  PetGesture broad;
  release(broad, 0);
  assert(!broad.update(7, true, 200));
  assert(!broad.update(7, true, 600)); // no response to broad stationary touch
  PetGesture wrap;
  release(wrap, 0xfffffe00u);
  assert(stroke(wrap, 0xffffff80u)); // unsigned elapsed across rollover
  std::puts("PASS: strokes, release, cooldown, suppression, noise and rollover");
}
