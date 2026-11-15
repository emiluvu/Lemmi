#pragma once
#include <stddef.h>
#include <stdint.h>

namespace lemmi {
struct WriteResult {
  enum Status : uint8_t { Complete, Cancelled, TimedOut, Failed } status;
  size_t sent;
  int last;
};
// A single frame remains stable until completion. Only explicit TLS WANT
// statuses/zero-byte polls are retryable. Partial writes advance by exactly the
// accepted bytes; cancellation/deadline after any progress requires closing.
template<class Write,class Allowed,class Clock,class Yield>
WriteResult boundedWrite(const char* data,size_t bytes,uint32_t timeout,int wantRead,int wantWrite,
                         Write write,Allowed allowed,Clock clock,Yield yield){
  uint32_t start=clock();size_t sent=0;int last=0;
  for(unsigned attempts=0;attempts<128;++attempts){
    if(!allowed())return {WriteResult::Cancelled,sent,last};
    uint32_t elapsed=uint32_t(clock()-start);
    if(elapsed>=timeout)return {WriteResult::TimedOut,sent,last};
    uint32_t left=timeout-elapsed;
    last=write(data+sent,bytes-sent,left<20?left:20);
    if(last>0){
      if(size_t(last)>bytes-sent)return {WriteResult::Failed,sent,last};
      sent+=size_t(last);
      if(sent==bytes)return {WriteResult::Complete,sent,last};
    }else if(last!=0&&last!=wantRead&&last!=wantWrite)return {WriteResult::Failed,sent,last};
    yield();
  }
  return {WriteResult::TimedOut,sent,last};
}
}
