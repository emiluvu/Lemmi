#include "../audio/WsFrameReader.h"
#include <cassert>
#include <cstdio>
#include <vector>
#include <algorithm>
#include <string>

static std::vector<uint8_t> frame(const std::string& payload,uint8_t opcode=1){
  std::vector<uint8_t> bytes={uint8_t(0x80|opcode)};
  if(payload.size()<126)bytes.push_back(uint8_t(payload.size()));
  else{bytes.push_back(126);bytes.push_back(uint8_t(payload.size()>>8));bytes.push_back(uint8_t(payload.size()));}
  bytes.insert(bytes.end(),payload.begin(),payload.end());return bytes;
}
static bool feed(lemmi::WsFrameReader& r,const std::vector<uint8_t>& bytes,size_t segment,uint32_t start=10){
  size_t pos=0;uint32_t now=start;
  while(pos<bytes.size()){
    const size_t n=std::min(segment,std::min(bytes.size()-pos,r.writable()));
    if(!n)return false;
    memcpy(r.destination(),bytes.data()+pos,n);pos+=n;
    if(!r.received(n,now))return false;
    if(!r.ready()&&!r.received(0,now))return false; // TLS WANT_READ between any reads
  }
  return r.ready();
}
int main(){
  for(size_t size:{size_t(2),size_t(125),size_t(126),size_t(882),size_t(4096)}){
    std::string payload(size,'x');
    for(size_t fragment:{size_t(1),size_t(2),size_t(3),size_t(127),size_t(1024)}){
      char buffer[4097]={};lemmi::WsFrameReader r(buffer,sizeof(buffer));
      // Test every byte split with immediate WANT_READ between reads. The
      // separate deadline tests below check stalled partial-frame timing.
      assert(feed(r,frame(payload),fragment));assert(r.opcode()==1&&r.length()==size);
      assert(std::string(buffer,size)==payload);r.clear();
      assert(std::all_of(buffer,buffer+sizeof(buffer),[](char c){return c==0;}));
    }
  }
  for(uint8_t opcode:{uint8_t(8),uint8_t(9),uint8_t(10)}){
    char buffer[4097];lemmi::WsFrameReader r(buffer,sizeof(buffer));
    assert(feed(r,frame("",opcode),1)&&r.opcode()==opcode&&r.length()==0);
    r.clear();assert(feed(r,frame("{}"),1)&&r.opcode()==1);
  }
  for(auto bad:std::vector<std::vector<uint8_t>>{{0x01,0},{0xc1,0},{0x81,0x80},{0x82,0},
      {0x89,126},{0x81,127},{0x81,126,0,125},{0x81,126,0x10,1},{0x88,1}}){
    char buffer[4097];lemmi::WsFrameReader r(buffer,sizeof(buffer));assert(!feed(r,bad,1));
  }
  char buffer[4097];lemmi::WsFrameReader r(buffer,sizeof(buffer));
  *r.destination()=char(0x81);assert(r.received(1,100));
  assert(r.received(0,500)&&!r.expired(1099)&&r.expired(1100));
  assert(r.opcode()==256);r.clear();
  *r.destination()=char(0x81);assert(r.received(1,0xfffffff0u));
  assert(!r.expired(10)&&r.expired(1000));
  r.clear();assert(!r.received(3,0)); // caller cannot overflow a header slot
  char guard=42;{lemmi::WsFrameReader noStorage(&guard,0);assert(!feed(noStorage,frame("",9),1));}
  assert(guard==42);
  std::puts("PASS: incremental WS headers/payloads, TLS timeouts, exact bounds, control frames, malformed frames and deadlines");
}
