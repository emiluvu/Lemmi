#pragma once
// Host-only hardware substitute. Never included in the Arduino sketch build.
#include <stdint.h>
#include <stddef.h>
#include <deque>
#include <vector>
#define SERIAL_8N1 0
static uint32_t testClock=0;
inline uint32_t millis(){return testClock;}
inline void delay(uint32_t ms){testClock+=ms;}
struct TestSerial { template<class... T> void printf(const char*,T...){} };
static TestSerial Serial;
struct TestI2C {
  uint8_t regs[256]={};
  int failReg=-1;
  bool failBattery=false;
  uint16_t batteryRaw=3200;
  bool readRegister(uint8_t addr,uint8_t reg,uint8_t* out,size_t size,uint32_t){
    if(addr==0x41){if(failBattery)return false;if(reg!=2||size!=2)return false;out[0]=batteryRaw>>8;out[1]=batteryRaw&255;return true;}
    *out=regs[reg];return true;
  }
  bool writeRegister8(uint8_t,uint8_t reg,uint8_t value,uint32_t){if(reg==failReg)return false;regs[reg]=value;return true;}
  bool writeRegister(uint8_t,uint8_t reg,const uint8_t* data,size_t size,uint32_t){for(size_t i=0;i<size;++i)regs[reg+i]=data[i];return true;}
};
struct TestM5 {TestI2C In_I2C;} ;
static TestM5 M5;
struct HardwareSerial {
  enum Mode {NoReply,PartialReply,ReadOnly,AllReplies};
  static Mode mode;
  static std::vector<std::vector<uint8_t>> sent;
  std::deque<uint8_t> rx;
  explicit HardwareSerial(int){}
  void begin(int,int,int,int){}
  int available(){return int(rx.size());}
  int read(){auto v=rx.front();rx.pop_front();return v;}
  int availableForWrite(){return 64;}
  size_t write(const uint8_t* p,size_t n){
    sent.emplace_back(p,p+n);
    if(mode==PartialReply){rx.push_back(255);return n;}
    if(mode==NoReply || (mode==ReadOnly && p[4]!=2))return n;
    size_t payload=p[4]==2?p[6]:0;
    std::vector<uint8_t> reply={255,255,p[2],uint8_t(payload+2),0};
    // Torque read reports disabled; limit/position reads have plausible values.
    if(payload==1)reply.push_back(0);
    if(payload==2){int value=p[5]==9?0:p[5]==11?1000:460;reply.push_back(value>>8);reply.push_back(value&255);}
    uint8_t sum=0;for(size_t i=2;i<reply.size();++i)sum+=reply[i];reply.push_back(uint8_t(~sum));
    rx.insert(rx.end(),reply.begin(),reply.end());return n;
  }
};
HardwareSerial::Mode HardwareSerial::mode=HardwareSerial::NoReply;
std::vector<std::vector<uint8_t>> HardwareSerial::sent;
