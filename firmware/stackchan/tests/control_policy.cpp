#include "../lemmi_control/ControlPolicy.h"
#include <cassert>
#include <cstdio>
int main() {
  ControlPolicy s;
  assert(s.stopped && s.muted && !s.start() && !s.ordinary());
  assert(s.sequence(0) && !s.sequence(0) && s.sequence(1) && !s.sequence(0));
  s.ready=true;
  assert(!s.start()); // ready alone, before the first snapshot, cannot start
  s.snapshot=true;
  assert(s.start() && !s.stopped);
  strcpy(s.session,"session-one"); strcpy(s.phase,"ready"); s.generation=7;
  assert(s.ordinary());
  assert(s.currentCommand(3,3,"session-one",7,false));
  assert(!s.currentCommand(2,3,"session-one",7,false)); // Stop invalidates queued input
  assert(!s.currentCommand(3,3,"old-session",7,false));
  assert(!s.currentCommand(3,3,"session-one",6,false));
  assert(!s.start()); // start cannot silently replace a current session
  s.stop(); s.muted=false;
  strcpy(s.phase,"ready"); // late ready snapshot/ack cannot clear Stop
  assert(s.stopped && !s.ordinary());
  strcpy(s.phase,"paused"); assert(!s.start());
  strcpy(s.phase,"ended"); assert(s.start()); // explicit new session only
  s.heartbeatAt=0xfffffff0u;
  assert(!s.watchdog(0x10u) && s.watchdog(0x1800u));
  s.disconnected();
  assert(s.stopped && !s.ready && !s.snapshot && !s.start());
  assert(!s.currentCommand(3,3,"",0,true));
  assert(s.sequence(0)); // new connection has a fresh server sequence
  StopIntent pending; ControlPolicy mirror; mirror.ready=mirror.snapshot=true;
  pending.startInFlight=true;
  pending.changedEpoch(1);
  assert(!pending.complete(mirror)); // Stop must wait for an already-sent Start
  pending.rejected(false,false); // unrelated late error cannot erase the intent
  assert(pending.startInFlight && !pending.complete(mirror));
  strcpy(mirror.session,"new-session"); strcpy(mirror.phase,"ready");
  pending.stateChanged(mirror);
  assert(pending.canSend(mirror) && pending.markSent() && !pending.canSend(mirror));
  pending.rejected(false,true);
  assert(!pending.canSend(mirror)); // wait for a reconciled generation before retry
  mirror.generation=1; pending.stateChanged(mirror);
  assert(pending.canSend(mirror) && pending.markSent());
  strcpy(mirror.phase,"ended"); pending.stateChanged(mirror);
  assert(pending.complete(mirror));
  pending.changedEpoch(2); assert(pending.attempts==0);
  pending.startInFlight=true; pending.rejected(true,false);
  assert(!pending.startInFlight);
  assert(pending.markSent() && pending.markSent() && pending.markSent() && !pending.markSent());
  std::puts("PASS: control Stop latch, stale commands, handshake, watchdog and reconnect");
}
