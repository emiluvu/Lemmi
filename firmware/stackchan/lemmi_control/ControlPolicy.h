#pragma once
#include <stdint.h>
#include <string.h>

// Local restrictions plus a participant-safe mirror, never a second authority.
struct ControlPolicy {
  bool stopped = true, muted = true, ready = false, snapshot = false;
  bool ownsEndpoint = true, handoffSupported = false;
  char session[101] = {};
  char owner[101] = {}, lease[101] = {};
  char phase[16] = "none";
  char language[3] = "en";
  uint8_t outputWindowChunks=4;
  uint64_t generation = 0, serverSequence = 0;
  uint64_t profileRevision = 0, privacyRevision = 0, policyRevision = 0;
  bool audioSupported = false, serverMuted = true, hasGrant = false;
  char grantTurn[101] = {}, grantStream[101] = {};
  int64_t grantExpires = 0;
  bool seenSequence = false;
  uint32_t heartbeatAt = 0;
  void disconnected() {
    stopped = true; ready = snapshot = seenSequence = false;
    audioSupported=false; hasGrant=false; serverMuted=true;
    strcpy(language,"en");
    outputWindowChunks=4;
    grantTurn[0]=grantStream[0]=0; grantExpires=0;
    session[0] = owner[0] = lease[0] = 0; ownsEndpoint=true; handoffSupported=false; strcpy(phase, "none"); generation = 0;
  }
  void stop() { stopped = true; }
  bool sequence(uint64_t next) {
    if (seenSequence && next <= serverSequence) return false;
    seenSequence = true; serverSequence = next; return true;
  }
  bool start() {
    if (!ready || !snapshot || (session[0] && strcmp(phase, "ended"))) return false;
    stopped = false; return true;
  }
  bool active() const { return ready && snapshot && session[0] && strcmp(phase,"ended"); }
  bool micIsMuted(bool local)const{return local||(active()&&serverMuted);}
  bool ordinary() const { return active() && ownsEndpoint && !stopped; }
  bool canResume() const { return active() && ownsEndpoint && !strcmp(phase,"paused"); }
  bool canHandoff() const { return active() && handoffSupported && !ownsEndpoint; }
  bool canPause() const { return active() && !stopped; }
  // An ack/heartbeat still carries our old mirror between Start and its new
  // snapshot. Only a received ended snapshot can impose a server-side Stop.
  bool forceLocalStop(bool receivedStateSnapshot) const { return receivedStateSnapshot && snapshot && (!strcmp(phase,"ended") || !ownsEndpoint); }
  bool currentCommand(uint32_t queuedEpoch, uint32_t epoch, const char* id, uint64_t gen, bool unbound) const {
    return queuedEpoch == epoch && ready && snapshot && (unbound || (!strcmp(id,session) && gen == generation));
  }
  bool watchdog(uint32_t now) const { return ready && uint32_t(now - heartbeatAt) >= 6000; }
};

// Worker-owned Stop reconciliation. An already-sent Start may create a session
// after local Stop, so keep the intent until a current ended/empty snapshot.
struct StopIntent {
  bool startInFlight=false, sent=false, awaitingSnapshot=false;
  unsigned attempts=0;
  uint32_t epoch=0;
  void changedEpoch(uint32_t next) {
    if (next!=epoch) { epoch=next; sent=false; attempts=0; awaitingSnapshot=false; }
  }
  void stateChanged(const ControlPolicy& state) {
    if (state.session[0] && strcmp(state.phase,"ended")) startInFlight=false;
    awaitingSnapshot=false;
  }
  void rejected(bool matchingStart, bool matchingStopRevision) {
    if (matchingStart) startInFlight=false;
    if (matchingStopRevision) { sent=false; awaitingSnapshot=true; }
  }
  bool canSend(const ControlPolicy& state) const {
    return state.ready && state.snapshot && state.session[0] && strcmp(state.phase,"ended") && !sent && !awaitingSnapshot;
  }
  bool markSent() { sent=true; return ++attempts<=3; }
  bool complete(const ControlPolicy& state) const {
    return state.snapshot && !startInFlight && (!state.session[0] || !strcmp(state.phase,"ended"));
  }
};
