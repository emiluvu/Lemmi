#include "../audio/WsFrameWriter.h"
#include "../audio/WsFrameBatch.h"
#include <cassert>
#include <string>
#include <cstdio>
int main(){
  lemmi::WsFrameWriter writer;const uint8_t mask[4]={0x37,0xfa,0x21,0x3d};
  for(size_t length:{size_t(0),size_t(1),size_t(125),size_t(126),size_t(640),size_t(4096)}){
    std::string payload(length,'x');const auto original=payload;
    assert(writer.prepare(1,payload.data(),payload.size(),mask));
    const auto data=reinterpret_cast<const uint8_t*>(writer.data());
    size_t head=length<126?6:8;
    assert(data[0]==0x81&&writer.size()==head+length&&(data[1]&0x80));
    if(length>=126)assert(data[1]==0xfe&&((size_t(data[2])<<8)|data[3])==length);
    for(size_t i=0;i<length;++i)assert((data[head+i]^mask[i%4])==uint8_t(payload[i]));
    assert(payload==original);writer.clear();
    for(size_t i=0;i<4104;++i)assert(writer.data()[i]==0);
  }
  assert(writer.prepare(10,nullptr,0,mask)&&writer.size()==6);
  assert(writer.prepare(8,nullptr,0,mask));
  std::string big(4097,'x');assert(!writer.prepare(1,big.data(),big.size(),mask));
  assert(!writer.prepare(9,"",0,mask)&&!writer.prepare(1,nullptr,1,mask));
  assert(!writer.prepare(8,big.data(),126,mask));
  lemmi::WsFrameBatch batch;
  std::string expected;
  for(unsigned i=0;i<4;++i){
    std::string text(1500,char('a'+i));
    assert(writer.prepare(1,text.data(),text.size(),mask));
    expected.append(writer.data(),writer.size());
    assert(batch.append(writer));
  }
  assert(batch.count()==4&&std::string(batch.data(),batch.size())==expected);
  assert(!batch.append(writer));batch.clear();
  for(size_t i=0;i<lemmi::WsFrameBatch::Bytes;++i)assert(batch.data()[i]==0);
  assert(writer.prepare(1,big.data(),4096,mask));
  assert(batch.append(writer)&&!batch.append(writer)); // exact byte cap
  std::puts("PASS: combined masked WS frames, exact boundaries, immutable input and frame erasure");
}
