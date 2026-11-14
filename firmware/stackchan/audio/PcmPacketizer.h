#pragma once
#include <stddef.h>
#include <stdint.h>
#include <string.h>

namespace lemmi {

// Fixed-size zeroing also runs on cancellation/destruction. This covers this
// object's memory, not SDK/DMA buffers or copies owned by a future transport.
inline void wipePcm(void* memory, size_t bytes) {
  volatile uint8_t* p = static_cast<volatile uint8_t*>(memory);
  while (bytes--) *p++ = 0;
}

// Byte framing only: no capture, clock, network, serialization or authorization.
// Single owner; callers must serialize capture/control access. A local epoch is
// not a server generation, capture grant or output lease.
class PcmPacketizer {
public:
  enum : size_t { SampleRate = 16000, Channels = 1, FrameMs = 20,
                 SamplesPerFrame = 320, BytesPerFrame = 640 };
  enum class Status { Inactive, Stale, InvalidInput, Buffered, FrameReady, Overflow };
  struct Result { size_t consumed; Status status; };
  struct Frame {
    uint8_t bytes[BytesPerFrame] = {};
    uint64_t epoch = 0;
    Frame() = default;
    ~Frame() { clear(); }
    Frame(const Frame&) = delete;
    Frame& operator=(const Frame&) = delete;
    void clear() { wipePcm(bytes, sizeof(bytes)); epoch = 0; }
  };

  PcmPacketizer() = default;
  ~PcmPacketizer() { cancel(); }
  PcmPacketizer(const PcmPacketizer&) = delete;
  PcmPacketizer& operator=(const PcmPacketizer&) = delete;

  // Call only after the owning adapter validates a NEW explicit input action.
  // Increasing local epochs reject late starts even after Stop/disconnect.
  bool start(uint64_t epoch) {
    if (epoch == 0 || epoch <= lastEpoch_) return false;
    cancel();
    lastEpoch_ = epoch;
    active_ = true;
    return true;
  }

  // Consumes only enough to fill the one frame slot. On FrameReady, take it
  // before appending the remainder of the source buffer. No heap allocation.
  Result append(uint64_t epoch, const int16_t* samples, size_t count) {
    if (!active_) return {0, Status::Inactive};
    if (epoch != lastEpoch_) return {0, Status::Stale};
    if (!samples && count) return {0, Status::InvalidInput};
    if (count == 0) return {0, ready() ? Status::FrameReady : Status::Buffered};
    if (ready()) {
      // A producer overran the undrained slot: end the input instead of quietly
      // dropping samples and eventually sending a discontinuous/stale stream.
      cancel();
      return {0, Status::Overflow};
    }
    const size_t room = SamplesPerFrame - used_;
    const size_t consumed = count < room ? count : room;
    for (size_t i = 0; i < consumed; ++i) {
      // Explicit byte order; do not memcpy native int16_t representation.
      const uint16_t value = static_cast<uint16_t>(samples[i]);
      bytes_[2 * (used_ + i)] = static_cast<uint8_t>(value);
      bytes_[2 * (used_ + i) + 1] = static_cast<uint8_t>(value >> 8);
    }
    used_ += consumed;
    return {consumed, ready() ? Status::FrameReady : Status::Buffered};
  }

  bool take(uint64_t epoch, Frame& output) {
    output.clear(); // a failed read cannot leave the caller's old payload intact
    if (!active_ || epoch != lastEpoch_ || !ready()) return false;
    memcpy(output.bytes, bytes_, sizeof(bytes_));
    output.epoch = lastEpoch_;
    clearSlot();
    return true;
  }

  // Fixed-size starter contract has no final partial-frame representation.
  // Provisional policy: discard tails, never pad/replay. Stream-end negotiation
  // with Anay may change this; it does not create an audio.end wire event here.
  bool finish(uint64_t epoch) {
    if (!active_ || epoch != lastEpoch_) return false;
    cancel();
    return true;
  }
  void cancel() { active_ = false; clearSlot(); }
  // A transport must also revalidate its actual grant/revisions immediately
  // before enqueue/send. This only checks the local packetizer epoch.
  bool isCurrent(uint64_t epoch) const { return active_ && epoch == lastEpoch_; }
  bool active() const { return active_; }
  bool ready() const { return active_ && used_ == SamplesPerFrame; }
  size_t bufferedSamples() const { return used_; }

private:
  void clearSlot() { wipePcm(bytes_, sizeof(bytes_)); used_ = 0; }
  uint8_t bytes_[BytesPerFrame] = {};
  size_t used_ = 0;
  uint64_t lastEpoch_ = 0;
  bool active_ = false;
};

} // namespace lemmi
