#pragma once
#include <stdint.h>

namespace lemmi {
// Numeric metadata only. Worker-owned; no payload, pointer, identity or socket
// destination is retained. Reset at each bounded write, report after failure.
struct TransportProbe {
  uint32_t polls=0,pollZero=0,pollError=0,pollMaxUs=0;
  uint32_t writes=0,writeZero=0,writeWant=0,writeError=0,writeMaxUs=0;
  void poll(int result,uint32_t elapsed){
    ++polls;if(result==0)++pollZero;else if(result<0)++pollError;
    if(elapsed>pollMaxUs)pollMaxUs=elapsed;
  }
  void write(int result,uint32_t elapsed,int wantRead,int wantWrite){
    ++writes;
    if(result==0)++writeZero;
    else if(result==wantRead||result==wantWrite)++writeWant;
    else if(result<0)++writeError;
    if(elapsed>writeMaxUs)writeMaxUs=elapsed;
  }
};
}
