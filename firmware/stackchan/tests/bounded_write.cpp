#include "../audio/BoundedWrite.h"
#include <cassert>
#include <cstdio>
#include <string>
int main(){
  const std::string frame="fixed-frame-payload";
  uint32_t now=0;std::string written;int call=0;
  auto result=lemmi::boundedWrite(frame.data(),frame.size(),100,-2,-3,
    [&](const char* p,size_t n,uint32_t timeout){
      assert(timeout>0&&timeout<=20);++call;
      if(call==1)return -2;
      if(call==2)return 0;
      if(call==3)return -3;
      size_t sent=n<3?n:3;written.append(p,sent);return int(sent);
    },[]{return true;},[&]{return now;},[&]{now+=2;});
  assert(result.status==lemmi::WriteResult::Complete&&written==frame&&result.sent==frame.size());
  now=0;call=0;
  result=lemmi::boundedWrite(frame.data(),frame.size(),10,-2,-3,
    [&](const char*,size_t,uint32_t){++call;return 0;},[]{return true;},[&]{return now;},[&]{now+=2;});
  assert(result.status==lemmi::WriteResult::TimedOut&&call==5&&result.sent==0);
  now=0;bool allowed=true;
  result=lemmi::boundedWrite(frame.data(),frame.size(),100,-2,-3,
    [&](const char*,size_t,uint32_t){allowed=false;return 3;},[&]{return allowed;},[&]{return now;},[&]{++now;});
  assert(result.status==lemmi::WriteResult::Cancelled&&result.sent==3);
  call=0;
  result=lemmi::boundedWrite(frame.data(),frame.size(),100,-2,-3,
    [&](const char*,size_t,uint32_t){++call;return -9;},[]{return true;},[&]{return now;},[]{});
  assert(result.status==lemmi::WriteResult::Failed&&call==1); // real errors never retried
  result=lemmi::boundedWrite(frame.data(),frame.size(),100,-2,-3,
    [](const char*,size_t n,uint32_t){return int(n+1);},[]{return true;},[&]{return now;},[]{});
  assert(result.status==lemmi::WriteResult::Failed);
  now=0xfffffffdu;
  result=lemmi::boundedWrite(frame.data(),frame.size(),10,-2,-3,
    [](const char*,size_t,uint32_t){return 0;},[]{return true;},[&]{return now;},[&]{now+=2;});
  assert(result.status==lemmi::WriteResult::TimedOut);
  std::puts("PASS: bounded TLS retry/short-write ordering, exact bytes, Stop cancellation, hard errors and deadlines");
}
