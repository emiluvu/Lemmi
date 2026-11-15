#include "../audio/TransportProbe.h"
#include "../audio/BoundedWrite.h"
#include <cassert>
#include <cstdio>
int main(){
  lemmi::TransportProbe p;uint32_t now=0;
  // Socket poll timeout: no TLS call occurs; the outer bounded write expires.
  auto r=lemmi::boundedWrite("x",1,100,-2,-3,
    [&](const char*,size_t,uint32_t ms){now+=ms;p.poll(0,ms*1000);return 0;},
    []{return true;},[&]{return now;},[]{});
  assert(r.status==lemmi::WriteResult::TimedOut&&p.pollZero==5&&p.writes==0&&p.pollMaxUs==20000);
  p=lemmi::TransportProbe{};now=0;
  // Writable socket, repeated TLS WANT: distinct from polling timeouts.
  r=lemmi::boundedWrite("x",1,100,-2,-3,
    [&](const char*,size_t,uint32_t){p.poll(1,3);p.write(-3,7,-2,-3);now+=20;return -3;},
    []{return true;},[&]{return now;},[]{});
  assert(r.status==lemmi::WriteResult::TimedOut&&p.pollZero==0&&p.writeWant==5);
  p.write(0,40,-2,-3);p.write(-9,30,-2,-3);p.write(1,2,-2,-3);p.poll(-1,9);
  assert(p.writeZero==1&&p.writeError==1&&p.writeMaxUs==40&&p.pollError==1);
  // Unsigned timer subtraction remains valid across micros() wrap.
  uint32_t start=0xfffffffdu,end=4;p.poll(1,uint32_t(end-start));
  assert(p.pollMaxUs==9);
  puts("PASS: socket versus TLS stall classification, bounded deadlines and timer wrap");
}
