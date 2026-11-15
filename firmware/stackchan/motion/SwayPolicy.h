#pragma once
#include <stdint.h>
// One bounded preset; no animation queue, model angles, or external clock.
class SwayPolicy {
public:
  void pet(uint32_t now){ if(!active_){pending_=true;release_=false;petAt_=now;} }
  void cancel(){pending_=active_=release_=false;step_=0;}
  // Return 1 to begin after a fresh stable release, -1 to halt, otherwise 0.
  int poll(bool allowed,bool touched,uint32_t now){
    if(!allowed || (active_&&touched) || ((pending_||active_)&&uint32_t(now-petAt_)>6000)){
      const bool had=pending_||active_;cancel();return had?-1:0;
    }
    if(!pending_)return 0;
    if(touched){release_=false;return 0;}
    if(!release_){release_=true;releaseAt_=now;}
    if(uint32_t(now-releaseAt_)>=500){pending_=false;active_=true;step_=0;return 1;}
    return 0;
  }
  // Caller executes the command then calls sent(). No catch-up burst after stalls.
  // Targets are raw offsets from a separately validated measured starting pose.
  bool next(uint32_t now,int& offset,uint16_t& duration){
    if(!active_ || (step_ && uint32_t(now-sentAt_)<lastDuration_+100u))return false;
    if(step_>=3){active_=false;return false;}
    const int offsets[]={6,-6,0};const uint16_t durations[]={800,1600,800};
    offset=offsets[step_];duration=durations[step_];return true;
  }
  void sent(uint32_t now,uint16_t duration){sentAt_=now;lastDuration_=duration;++step_;}
  bool active()const{return active_;}
private:
  bool pending_=false,active_=false,release_=false;
  uint8_t step_=0;
  uint16_t lastDuration_=0;
  uint32_t petAt_=0,releaseAt_=0,sentAt_=0;
};
