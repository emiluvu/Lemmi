#include "../audio/PendingWrite.h"
#include <cassert>
#include <cstdio>
#include <string>

using Pending=lemmi::PendingWrite;
int main(){
  const std::string bytes="stable-masked-frames";
  Pending p;
  assert(p.begin(bytes.data(),bytes.size(),0,240));
  assert(!p.begin(bytes.data(),bytes.size(),0,240));
  unsigned reads=0,controls=0,attempts=0;
  std::string accepted;
  // More than the former 100ms timeout, without blocking either read/control
  // servicing or extending the original 240ms oldest-capture limit.
  for(uint32_t now=0;now<=160;now+=2){
    auto outcome=p.step(now,true,-2,-3,[&](const char* data,size_t n){
      ++attempts;
      if(now<150)return Pending::Attempt{0,false};
      accepted.append(data,n);return Pending::Attempt{int(n),true};
    });
    ++reads;++controls;
    if(outcome==Pending::Complete)break;
    assert(outcome==Pending::Pending);
  }
  assert(accepted==bytes&&reads==76&&controls==76&&attempts==76);
  p.clear();assert(p.begin(bytes.data(),bytes.size(),10,240));
  const char* retryData=nullptr;size_t retrySize=0;
  assert(p.step(20,true,-2,-3,[&](const char* data,size_t n){
    retryData=data;retrySize=n;return Pending::Attempt{-3,true};
  })==Pending::Pending);
  assert(p.step(21,true,-2,-3,[&](const char* data,size_t n){
    assert(data==retryData&&n==retrySize);return Pending::Attempt{3,true};
  })==Pending::Pending);
  assert(p.step(22,true,-2,-3,[&](const char* data,size_t n){
    assert(data==bytes.data()+3&&n==bytes.size()-3);return Pending::Attempt{int(n),true};
  })==Pending::Complete);
  // A zero plaintext count after entering TLS is NOT safe to discard.
  p.clear();assert(p.begin(bytes.data(),bytes.size(),0,240));
  assert(p.step(0,true,-2,-3,[](const char*,size_t){return Pending::Attempt{-2,true};})==Pending::Pending);
  assert(p.sent()==0&&p.touched());
  unsigned calls=0;
  auto forbidden=[&](const char*,size_t){++calls;return Pending::Attempt{1,true};};
  assert(p.step(1,false,-2,-3,forbidden)==Pending::Close&&calls==0);
  assert(p.step(240,true,-2,-3,forbidden)==Pending::Close&&calls==0);
  // Pure socket polling has not entered TLS. Stop/revision cancellation can
  // discard it and send the already-defined input.stop on the same connection.
  p.clear();assert(p.begin(bytes.data(),bytes.size(),0,240));
  assert(p.step(100,true,-2,-3,[](const char*,size_t){return Pending::Attempt{0,false};})==Pending::Pending);
  assert(p.step(101,false,-2,-3,forbidden)==Pending::CancelledSafe&&calls==0);
  assert(p.step(240,true,-2,-3,forbidden)==Pending::ExpiredSafe&&calls==0);
  // Deadline follows enqueue time, not each retry/new service timestamp.
  p.clear();assert(p.begin(bytes.data(),bytes.size(),0xfffffff0u,240));
  assert(p.step(0xe0,true,-2,-3,forbidden)==Pending::ExpiredSafe&&calls==0);
  p.clear();assert(p.begin(bytes.data(),bytes.size(),0,240));
  assert(p.step(0,true,-2,-3,[](const char*,size_t){return Pending::Attempt{2,true};})==Pending::Pending);
  assert(p.step(1,false,-2,-3,forbidden)==Pending::Close);
  p.clear();assert(p.begin(bytes.data(),bytes.size(),0,240));
  assert(p.step(0,true,-2,-3,[](const char*,size_t){return Pending::Attempt{-9,false};})==Pending::Close);
  p.clear();assert(p.begin(bytes.data(),bytes.size(),0,240));
  assert(p.step(0,true,-2,-3,[](const char*,size_t n){return Pending::Attempt{int(n+1),true};})==Pending::Close);
  puts("PASS: resumable backpressure, exact TLS retry identity, partial writes, safe/dirty cancellation, age bound and wrap");
}
