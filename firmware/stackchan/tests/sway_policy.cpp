#include "../motion/SwayPolicy.h"
#include "../motion/ServoPacket.h"
#include <assert.h>
#include <stdio.h>
int main(){
  SwayPolicy p;
  p.pet(0);assert(!p.poll(true,true,1000));assert(!p.poll(true,false,1001));
  assert(!p.poll(true,false,1500));assert(p.poll(true,false,1501)==1);
  int offset=0;uint16_t duration=0;
  assert(p.next(1751,offset,duration)&&offset==6&&duration==800);p.sent(1751,duration);
  assert(!p.next(2550,offset,duration));
  assert(p.next(2651,offset,duration)&&offset==-6&&duration==1600);p.sent(2651,duration);
  assert(p.next(4351,offset,duration)&&offset==0&&duration==800);p.sent(4351,duration);
  assert(!p.next(5251,offset,duration)&&!p.active());
  p.pet(6000);assert(p.poll(false,false,6001)==-1);assert(!p.poll(true,false,7000));
  p.pet(8000);p.poll(true,false,8000);assert(p.poll(true,false,8500)==1);
  assert(p.poll(true,true,8501)==-1);assert(!p.active());
  p.pet(9000);assert(p.poll(true,false,15001)==-1);
  p.pet(UINT32_MAX-100);p.poll(true,false,UINT32_MAX-100);assert(p.poll(true,false,399)==1);
  p.cancel();assert(!p.next(500,offset,duration));
  for(int phase=0;phase<3;phase++){
    SwayPolicy interrupted;interrupted.pet(0);interrupted.poll(true,false,0);
    assert(interrupted.poll(true,false,500)==1);
    uint32_t at=500;
    for(int i=0;i<=phase;i++){
      assert(interrupted.next(at,offset,duration));interrupted.sent(at,duration);at+=duration+100;
    }
    assert(interrupted.poll(false,false,at)==-1);
    assert(!interrupted.next(at,offset,duration));
  }
  uint8_t tx[13],count=2;assert(servoPacket::request(tx,2,56,&count,1)==8);
  const uint8_t expected[]={255,255,1,4,2,56,2,190};
  for(int i=0;i<8;i++)assert(tx[i]==expected[i]);
  uint8_t rx[]={255,255,1,4,0,1,204,45}; // position 460, sum including checksum=255
  assert(servoPacket::reply(rx,8,2));
  rx[4]=1;assert(!servoPacket::reply(rx,8,2));rx[4]=0;
  rx[2]=2;assert(!servoPacket::reply(rx,8,2));rx[2]=1;
  rx[7]^=1;assert(!servoPacket::reply(rx,8,2));
  assert(!servoPacket::reply(rx,7,2));
  puts("PASS: release delay, bounded sway, no catch-up, cancellation/touch/static gate, deadline/rollover and servo packet validation");
}
