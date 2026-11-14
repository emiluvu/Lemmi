#include "../audio/PcmPacketizer.h"
#include <cassert>
#include <limits>
#include <vector>
#include <cstdio>

using P = lemmi::PcmPacketizer;
using S = P::Status;
static_assert(sizeof(P) <= 672, "fixed one-frame memory budget");
static_assert(P::BytesPerFrame == P::SamplesPerFrame * 2, "PCM frame size");
static_assert(P::SamplesPerFrame * 1000 == P::SampleRate * P::FrameMs, "20 ms framing");

bool zero(const P::Frame& frame) {
  for (uint8_t b : frame.bytes) if (b) return false;
  return frame.epoch == 0;
}

void arbitraryBoundaries(size_t block, size_t count = 320 * 7 + 19) {
  P p; P::Frame frame;
  std::vector<int16_t> source(count);
  for (size_t i = 0; i < source.size(); ++i) source[i] = int16_t(int(i * 97 % 65536) - 32768);
  assert(p.start(1));
  size_t position = 0, emitted = 0;
  while (position < source.size()) {
    const size_t chunk = block < source.size() - position ? block : source.size() - position;
    size_t consumed = 0;
    while (consumed < chunk) {
      const auto result = p.append(1, source.data() + position + consumed, chunk - consumed);
      assert(result.consumed > 0);
      assert(result.status == S::Buffered || result.status == S::FrameReady);
      consumed += result.consumed;
      if (result.status == S::FrameReady) {
        assert(p.take(1, frame) && frame.epoch == 1);
        for (size_t j = 0; j < 320; ++j) {
          const uint16_t expected = static_cast<uint16_t>(source[emitted + j]);
          assert(frame.bytes[j * 2] == uint8_t(expected));
          assert(frame.bytes[j * 2 + 1] == uint8_t(expected >> 8));
        }
        emitted += 320;
        assert(p.bufferedSamples() == 0 && !p.ready());
      }
    }
    position += consumed;
  }
  assert(emitted == count / 320 * 320 && p.bufferedSamples() == count % 320);
  assert(p.finish(1));
  assert(!p.take(1, frame) && zero(frame)); // no padded final packet
}

int main() {
  P p; P::Frame frame;
  int16_t input[320];
  for (size_t i = 0; i < 320; ++i) input[i] = -1;
  assert(!p.active() && !p.ready());
  assert(p.append(1, input, 256).status == S::Inactive);
  assert(!p.start(0));

  // Every possible partial/full position is wiped by Stop, mute, disconnect,
  // camera takeover etc. through the adapter's same cancel operation.
  for (size_t used = 0; used <= 320; ++used) {
    assert(p.start(used + 1));
    assert(p.append(used + 1, input, used).consumed == used);
    p.cancel();
    assert(!p.active() && p.bufferedSamples() == 0);
    assert(!p.take(used + 1, frame) && zero(frame));
    assert(!p.start(used + 1)); // a late start cannot reopen the cancelled epoch
  }

  assert(p.start(1000));
  assert(p.append(1000, input, 100).consumed == 100);
  assert(p.append(999, input, 200).status == S::Stale);
  assert(!p.finish(999) && p.bufferedSamples() == 100); // stale worker cannot end current turn
  assert(!p.start(999) && p.bufferedSamples() == 100);
  assert(!p.take(999, frame) && p.bufferedSamples() == 100 && zero(frame));
  assert(p.append(1000, nullptr, 1).status == S::InvalidInput);
  assert(p.append(1000, nullptr, 0).consumed == 0);
  assert(p.start(1001)); // explicit new epoch discards old partial input
  assert(p.bufferedSamples() == 0);
  assert(p.append(1001, input, 320).status == S::FrameReady);
  assert(p.append(1001, input, 1).status == S::Overflow);
  assert(!p.active() && !p.take(1001, frame) && zero(frame));

  // Preserve every sample across arbitrary input and 256-sample mic boundaries.
  arbitraryBoundaries(256, 5 * 256); // exactly four complete output frames
  for (size_t block : {size_t(1), size_t(17), size_t(256), size_t(320), size_t(513), size_t(4096)}) arbitraryBoundaries(block);
  assert(p.start(1002));
  const int16_t edges[] = {-32768, -1, 0, 1, 32767, 0x1234, -0x1234};
  int16_t edgeFrame[320] = {};
  for (size_t i = 0; i < 7; ++i) edgeFrame[i] = edges[i];
  assert(p.append(1002, edgeFrame, 320).status == S::FrameReady);
  assert(p.take(1002, frame));
  const uint8_t expected[] = {0x00,0x80,0xff,0xff,0x00,0x00,0x01,0x00,0xff,0x7f,0x34,0x12,0xcc,0xed};
  for (size_t i = 0; i < sizeof(expected); ++i) assert(frame.bytes[i] == expected[i]);
  assert(p.isCurrent(frame.epoch));
  p.cancel();
  assert(!p.isCurrent(frame.epoch)); // a previously taken frame is now unsendable
  frame.clear();
  assert(!p.take(1002, frame) && zero(frame)); // no duplicate frame read
  assert(p.start(std::numeric_limits<uint64_t>::max()));
  p.cancel();
  assert(!p.start(1)); // epoch exhaustion fails closed rather than wrapping
  std::puts("PASS: PCM framing, boundaries, cancellation, stale epochs, overflow and tails");
}
