#include "../motion/BodyHardware.h"
#include <assert.h>
#include <string.h>
#include <stdio.h>
static void reset(HardwareSerial::Mode mode){
  testUartInstalled=false;testUartFailure=0;testUart.rx.clear();
  M5.In_I2C=TestI2C{};M5.In_I2C.regs[2]=1;
  M5.In_I2C.regs[5]=0xa0;M5.In_I2C.regs[9]=0xa0;M5.In_I2C.regs[11]=0xa1;
  HardwareSerial::mode=mode;HardwareSerial::sent.clear();testClock=0;
}
int main(){
  for(auto mode : {HardwareSerial::NoReply,HardwareSerial::PartialReply,HardwareSerial::ReadOnly}){
    reset(mode);BodyHardware body;assert(body.begin());
    assert(M5.In_I2C.regs[5]==0xa0); // VM off, other pins preserved
    assert(M5.In_I2C.regs[9]==0xa1 && M5.In_I2C.regs[11]==0xa0);
    assert(HardwareSerial::sent.empty()); // no servo traffic before arming
    assert(body.beginPower(0));assert(!body.settled(249));assert(body.settled(250));
    assert(!body.prepare());assert(!(M5.In_I2C.regs[5]&1));
    assert(!body.move(6,800)); // failed prepare never allows a goal
    for(const auto& packet:HardwareSerial::sent){
      assert(packet[5]==40); // only torque probe/disable, no movement
      if(packet[4]==3)assert(packet[6]==0);
    }
  }
  reset(HardwareSerial::NoReply);BodyHardware unreachable;assert(unreachable.begin());
  assert(unreachable.beginPower(0));assert(!unreachable.prepare());
  assert(!strcmp(unreachable.faultStage(),"yaw_probe"));
  assert(!strcmp(unreachable.transportStatus(),"timeout_empty"));
  reset(HardwareSerial::ReadOnly);BodyHardware readOnly;assert(readOnly.begin());
  assert(readOnly.beginPower(0));assert(!readOnly.prepare());
  assert(!strcmp(readOnly.faultStage(),"yaw_torque_off"));
  reset(HardwareSerial::AllReplies);BodyHardware working;assert(working.begin());
  assert(working.beginPower(0));assert(working.prepare());
  assert(working.move(6,800));assert(working.finish());assert(!(M5.In_I2C.regs[5]&1));
  reset(HardwareSerial::AllReplies);M5.In_I2C.failReg=9;
  BodyHardware missingPull;assert(!missingPull.begin());assert(!missingPull.beginPower(0));
  assert(HardwareSerial::sent.empty());assert(!(M5.In_I2C.regs[5]&1));
  for(int failure=1;failure<=3;++failure){
    reset(HardwareSerial::AllReplies);testUartFailure=failure;
    BodyHardware faulty;assert(faulty.begin());
    if(failure<3){assert(!faulty.beginPower(0));assert(HardwareSerial::sent.empty());assert(!testUartInstalled);}
    else {assert(faulty.beginPower(0));assert(!faulty.prepare());assert(!strcmp(faulty.transportStatus(),"tx_wait"));}
    assert(!(M5.In_I2C.regs[5]&1));
  }
  reset(HardwareSerial::AllReplies);testUartInstalled=true;
  BodyHardware occupied;assert(occupied.begin());assert(!occupied.beginPower(0));
  assert(testUartInstalled && HardwareSerial::sent.empty());
  assert(!strcmp(occupied.transportStatus(),"uart_busy"));
  for(auto mode : {HardwareSerial::NoReply,HardwareSerial::PartialReply,HardwareSerial::ReadOnly}){
    reset(mode);BodyHardware probe;assert(probe.begin());assert(probe.beginPower(0));
    assert(probe.probeOnly());assert(probe.batteryMillivolts()==4000);
    assert(HardwareSerial::sent.size()==2);
    for(const auto& packet:HardwareSerial::sent){assert(packet[4]==2 && packet[5]==40 && packet[6]==1);}
    assert(HardwareSerial::sent[0][2]==1 && HardwareSerial::sent[1][2]==2);
    assert(!(M5.In_I2C.regs[5]&1));
    assert(!strcmp(probe.yawProbeStatus(),mode==HardwareSerial::ReadOnly?"ok":mode==HardwareSerial::PartialReply?"timeout_partial":"timeout_empty"));
  }
  reset(HardwareSerial::ReadOnly);M5.In_I2C.failBattery=true;
  BodyHardware noBattery;assert(noBattery.begin());assert(noBattery.beginPower(0));
  assert(noBattery.probeOnly());assert(noBattery.batteryMillivolts()==-1);
  reset(HardwareSerial::NoReply);BodyHardware lights;assert(lights.begin());
  for(int i=0;i<24;++i)assert(M5.In_I2C.regs[0x30+i]==0);
  assert(lights.pink(true));
  for(int i=0;i<12;++i){assert(M5.In_I2C.regs[0x30+i*2]==0x43);assert(M5.In_I2C.regs[0x31+i*2]==0x30);}
  assert(lights.pink(false));
  for(int i=0;i<24;++i)assert(M5.In_I2C.regs[0x30+i]==0);
  assert(HardwareSerial::sent.empty()&&!testUartInstalled);
  assert(!(M5.In_I2C.regs[5]&1));
  puts("PASS: VM pull setup, no boot servo traffic, probe/write distinction, failed prepare blocks goals and cuts VM request");
}
