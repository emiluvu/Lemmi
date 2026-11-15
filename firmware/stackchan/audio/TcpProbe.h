#pragma once
#include <stdint.h>

namespace lemmi {
// Volatile numeric metadata only. No addresses, ports, identities, packet
// contents or raw TCP sequence values are emitted or retained durably.
struct TcpProbe {
  uint32_t samples=0,free=0,minimumFree=0,queued=0,peerWindow=0,congestionWindow=0;
  uint32_t ackBytes=0,retransmits=0;
  bool unacked=false,unsent=false;
  void observe(uint32_t space,uint32_t queue,uint32_t window,uint32_t congestion,
               uint32_t ack,uint32_t retries,bool hasUnacked,bool hasUnsent){
    if(!samples){minimumFree=space;previousAck_=ack;}
    else ackBytes+=uint32_t(ack-previousAck_);
    previousAck_=ack;++samples;free=space;if(space<minimumFree)minimumFree=space;
    queued=queue;peerWindow=window;congestionWindow=congestion;
    if(retries>retransmits)retransmits=retries;
    unacked=hasUnacked;unsent=hasUnsent;
  }
private:
  uint32_t previousAck_=0;
};
}
