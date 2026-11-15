#include "../audio/PlaybackWindow.h"
#include <cassert>
#include <cstdio>
#include <limits>
#include <vector>

using P = lemmi::PlaybackWindow;
static_assert(sizeof(P) <= 23300, "twelve decoded chunks maximum");
static_assert(sizeof(P::Block) <= 1952, "one caller-owned driver block");

void roundTrip(uint32_t rate, uint32_t bytes) {
  P p; P::Block block;
  const uint16_t chunk = uint16_t(rate / 50 * 2);
  const uint16_t count = uint16_t((bytes + chunk - 1) / chunk);
  P::Format format = {rate, bytes, chunk, count};
  assert(p.start(1, format));
  uint8_t data[P::MaxBytes];
  const uint8_t edges[] = {0x00,0x80,0xff,0xff,0x00,0x00,0x01,0x00,0xff,0x7f};
  for (size_t i=0; i<sizeof(data); ++i) data[i] = edges[i % sizeof(edges)];
  uint16_t received = 0;
  for (uint16_t played = 0; played < count; ++played) {
    while (received < count && p.buffered() < P::Window) {
      const size_t size = received + 1 == count ? bytes - uint32_t(received) * chunk : chunk;
      assert(p.append(1, received, data, size)); ++received;
    }
    assert(p.playedChunks() == played); // reception is never evidence of playback
    assert(p.acquire(1, block));
    assert(block.index == played && block.epoch == 1);
    const size_t expected = played + 1 == count ? bytes - uint32_t(played) * chunk : chunk;
    assert(block.count == expected / 2);
    const int16_t samples[] = {-32768,-1,0,1,32767};
    for (size_t i=0; i<block.count; ++i) assert(block.samples[i] == samples[i % 5]);
    const int16_t first = block.samples[0];
    assert(!p.acquire(1, block) && block.samples[0] == first && block.epoch == 1);
    assert(!p.consumed(0, played) && !p.consumed(1, played + 1));
    assert(p.consumed(1, played));
    assert(!p.consumed(1, played)); // duplicate callback cannot release the next slot
    block.clear();
    assert(!p.complete()); // require explicit stream end as well
  }
  assert(p.end(1, count)); assert(p.complete());
  assert(!p.end(1, count));
  p.cancel(); assert(!p.complete() && !p.active() && p.buffered() == 0);
  assert(!p.start(1, format));
}

int main() {
  for(size_t window:{size_t(4),size_t(12)}){
    P bounded;P::Block a,b,c;uint8_t pcm[640]={};
    P::Format f={16000,640*13,640,13};
    assert(bounded.start(1,f,window)&&bounded.window()==window);
    for(uint16_t i=0;i<window;++i)assert(bounded.append(1,i,pcm,sizeof(pcm)));
    assert(!bounded.append(1,uint16_t(window),pcm,sizeof(pcm)));
    assert(bounded.acquire(1,a)&&bounded.acquire(1,b)&&!bounded.acquire(1,c));
    assert(!bounded.consumed(1,1)&&bounded.consumed(1,0));a.clear();
    assert(bounded.append(1,uint16_t(window),pcm,sizeof(pcm)));
    bounded.cancel();assert(!bounded.current(1)&&!bounded.consumed(1,1)&&bounded.buffered()==0);
    b.clear();assert(!bounded.start(1,f,window));
    assert(!bounded.start(2,f,8));assert(bounded.start(2,f,window));
  }
  // Native 22.05 kHz has 882-byte frames and permits a short final tail.
  for (uint32_t rate : {16000u, 22050u, 24000u, 44100u, 48000u}) {
    const uint32_t chunk = rate / 50 * 2;
    for (uint32_t size : {2u, chunk, chunk + 2, chunk * 9 - 2, rate * 2 * 30}) roundTrip(rate, size);
  }
  P p; P::Block block;
  P::Format format = {22050, 882 * 5 + 2, 882, 6};
  assert(!p.start(0, format));
  for (auto bad : std::vector<P::Format>{{22051,882,882,1},{22050,881,882,1},
       {22050,882,640,1},{22050,882,882,2},{22050,0,882,0},
       {48000,2880002,1920,1501},{48000,2880000,1920,1502}}) {
    assert(!p.start(1, bad) && !p.active());
  }
  assert(p.start(1, format)); assert(!p.start(2, format));
  uint8_t bytes[P::MaxBytes] = {}; bytes[0] = 0x34; bytes[1] = 0x12;
  assert(!p.append(1, 0, nullptr, 882));
  assert(!p.append(1, 0, bytes, 880));
  assert(!p.append(1, 1, bytes, 882));
  assert(!p.append(2, 0, bytes, 882));
  assert(!p.end(1, 6));
  for (uint16_t i=0; i<4; ++i) assert(p.append(1, i, bytes, 882));
  assert(!p.append(1, 4, bytes, 882)); // negotiated four-chunk bound
  assert(p.acquire(1, block));
  assert(!p.append(1, 4, bytes, 882)); // submission does not open the window
  p.cancel();
  // A cancellation never modifies a Block still possibly referenced by DMA.
  assert(block.samples[0] == 0x1234 && block.epoch == 1);
  assert(!p.consumed(1, 0));
  assert(p.start(2, format)); assert(!p.start(1, format));
  assert(p.append(2, 0, bytes, 882));
  assert(!p.acquire(2, block)); // old driver must release before its memory is reused
  block.clear();
  assert(p.acquire(2, block));
  assert(!p.consumed(1, 0) && p.playedChunks() == 0);
  assert(p.consumed(2, 0)); block.clear();
  p.cancel();
  assert(p.start(std::numeric_limits<uint64_t>::max(), format)); p.cancel();
  assert(!p.start(1, format)); // no epoch wrap/reopening
  // Stream end can arrive while the final PCM is still outstanding.
  P tail; const P::Format one = {16000,2,640,1};
  assert(tail.start(1, one)); assert(tail.append(1,0,bytes,2));
  assert(tail.end(1,1) && !tail.complete());
  assert(tail.acquire(1,block) && !tail.complete());
  assert(tail.consumed(1,0) && tail.complete()); block.clear();
  {
    P pipeline;P::Block first,second,third;
    P::Format f={16000,640*4,640,4};assert(pipeline.start(1,f));
    for(uint16_t i=0;i<4;++i)assert(pipeline.append(1,i,bytes,640));
    assert(pipeline.acquire(1,first)&&first.index==0);
    assert(pipeline.acquire(1,second)&&second.index==1);
    assert(!pipeline.acquire(1,third)); // two driver slots, still four network chunks
    assert(!pipeline.consumed(1,1)); // no out-of-order receipt
    assert(pipeline.consumed(1,0));first.clear();
    assert(pipeline.acquire(1,first)&&first.index==2);
    assert(second.samples[0]==0x1234); // older outstanding memory remains stable
    pipeline.cancel();assert(!pipeline.consumed(1,1));
    first.clear();second.clear();
  }
  std::puts("PASS: bounded playback, native rates, exact PCM/tails, consumed receipts, cancellation and stale callbacks");
}
