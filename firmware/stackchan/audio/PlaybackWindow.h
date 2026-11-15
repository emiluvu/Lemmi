#pragma once
#include "PcmPacketizer.h"

namespace lemmi {

// One serialized owner. This is a bounded decoded-PCM window, not permission to
// play: validate session/turn/lease/stream/revisions and the local Stop latch
// before every operation and before passing a Block to the speaker driver.
class PlaybackWindow {
public:
  enum : size_t { Window = 4, Capacity = 12, MaxBytes = 1920, MaxSamples = MaxBytes / 2 };
  struct Format {
    uint32_t sampleRate;
    uint32_t byteLength;
    uint16_t chunkBytes;
    uint16_t chunkCount;
  };
  struct Block {
    int16_t samples[MaxSamples] = {};
    size_t count = 0;
    uint64_t epoch = 0;
    uint16_t index = 0;
    Block() = default;
    Block(const Block&) = delete;
    Block& operator=(const Block&) = delete;
    ~Block() { clear(); }
    void clear() {
      wipePcm(samples, sizeof(samples)); count = 0; epoch = 0; index = 0;
    }
  };

  PlaybackWindow() = default;
  PlaybackWindow(const PlaybackWindow&) = delete;
  PlaybackWindow& operator=(const PlaybackWindow&) = delete;
  ~PlaybackWindow() { cancel(); }

  static bool validFormat(const Format& f) {
    const bool rate = f.sampleRate == 16000 || f.sampleRate == 22050 ||
      f.sampleRate == 24000 || f.sampleRate == 44100 || f.sampleRate == 48000;
    return rate && f.byteLength > 0 && f.byteLength % 2 == 0 &&
      f.byteLength <= f.sampleRate * 2 * 30 &&
      f.chunkBytes == (f.sampleRate / 50) * 2 && f.chunkBytes <= MaxBytes &&
      f.chunkCount > 0 && f.chunkCount <= 1501 &&
      f.chunkCount == (f.byteLength + f.chunkBytes - 1) / f.chunkBytes;
  }
  // The caller assigns a fresh monotonic LOCAL epoch after validating metadata.
  // No replacement while active: stop/drain the driver and cancel first.
  bool start(uint64_t epoch, const Format& format, size_t window=Window) {
    if (active_ || !epoch || epoch <= epoch_ || !validFormat(format)||(window!=4&&window!=12)) return false;
    cancel(); epoch_ = epoch; format_ = format; window_=window; active_ = true; return true;
  }
  bool append(uint64_t epoch, uint16_t index, const uint8_t* pcm, size_t bytes) {
    if (!current(epoch) || ended_ || !pcm || index != received_ ||
        received_ >= format_.chunkCount || buffered() >= window_) return false;
    const size_t expected = index + 1 == format_.chunkCount
      ? format_.byteLength - uint32_t(index) * format_.chunkBytes
      : format_.chunkBytes;
    if (bytes != expected) return false;
    auto& slot = slots_[received_ % Capacity];
    for (size_t i = 0; i < bytes / 2; ++i) {
      const uint16_t value = uint16_t(pcm[i * 2]) | (uint16_t(pcm[i * 2 + 1]) << 8);
      // Explicit signed conversion, independent of host endianness.
      slot.samples[i] = value < 0x8000 ? int16_t(value) : int16_t(int32_t(value) - 65536);
    }
    slot.count = bytes / 2; ++received_; return true;
  }
  // At most two outstanding speaker requests. Copy into stable caller memory so
  // cancel() can wipe this window without modifying memory the DMA still reads.
  bool acquire(uint64_t epoch, Block& block) {
    // Never wipe a possibly driver-owned output Block on failed/repeated acquire.
    // Clear it only AFTER the driver has released it, before reusing it here.
    if (!current(epoch) || issued_-played_ >= 2 || issued_==received_ || block.epoch) return false;
    auto& slot = slots_[issued_ % Capacity];
    memcpy(block.samples, slot.samples, slot.count * sizeof(int16_t));
    block.count = slot.count; block.epoch = epoch_; block.index = issued_++;
    return true;
  }
  // Call ONLY after actual consumption, never on enqueue/buffer-release alone.
  // A stop/failure must cancel(), not acknowledge a cut-short block as played.
  bool consumed(uint64_t epoch, uint16_t index) {
    if (!current(epoch) || played_==issued_ || index != played_) return false;
    auto& slot = slots_[played_ % Capacity];
    wipePcm(slot.samples, sizeof(slot.samples)); slot.count = 0;
    ++played_; return true;
  }
  bool end(uint64_t epoch, uint16_t chunks) {
    if (!current(epoch) || ended_ || chunks != format_.chunkCount || chunks != received_) return false;
    ended_ = true; return true;
  }
  bool complete() const { return active_ && ended_ && played_ == format_.chunkCount && played_==issued_; }
  bool current(uint64_t epoch) const { return active_ && epoch == epoch_; }
  bool active() const { return active_; }
  size_t buffered() const { return received_ - played_; }
  uint16_t playedChunks() const { return played_; }
  uint32_t sampleRate() const { return format_.sampleRate; }
  size_t window() const {return window_;}
  void cancel() {
    active_ = ended_ = false; received_ = played_ = issued_ = 0;
    for (auto& slot : slots_) { wipePcm(slot.samples, sizeof(slot.samples)); slot.count = 0; }
    format_ = {};window_=Window;
    // Keep epoch_: a delayed start must not reopen cancelled output.
  }

private:
  struct Slot { int16_t samples[MaxSamples] = {}; size_t count = 0; };
  Slot slots_[Capacity];
  Format format_ = {};
  uint64_t epoch_ = 0;
  uint16_t received_ = 0, played_ = 0, issued_ = 0;
  size_t window_=Window;
  bool active_ = false, ended_ = false;
};

} // namespace lemmi
