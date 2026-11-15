#pragma once
#include <stdint.h>
#include <stddef.h>
namespace servoPacket {
inline size_t request(uint8_t* out,uint8_t instruction,uint8_t reg,const uint8_t* data,size_t size,uint8_t id=1){
  if(!out||!data||size<1||size>6)return 0;
  if(id!=1&&id!=2)return 0;
  out[0]=out[1]=255;out[2]=id;out[3]=uint8_t(size+3);out[4]=instruction;out[5]=reg;
  uint8_t sum=uint8_t(id+out[3]+instruction+reg);
  for(size_t i=0;i<size;i++){out[6+i]=data[i];sum=uint8_t(sum+data[i]);}
  out[6+size]=uint8_t(~sum);return 7+size;
}
inline bool reply(const uint8_t* data,size_t length,size_t payload,uint8_t id=1){
  if(!data||payload>6||length!=payload+6||data[0]!=255||data[1]!=255||data[2]!=id||data[3]!=payload+2||data[4]!=0)return false;
  uint8_t sum=0;for(size_t i=2;i<length;i++)sum=uint8_t(sum+data[i]);
  return sum==255;
}
}
