#pragma once
#include "PcmPacketizer.h"

namespace lemmi {
// Worker-owned, bounded RFC6455 client frame. Mask entropy is supplied afresh
// by esp_fill_random in the adapter. Header and payload share ONE TLS write,
// avoiding the SDK's two small writes per input frame. No TLS/auth changes.
class WsFrameWriter {
public:
  ~WsFrameWriter(){clear();}
  bool prepare(uint8_t opcode,const char* payload,size_t bytes,const uint8_t mask[4]){
    clear();
    if(!mask||(!payload&&bytes)||bytes>4096||
       (opcode!=1&&opcode!=8&&opcode!=10)||(opcode>=8&&bytes>125))return false;
    data_[0]=uint8_t(0x80|opcode);size_t head=2;
    if(bytes<126)data_[1]=uint8_t(0x80|bytes);
    else{data_[1]=0xfe;data_[2]=uint8_t(bytes>>8);data_[3]=uint8_t(bytes);head=4;}
    memcpy(data_+head,mask,4);head+=4;
    for(size_t i=0;i<bytes;++i)data_[head+i]=uint8_t(payload[i])^mask[i%4];
    size_=head+bytes;return true;
  }
  const char* data()const{return reinterpret_cast<const char*>(data_);}
  size_t size()const{return size_;}
  void clear(){wipePcm(data_,sizeof(data_));size_=0;}
private:
  uint8_t data_[4104]={};size_t size_=0;
};
}
