#pragma once
#include "PcmPacketizer.h"

namespace lemmi {
// Bounded application subset of RFC6455 server frames: final, unmasked text
// plus final ping/pong/close. TLS establishment and masked sends stay in the SDK.
// Partial headers/payloads survive TLS WANT_READ/timeout (zero bytes); callers
// still close immediately on a negative underlying TLS read or malformed frame.
class WsFrameReader {
public:
  WsFrameReader(char* storage,size_t bytes):storage_(storage),storageBytes_(bytes),capacity_(bytes?bytes-1:0){clear();}
  ~WsFrameReader(){clear();}
  WsFrameReader(const WsFrameReader&)=delete;
  WsFrameReader& operator=(const WsFrameReader&)=delete;
  char* destination(){return ready_||invalid_?nullptr:headerUsed_<headerNeed_?reinterpret_cast<char*>(header_)+headerUsed_:storage_+used_;}
  size_t writable() const {return ready_||invalid_?0:headerUsed_<headerNeed_?headerNeed_-headerUsed_:length_-used_;}
  bool received(size_t bytes,uint32_t now){
    if(invalid_||ready_||bytes>writable())return fail();
    if(!bytes)return true;
    if(!partial_){partial_=true;since_=now;}
    if(headerUsed_<headerNeed_){
      headerUsed_+=bytes;
      if(headerUsed_==2&&headerNeed_==2){
        opcode_=header_[0]&15;
        const uint8_t length=header_[1]&127;
        if((header_[0]&0xf0)!=0x80||(header_[1]&0x80)||
           (opcode_!=1&&opcode_!=8&&opcode_!=9&&opcode_!=10)||length==127||
           (opcode_>=8&&length>125))return fail();
        if(length==126){headerNeed_=4;return true;}
        length_=length;
      }else if(headerUsed_==4){
        length_=(uint16_t(header_[2])<<8)|header_[3];
        if(length_<126)return fail();
      }
      if(headerUsed_==headerNeed_){
        if(!storage_||!storageBytes_||length_>capacity_||length_>4096||(opcode_==8&&length_==1))return fail();
        if(!length_){storage_[0]=0;ready_=true;}
      }
    }else{
      used_+=bytes;
      if(used_==length_){storage_[used_]=0;ready_=true;}
    }
    return true;
  }
  bool ready()const{return ready_;}
  bool expired(uint32_t now)const{return partial_&&!ready_&&uint32_t(now-since_)>=1000;}
  uint16_t opcode()const{return headerUsed_>=2?opcode_:256;}
  size_t length()const{return length_;}
  void clear(){
    if(storage_&&storageBytes_)wipePcm(storage_,storageBytes_);
    wipePcm(header_,sizeof(header_));headerUsed_=0;headerNeed_=2;length_=used_=0;
    opcode_=256;partial_=ready_=invalid_=false;since_=0;
  }
private:
  bool fail(){invalid_=true;return false;}
  char* storage_;size_t storageBytes_,capacity_;
  uint8_t header_[4]={};size_t headerUsed_=0,headerNeed_=2,length_=0,used_=0;
  uint16_t opcode_=256;uint32_t since_=0;
  bool partial_=false,ready_=false,invalid_=false;
};
}
