#pragma once
#include <stddef.h>
#include <stdint.h>

namespace lemmi {
// One worker-owned immutable buffer, one nonblocking attempt per service pass.
// A retry must preserve pointer/length after TLS WANT. Never interleave another
// TLS write until this completes. Reads and local controls run between passes.
class PendingWrite {
public:
  enum Outcome : uint8_t { Idle, Pending, Complete, CancelledSafe, ExpiredSafe, Close };
  struct Attempt { int result; bool enteredTls; };
  bool begin(const char* data,size_t bytes,uint32_t oldest,uint32_t lifetime) {
    if(active_||!data||!bytes||!lifetime)return false;
    data_=data;bytes_=bytes;sent_=0;oldest_=oldest;lifetime_=lifetime;
    last_=0;touched_=false;active_=true;return true;
  }
  template<class Write> Outcome step(uint32_t now,bool allowed,int wantRead,int wantWrite,Write write) {
    if(!active_)return Idle;
    if(!allowed)return touched_?Close:CancelledSafe;
    if(uint32_t(now-oldest_)>=lifetime_)return touched_?Close:ExpiredSafe;
    const Attempt attempt=write(data_+sent_,bytes_-sent_);
    touched_=touched_||attempt.enteredTls;last_=attempt.result;
    if(last_>0) {
      if(!attempt.enteredTls||size_t(last_)>bytes_-sent_)return Close;
      sent_+=size_t(last_);
      if(sent_==bytes_)return Complete;
    } else if(last_!=0&&last_!=wantRead&&last_!=wantWrite)return Close;
    return Pending;
  }
  bool active()const{return active_;}
  bool touched()const{return touched_;}
  size_t sent()const{return sent_;}
  int last()const{return last_;}
  uint32_t age(uint32_t now)const{return uint32_t(now-oldest_);}
  // Caller wipes its buffer only after handling the terminal outcome. A dirty
  // cancel/expiry requires closing TLS, even if accepted plaintext bytes are 0.
  void clear(){data_=nullptr;bytes_=sent_=0;oldest_=lifetime_=0;last_=0;touched_=active_=false;}
private:
  const char* data_=nullptr;
  size_t bytes_=0,sent_=0;
  uint32_t oldest_=0,lifetime_=0;
  int last_=0;
  bool touched_=false,active_=false;
};
}
