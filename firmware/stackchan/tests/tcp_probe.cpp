#include "../audio/TcpProbe.h"
#include "../audio/PendingWrite.h"
#include <cassert>
#include <cstdio>

int main(){
  lemmi::TcpProbe probe;
  assert(!probe.samples);
  probe.observe(5744,0,65535,14360,0xfffffffcu,0,false,false);
  probe.observe(1000,10,0,2860,8,2,true,true);
  assert(probe.samples==2&&probe.ackBytes==12&&probe.minimumFree==1000);
  assert(probe.peerWindow==0&&probe.retransmits==2&&probe.unacked&&probe.unsent);
  probe.observe(5744,0,65535,14360,8,0,false,false);
  assert(probe.ackBytes==12&&probe.retransmits==2&&probe.minimumFree==1000);
  probe=lemmi::TcpProbe{};
  assert(!probe.samples&&!probe.ackBytes&&!probe.retransmits);
  // Capture age remains 240ms. Only an already-stopped session's control
  // cancellation waits up to the existing six-second watchdog interval.
  lemmi::PendingWrite stop;
  assert(stop.begin("stop",4,0,6000));
  unsigned reads=0;
  for(uint32_t now=0;now<=400;now+=2){
    auto result=stop.step(now,true,-2,-3,[&](const char*,size_t n){
      return now<400?lemmi::PendingWrite::Attempt{0,false}:lemmi::PendingWrite::Attempt{int(n),true};
    });
    ++reads;
    assert(result==(now<400?lemmi::PendingWrite::Pending:lemmi::PendingWrite::Complete));
  }
  assert(reads==201);
  stop.clear();assert(stop.begin("stop",4,0,6000));
  assert(stop.step(6000,true,-2,-3,[](const char*,size_t){assert(false);return lemmi::PendingWrite::Attempt{0,false};})==lemmi::PendingWrite::ExpiredSafe);
  puts("PASS: TCP numeric gauges/ACK wrap/reset and bounded nonblocking Stop recovery without capture extension");
}
