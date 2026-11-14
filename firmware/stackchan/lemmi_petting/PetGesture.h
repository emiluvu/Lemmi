#pragma once
#include <stdint.h>

// Physical front/middle/back bit order, following the vendor BSP's reversal.
inline uint8_t petZoneMask(uint8_t raw) {
  uint8_t mask = 0;
  for (int zone = 0; zone < 3; ++zone) {
    if ((raw >> (2 * (2 - zone))) & 3) mask |= uint8_t(1 << zone);
  }
  return mask;
}

// Pure local stroke recognizer. No sensor, consent, session or media actions.
// Tolerates overlapping electrodes and fast/slow strokes. A fresh release,
// ordered progress and a minimum total contact time still reject brief noise.
class PetGesture {
public:
  bool update(uint8_t mask, bool allowed, uint32_t now) {
    mask &= 7;
    if (!allowed) { reset(); return false; }
    if (mask == 0) {
      if (!releasing_) { releaseAt_ = now; releasing_ = true; }
      if (uint32_t(now - releaseAt_) >= 100) { armed_ = true; phase_ = 0; }
      return false;
    }
    releasing_ = false;
    if (!armed_ || (hasAck_ && uint32_t(now - ackAt_) < 1200)) return false;
    if (!phase_) {
      // An overlapping end+middle reading may start a stroke. Middle-only or
      // all-zones-at-once contact must be released before trying again.
      if ((mask & 5) != 1 && (mask & 5) != 4) { armed_ = false; return false; }
      target_ = mask & 1 ? 4 : 1;
      phase_ = mask & 2 ? 2 : 1;
      startAt_ = now; return false;
    }
    const uint32_t elapsed = now - startAt_;
    if (elapsed > 1400) { armed_ = false; phase_ = 0; return false; }
    if (phase_ == 1 && (mask & 2)) phase_ = 2;
    if (phase_ == 2 && (mask & target_) && elapsed >= 60) {
      armed_ = false; phase_ = 0; ackAt_ = now; hasAck_ = true;
      return true;
    }
    return false;
  }
  void reset() { armed_ = false; releasing_ = false; phase_ = 0; }
private:
  bool armed_ = false, releasing_ = false, hasAck_ = false;
  uint8_t phase_ = 0, target_ = 0;
  uint32_t releaseAt_ = 0, startAt_ = 0, ackAt_ = 0;
};
