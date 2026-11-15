#pragma once
#include "WsFrameWriter.h"

namespace lemmi {
// Four complete, individually masked protocol frames, concatenated into one
// TLS write. No change to application message types or 640-byte PCM framing.
class WsFrameBatch {
public:
  enum : size_t {Frames=4,Bytes=8192};
  ~WsFrameBatch(){clear();}
  bool append(const WsFrameWriter& frame){
    if(!frame.size()||count_==Frames||used_+frame.size()>Bytes)return false;
    memcpy(data_+used_,frame.data(),frame.size());used_+=frame.size();++count_;return true;
  }
  const char* data()const{return data_;}
  size_t size()const{return used_;}
  size_t count()const{return count_;}
  void clear(){wipePcm(data_,sizeof(data_));used_=count_=0;}
private:
  char data_[Bytes]={};size_t used_=0,count_=0;
};
}
