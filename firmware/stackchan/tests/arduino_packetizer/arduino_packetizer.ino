// Compile-only integration probe. Not an upload target; no peripheral APIs.
#include "../../audio/PcmPacketizer.h"
lemmi::PcmPacketizer packetizer;
lemmi::PcmPacketizer::Frame frame;
volatile bool packetizerProbeResult = false;
void setup() {
  int16_t synthetic[256] = {};
  packetizer.start(1);
  const auto first = packetizer.append(1, synthetic, 256);
  const auto second = packetizer.append(1, synthetic, 256);
  packetizerProbeResult = first.consumed == 256 && second.consumed == 64 && packetizer.take(1, frame) && packetizer.isCurrent(frame.epoch);
  packetizer.cancel(); frame.clear();
}
void loop() {}
