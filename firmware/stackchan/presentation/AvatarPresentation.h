#pragma once
#include <stdint.h>
#include <string.h>
#include <limits.h>

// Local presentation policy, NOT a wire schema, authorization or audio driver.
// One serialized owner. Call invalidate before stopping/clearing the audio queue.
class AvatarPresentation {
public:
  enum class Avatar : uint8_t { Dog, Cat, Bunny, Bird, Lemming, Unavailable };
  enum class Frame : uint8_t { Closed, Open };
  struct Scope {
    uint64_t generation, profileRevision, privacyRevision, policyRevision;
  };
  static Avatar parseAvatar(const char* id) {
    if (!id) return Avatar::Unavailable;
    const char* names[]={"dog","cat","bunny","bird","lemming"};
    for(uint8_t i=0;i<5;i++)if(!strcmp(id,names[i]))return static_cast<Avatar>(i);
    return Avatar::Unavailable;
  }
  // Call only after validating assigned profile, server revision, and transport.
  // Caller compares session/lease/turn/stream IDs before using playback callbacks.
  // Unknown choices show unavailable; never silently substitute another animal.
  bool select(const char* id, const Scope& next, bool reduced) {
    invalidate();
    if(hasScope_ && (next.profileRevision<scope_.profileRevision ||
        next.privacyRevision<scope_.privacyRevision || next.policyRevision<scope_.policyRevision)) {
      avatar_=Avatar::Unavailable; return false;
    }
    scope_=next;hasScope_=true;avatar_=parseAvatar(id);reduced_=reduced;
    return avatar_!=Avatar::Unavailable;
  }
  // Pass an already validated current state. Merely being in "speaking" must
  // never open a mouth: output must actually reach the local speaker driver.
  void reconcile(const Scope& next, bool ownsEndpoint, bool outputAllowed) {
    if(!hasScope_ || !same(scope_,next)) {
      invalidate();hasScope_=false;avatar_=Avatar::Unavailable;return;
    }
    if(!ownsEndpoint || !outputAllowed) invalidate();
  }
  // Fresh local epoch binds queued audio callbacks to the accepted output stream.
  // Arm requires explicit current local continuation, capture off, ownership and
  // validated output metadata. It does not grant any of these permissions.
  uint64_t arm(const Scope& scope, bool ownsEndpoint, bool outputAllowed, bool captureOff) {
    invalidate();
    if(exhausted_ || !hasScope_ || !same(scope_,scope) ||
       avatar_==Avatar::Unavailable || !ownsEndpoint || !outputAllowed || !captureOff)return 0;
    armed_=true;return epoch_;
  }
  // Call when the audio driver really starts/resumes consuming this stream.
  bool playbackStarted(uint64_t token,uint32_t now) {
    if(!current(token))return false;
    playing_=true;startedAt_=now;return true;
  }
  // Queue underflow, end, cancel and driver errors close immediately. A fresh
  // playbackStarted is needed after buffering, never just a received chunk.
  void playbackIdle(uint64_t token) { if(current(token))playing_=false; }
  void completed(uint64_t token) { if(current(token))invalidate(); }
  void invalidate() {
    armed_=playing_=false;
    if(epoch_==UINT64_MAX)exhausted_=true;else ++epoch_;
  }
  Frame frame(uint32_t now) const {
    return armed_&&playing_&&!reduced_&&((uint32_t(now-startedAt_)/180)%2==0)
      ?Frame::Open:Frame::Closed;
  }
  Avatar avatar() const { return avatar_; }
  // Independent of mouth frame/reduced motion; true only after the current
  // stream's actual driver callback, cleared on idle/cancel/revision changes.
  bool playbackActive() const { return armed_&&playing_; }
  bool current(uint64_t token) const { return !exhausted_&&armed_&&token!=0&&token==epoch_; }
private:
  static bool same(const Scope& a,const Scope& b) {
    return a.generation==b.generation&&a.profileRevision==b.profileRevision&&
      a.privacyRevision==b.privacyRevision&&a.policyRevision==b.policyRevision;
  }
  Avatar avatar_=Avatar::Unavailable;
  Scope scope_={};
  uint64_t epoch_=0;
  uint32_t startedAt_=0;
  bool hasScope_=false,reduced_=true,armed_=false,playing_=false,exhausted_=false;
};
