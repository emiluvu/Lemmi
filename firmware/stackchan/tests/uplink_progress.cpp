#include "../audio/VoiceBridge.h"
#include "../audio/PendingWrite.h"
#include "../audio/WsFrameBatch.h"
#include <cassert>
#include <cstdio>

TestM5 M5;

static void rehearsal(bool permanentStall){
  VoiceBridge voice;
  ControlPolicy state;
  state.ready=state.snapshot=state.ownsEndpoint=state.audioSupported=state.hasGrant=true;
  state.stopped=state.serverMuted=false;
  strcpy(state.session,"fixture-session");strcpy(state.lease,"fixture-lease");
  strcpy(state.phase,"listening");strcpy(state.grantTurn,"fixture-turn");strcpy(state.grantStream,"fixture-input");
  state.grantExpires=int64_t(time(nullptr))+20;
  voice.speak();voice.tick(state,1,false,false,100);
  lemmi::PendingWrite pending;
  lemmi::WsFrameBatch batch;
  lemmi::WsFrameWriter frame;
  VoiceBridge::Outbound outbound;
  uint32_t micAt=116,lastBatch=100,firstAttempt=0;
  uint16_t next=0,sent=0,batchChunks=0,total=0;
  unsigned readsDuringStall=0,controlsDuringStall=0;
  bool ended=false,stop=false,endInBatch=false;
  for(uint32_t now=102;now<3000;++now){
    state.heartbeatAt=now;
    if(now<2000&&now>=micAt&&M5.Mic.recording){M5.Mic.complete();micAt=now+16;}
    if(now==2000)assert(voice.finish(now));
    voice.tick(state,1,false,false,now);
    assert(!voice.fault.load());
    if(pending.active()){
      auto result=pending.step(now,true,-2,-3,[&](const char*,size_t bytes){
        if(permanentStall||now-firstAttempt<150)return lemmi::PendingWrite::Attempt{0,false};
        return lemmi::PendingWrite::Attempt{int(bytes),true};
      });
      if(result==lemmi::PendingWrite::Pending){++readsDuringStall;++controlsDuringStall;}
      else if(result==lemmi::PendingWrite::Complete){
        sent+=batchChunks;if(endInBatch)ended=true;
        pending.clear();batch.clear();batchChunks=0;endInBatch=false;
      }else{
        assert(result==lemmi::PendingWrite::ExpiredSafe&&permanentStall);
        // Adapter's safe expiry cancels the complete input turn, never forges
        // audio.end or drains a permanently stalled queue indefinitely.
        pending.clear();batch.clear();voice.cancelAll();stop=true;break;
      }
    }
    if(!pending.active()&&(!voice.capturing()||now-lastBatch>=60||voice.outgoing.size()>=4)){
      lastBatch=now;
      uint32_t oldest=now;
      for(unsigned i=0;i<4&&voice.outgoing.pop(outbound);++i){
        assert(now-outbound.queuedAt<VoiceBridge::CaptureQueueMs);
        if(!i)oldest=outbound.queuedAt;
        if(outbound.kind==VoiceBridge::InputChunk){assert(outbound.count==next++);++batchChunks;}
        else{assert(outbound.kind==VoiceBridge::InputEnd&&outbound.count==next);total=outbound.count;endInBatch=true;}
        // Size-only fictional wire envelope; this is a queue/progress rehearsal,
        // not a gateway parser or measured TCP/ACK simulation.
        char envelope[1250]={};uint8_t mask[4]={1,2,3,4};
        assert(frame.prepare(1,envelope,sizeof(envelope),mask));assert(batch.append(frame));
        frame.clear();lemmi::wipePcm(&outbound,sizeof(outbound));
      }
      if(batch.size()){
        assert(pending.begin(batch.data(),batch.size(),oldest,VoiceBridge::CaptureQueueMs));
        if(!firstAttempt)firstAttempt=now;
      }
    }
    if(ended)break;
  }
  if(permanentStall)assert(stop&&!ended&&sent==0&&!M5.Mic.running&&voice.outgoing.empty());
  else assert(ended&&sent==total&&sent>80&&voice.outgoing.empty());
  assert(readsDuringStall>100&&controlsDuringStall>100);
  voice.cancelAll();
}

int main(){
  rehearsal(false);rehearsal(true);
  puts("PASS: live-cadence capture queues survive 150ms zero progress; permanent stall cancels/wipes without false end");
}
