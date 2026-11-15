#include "../lemmi_control/ControlPolicy.h"
#include <cassert>
#include <cstdio>
int main() {
  ControlPolicy s;
  assert(s.stopped && s.muted && !s.start() && !s.ordinary());
  assert(s.micIsMuted(true)&&!s.micIsMuted(false));
  assert(s.sequence(0) && !s.sequence(0) && s.sequence(1) && !s.sequence(0));
  s.ready=true;
  assert(!s.start()); // ready alone, before the first snapshot, cannot start
  s.snapshot=true;
  assert(s.start() && !s.stopped);
  strcpy(s.session,"session-one"); strcpy(s.phase,"ready"); s.generation=7;
  assert(s.ordinary());
  assert(s.micIsMuted(false));s.serverMuted=false;
  assert(!s.micIsMuted(false)&&s.micIsMuted(true));
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
  // Actual regression: Start from an old ended session, then ack/heartbeat
  // arrives before the new ready snapshot. Neither may re-latch local Stop.
  bool localStopped=false;
  if (s.forceLocalStop(false)) localStopped=true; // Start ack, old mirror
  if (s.forceLocalStop(false)) localStopped=true; // heartbeat, old mirror
  assert(!localStopped);
  strcpy(s.phase,"ready");
  if (s.forceLocalStop(true)) localStopped=true;
  assert(!localStopped);
  s.stop(); localStopped=true;
  if (s.forceLocalStop(false)) localStopped=true;
  assert(localStopped); // real local Stop survives a later ack
  localStopped=false; strcpy(s.phase,"ended");
  if (s.forceLocalStop(true)) localStopped=true;
  assert(localStopped); // a fresh ended snapshot still stops locally
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
  ControlPolicy observer;observer.ready=observer.snapshot=true;observer.handoffSupported=true;
  strcpy(observer.session,"observed-session");strcpy(observer.phase,"paused");observer.ownsEndpoint=false;
  assert(observer.canHandoff() && !observer.canResume() && !observer.ordinary());
  assert(observer.forceLocalStop(true) && !observer.start());
  observer.ownsEndpoint=true;
  assert(!observer.canHandoff() && observer.canResume() && observer.stopped);
  observer.stopped=false;assert(observer.ordinary());
  observer.disconnected();assert(!observer.canResume() && !observer.canHandoff() && observer.stopped);
  std::puts("PASS: control Stop latch, stale commands, handshake, watchdog and reconnect");
}
