#pragma once
#include "PcmPacketizer.h"
#ifdef ESP_PLATFORM
#include <freertos/FreeRTOS.h>
#include <freertos/portmacro.h>
#else
#include <mutex>
#endif

namespace lemmi {
// Fixed storage; copy and wipe under one short lock. No codec, driver or I/O
// call is made under this lock. Unlike opaque RTOS queue storage, consumed slots
// do not retain a copy of microphone/output PCM until the queue wraps around.
template<class T,size_t N> class WipingQueue {
public:
  WipingQueue() = default;
  WipingQueue(const WipingQueue&) = delete;
  WipingQueue& operator=(const WipingQueue&) = delete;
  ~WipingQueue(){for(auto& item:items_)wipePcm(&item,sizeof(item));}
  bool push(const T& value) {
    Guard lock(*this);
    if(used_==N)return false;
    memcpy(&items_[(head_+used_)%N],&value,sizeof(T));++used_;return true;
  }
  bool pop(T& value) {
    Guard lock(*this);
    if(!used_)return false;
    memcpy(&value,&items_[head_],sizeof(T));wipePcm(&items_[head_],sizeof(T));
    head_=(head_+1)%N;--used_;return true;
  }
  bool empty(){Guard lock(*this);return !used_;}
  size_t size(){Guard lock(*this);return used_;}
private:
  struct Guard {
    WipingQueue& queue;
    explicit Guard(WipingQueue& q):queue(q){
#ifdef ESP_PLATFORM
      portENTER_CRITICAL(&queue.mux_);
#else
      queue.mux_.lock();
#endif
    }
    ~Guard(){
#ifdef ESP_PLATFORM
      portEXIT_CRITICAL(&queue.mux_);
#else
      queue.mux_.unlock();
#endif
    }
  };
  T items_[N]={};size_t head_=0,used_=0;
#ifdef ESP_PLATFORM
  portMUX_TYPE mux_=portMUX_INITIALIZER_UNLOCKED;
#else
  std::mutex mux_;
#endif
};
}
