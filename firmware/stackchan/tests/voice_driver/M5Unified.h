#pragma once
#include <cassert>
#include <cstdint>
#include <cstring>
#include <deque>
#include <vector>
using QueueHandle_t=struct TestQueue*;
constexpr int pdTRUE=1;
struct TestQueue {size_t capacity,size;std::deque<std::vector<uint8_t>> items;};
inline QueueHandle_t xQueueCreate(size_t n,size_t bytes){return new TestQueue{n,bytes,{}};}
inline int xQueueSend(QueueHandle_t q,const void* data,int){
  if(q->items.size()>=q->capacity)return 0;
  q->items.emplace_back(static_cast<const uint8_t*>(data),static_cast<const uint8_t*>(data)+q->size);return pdTRUE;
}
inline int xQueueReceive(QueueHandle_t q,void* data,int){
  if(q->items.empty())return 0;
  memcpy(data,q->items.front().data(),q->size);q->items.pop_front();return pdTRUE;
}
struct TestMic {
  bool rejectRecord=false,rejectBegin=false;
  bool running=false,recording=false;int16_t* buffer=nullptr;size_t count=0;
  bool begin(){if(rejectBegin)return false;running=true;return true;}
  void end(){running=recording=false;buffer=nullptr;}
  bool isRecording(){return recording;}
  bool record(int16_t* dst,size_t n,int rate,bool stereo){
    if(rejectRecord)return false;
    assert(running&&rate==16000&&!stereo);buffer=dst;count=n;recording=true;return true;
  }
  void complete(){assert(recording);for(size_t i=0;i<count;++i)buffer[i]=int16_t(i-128);recording=false;}
};
struct TestSpeaker {
  struct Config {uint32_t sample_rate=48000;size_t dma_buf_len=128,dma_buf_count=4;} cfg;
  bool running=false,playing=false;void* args=nullptr;const void* data=nullptr;
  std::deque<const void*> requests;
  void (*callback)(void*,const void*,uint8_t)=nullptr;
  Config config(){return cfg;}void config(Config c){cfg=c;}
  bool begin(){assert(!running);running=true;return true;}
  void setVolume(int n){assert(n==64);}
  void setBufferReleaseCallback(void* p,void (*cb)(void*,const void*,uint8_t)){assert(!running);args=p;callback=cb;}
  bool playRaw(const int16_t* p,size_t n,uint32_t,bool stereo,int repeat,int channel,bool replace){
    assert(running&&requests.size()<2&&p&&n&&!stereo&&repeat==1&&channel==0&&!replace);
    requests.push_back(p);data=requests.front();playing=true;return true;
  }
  size_t isPlaying(int=0){return requests.size();}
  void release(){assert(playing);auto p=requests.front();requests.pop_front();playing=!requests.empty();data=playing?requests.front():nullptr;callback(args,p,0);}
  void stop(){if(playing)release();requests.clear();playing=false;data=nullptr;}void end(){stop();running=false;}
};
struct TestM5 {TestMic Mic;TestSpeaker Speaker;};
extern TestM5 M5;
