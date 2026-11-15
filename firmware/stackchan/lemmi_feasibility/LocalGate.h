#pragma once
#include <stdint.h>

// UI task owns this gate. Workers receive a generation, never permission to restart.
struct LocalGate {
  enum Mode { Ready, Stopped, Requested, Camera, Microphone, Tone, Closing };
  Mode mode = Ready;
  bool muted = true;
  uint32_t generation = 0;
  uint32_t since = 0;
  uint32_t limit = 0;
  bool toneAccepted = false;
  bool enter(Mode next, uint32_t now) {
    if (mode == Ready && (next == Requested || next == Tone || (next == Microphone && !muted))) {
      mode = next; since = now; ++generation; toneAccepted = false;
      limit = next == Requested ? 30000 : next == Microphone ? 5000 : 1000;
      return true;
    }
    if (mode == Requested && next == Camera && !expired(now)) {
      mode = next; since = now; limit = 15000; ++generation; return true;
    }
    return false;
  }
  bool expired(uint32_t now) const { return limit && uint32_t(now - since) >= limit; }
  // Offline generated-tone test only, after successful local driver submission.
  // This is a bounded test indicator, not proof/receipt of audible live speech.
  bool acceptTone(uint32_t token, uint32_t now) {
    if(mode!=Tone||token!=generation||toneAccepted)return false;
    toneAccepted=true;since=now;return true;
  }
  bool toneTestActive(uint32_t now) const {return mode==Tone&&toneAccepted&&!expired(now);}
  void stop() { mode = Stopped; limit = 0; ++generation; }
  void ready() { if (mode == Stopped) { mode = Ready; ++generation; } }
  bool accepts(uint32_t token) const { return mode == Camera && token == generation; }
};
