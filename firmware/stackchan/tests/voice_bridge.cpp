#include "../audio/VoiceBridge.h"
#include <cassert>
#include <cstdio>
#include <thread>
#include <algorithm>
#include <utility>

TestM5 M5;
using V=VoiceBridge;
static ControlPolicy current(){
  ControlPolicy s;s.ready=s.snapshot=s.ownsEndpoint=s.audioSupported=true;
  s.stopped=s.serverMuted=false;strcpy(s.session,"fixture-session");strcpy(s.lease,"fixture-lease");
  s.generation=2;s.profileRevision=s.privacyRevision=s.policyRevision=1;
  strcpy(s.phase,"ready");return s;
}
static void grant(ControlPolicy& s,const char* stream="input-stream"){
  strcpy(s.phase,"listening");s.hasGrant=true;s.grantExpires=int64_t(time(nullptr))+20;
  strcpy(s.grantTurn,"input-turn");strcpy(s.grantStream,stream);
}
static void clearQueues(V& v){v.cancelAll();}
static speechwire::Output output(ControlPolicy s,speechwire::Kind kind){
  speechwire::Output m={};m.kind=kind;m.localEpoch=1;m.generation=s.generation;
  m.profileRevision=s.profileRevision;m.privacyRevision=s.privacyRevision;m.policyRevision=s.policyRevision;
  strcpy(m.session,s.session);strcpy(m.lease,s.lease);strcpy(m.turn,"input-turn");strcpy(m.stream,"output-stream");
  m.outputWindowChunks=s.outputWindowChunks;m.format={22050,2,882,1};m.bytes=2;m.count=1;m.pcm[0]=0x34;m.pcm[1]=0x12;return m;
}
static void openInput(V& v,ControlPolicy& s){
  v.speak();grant(s);v.tick(s,1,false,false,100);
  assert(v.capturing()&&M5.Mic.running);
}
static unsigned latencyRehearsal(uint32_t feedbackDelay,uint16_t window=4){
  V v;assert(v.begin());auto s=current();s.outputWindowChunks=window;openInput(v,s);
  s.hasGrant=false;strcpy(s.phase,"processing");v.tick(s,1,false,false,120);
  constexpr uint16_t count=49; // cross multiple ring wraps and an odd final tail
  auto start=output(s,speechwire::Start);start.format={16000,640*count,640,count};v.offer(start,1);
  std::deque<std::pair<uint32_t,uint16_t>> pending;
  for(uint16_t i=0;i<window;++i)pending.push_back({140,i});
  uint16_t sent=window,played=0;uint32_t nextRelease=0,lastProgress=0;bool completed=false,started=false;
  for(uint32_t now=140;now<4000&&!completed;now+=2){
    while(!pending.empty()&&pending.front().first<=now){
      auto m=output(s,speechwire::Chunk);m.index=pending.front().second;m.bytes=640;
      pending.pop_front();assert(v.offer(m,1));
      if(m.index+1==count){m=output(s,speechwire::End);m.count=count;assert(v.offer(m,1));}
    }
    if(nextRelease&&now>=nextRelease){
      M5.Speaker.release();nextRelease=M5.Speaker.playing?nextRelease+20:0;
    }
    v.tick(s,1,false,false,now);assert(!v.fault.load());
    if(!nextRelease&&M5.Speaker.playing)nextRelease=now+20;
    V::Outbound receipt;
    while(v.outgoing.pop(receipt)){
      assert(receipt.kind==V::Receipt&&strcmp(receipt.status,"failed"));
      if(!strcmp(receipt.status,"started")){assert(!started&&receipt.count==0);started=true;}
      if(!strcmp(receipt.status,"progress")){
        if(lastProgress&&receipt.count!=count)assert(now-lastProgress>=40);
        lastProgress=now;
        assert(started&&receipt.count>=played&&receipt.count<=sent);played=receipt.count;
        while(sent<count&&sent<played+window){pending.push_back({now+feedbackDelay,sent});++sent;}
      }
      if(!strcmp(receipt.status,"completed")){assert(played==count&&receipt.count==count);completed=true;}
    }
  }
  assert(completed&&!M5.Speaker.running&&v.consumedChunks()==count);
  const auto waits=v.bufferWaits();clearQueues(v);return waits;
}
int main(){
  {
    V v;v.begin();auto s=current();openInput(v,s);
    uint32_t nextMic=116,workerReady=100,lastBatch=100;uint16_t sent=0;bool ended=false;
    // Independent 16ms microphone buffers while the network worker stalls
    // 72ms per write. Four-frame batches must sustain the real input cadence.
    for(uint32_t now=102;now<5000;now+=2){
      s.heartbeatAt=now;
      if(now<4500&&now>=nextMic&&M5.Mic.recording){M5.Mic.complete();nextMic=now+16;}
      if(now==4500)assert(v.finish(now));
      v.tick(s,1,false,false,now);assert(!v.fault.load());
      if(now>=workerReady&&(!v.capturing()||now-lastBatch>=60||v.outgoing.size()>=4)){
        V::Outbound o;unsigned count=0;
        while(count<4&&v.outgoing.pop(o)){
          assert(now-o.queuedAt<240);
          if(o.kind==V::InputChunk)assert(o.count==sent++);
          else {assert(o.kind==V::InputEnd&&o.count==sent);ended=true;}
          ++count;
        }
        if(count){workerReady=now+72;lastBatch=now;}
      }
    }
    assert(ended&&sent>200&&v.outgoing.empty());clearQueues(v);
  }
  {
    V v;v.begin();auto s=current();openInput(v,s);
    // 240ms of complete frames fits without sample loss; Finished retains its
    // reserved slot even when the consumer has not drained the capture queue.
    for(uint32_t now=116;now<=340;now+=16){M5.Mic.complete();v.tick(s,1,false,false,now);assert(!v.fault.load());}
    assert(v.outgoing.size()==12&&v.finish(341));
    V::Outbound o;uint16_t expected=0;
    while(v.outgoing.pop(o)){
      if(o.kind==V::InputChunk){assert(o.count==expected++&&o.queuedAt>=116);}
      else assert(o.kind==V::InputEnd&&o.count==12);
    }
    assert(expected==12&&!M5.Mic.running);clearQueues(v);
  }
  for(int mode=0;mode<2;++mode){
    V v;v.begin();auto s=current();grant(s);v.speak();
    M5.Mic.rejectBegin=mode==0;M5.Mic.rejectRecord=mode==1;
    v.tick(s,1,false,false,100);
    assert(v.fault.load()&&v.failure.load()==(mode==0?V::MicBegin:V::MicRecord));
    v.cancelAll();M5.Mic.rejectBegin=M5.Mic.rejectRecord=false;
  }
  {
    V v;v.begin();auto s=current();openInput(v,s);
    // Simulate a stalled network consumer. No dropped/reordered capture may
    // silently continue when the fixed capture queue fills.
    for(uint32_t now=120;now<1000&&!v.fault.load();now+=16){M5.Mic.complete();v.tick(s,1,false,false,now);}
    assert(v.fault.load()&&v.failure.load()==V::OutgoingFull);
    v.fail(V::MicRecord);assert(v.failure.load()==V::OutgoingFull); // preserve first cause
    v.cancelAll();assert(!M5.Mic.running&&v.outgoing.empty());
  }
  assert(latencyRehearsal(100,12)==0);
  assert(latencyRehearsal(40)==0);
  // Four 20ms network chunks cannot hide a 100ms feedback delay. Keep this
  // limitation visible; firmware cannot enlarge the server's granted window.
  assert(latencyRehearsal(100)>0);
  for(int interruption=0;interruption<3;++interruption){
    V v;assert(v.begin());auto s=current();s.outputWindowChunks=12;openInput(v,s);
    s.hasGrant=false;strcpy(s.phase,"processing");v.tick(s,1,false,false,120);
    auto m=output(s,speechwire::Start);m.format={16000,640*12,640,12};assert(v.offer(m,1));
    for(uint16_t i=0;i<12;++i){m=output(s,speechwire::Chunk);m.bytes=640;m.index=i;assert(v.offer(m,1));}
    m=output(s,speechwire::End);m.count=12;assert(v.offer(m,1));
    v.tick(s,1,false,false,140);assert(M5.Speaker.requests.size()==2&&v.receivedChunks()==12);
    if(interruption==0)v.cancelAll();
    if(interruption==1){++s.privacyRevision;v.tick(s,1,false,false,150);}
    if(interruption==2){s.ownsEndpoint=false;v.tick(s,1,false,false,150);}
    assert(!M5.Speaker.running&&v.outgoing.empty()&&v.incoming.empty());
    clearQueues(v);
  }
  // Consumed queue slots must not retain the fixture's PCM byte pattern.
  {
    struct Secret {uint8_t bytes[64];};Secret secret;memset(&secret,0xa7,sizeof(secret));
    lemmi::WipingQueue<Secret,2> queue;
    auto begin=reinterpret_cast<const uint8_t*>(&queue),end=begin+sizeof(queue);
    assert(queue.push(secret));
    assert(std::search(begin,end,secret.bytes,secret.bytes+32)!=end);
    Secret copy;assert(queue.pop(copy));
    assert(std::search(begin,end,secret.bytes,secret.bytes+32)==end);
    assert(!queue.pop(copy));
  }
  // Actual concurrent producer/consumer exercise fixed capacity and ordering.
  {
    lemmi::WipingQueue<unsigned,4> queue;
    std::thread producer([&]{for(unsigned i=1;i<=10000;++i)while(!queue.push(i))std::this_thread::yield();});
    for(unsigned expected=1;expected<=10000;++expected){unsigned value=0;while(!queue.pop(value))std::this_thread::yield();assert(value==expected);}
    producer.join();assert(queue.empty());
  }
  // A listening snapshot and unmute alone cannot activate the mic.
  {
    V v;assert(v.begin());auto s=current();grant(s);
    v.tick(s,1,false,false,100);assert(!v.capturing()&&!M5.Mic.running);
    v.speak();v.tick(s,1,false,true,101);assert(!v.capturing());
    v.tick(s,1,false,false,102);assert(v.capturing());
    M5.Mic.complete();v.tick(s,1,false,false,120);
    M5.Mic.complete();v.tick(s,1,false,false,140);
    V::Outbound message;assert(v.outgoing.pop(message));
    assert(message.kind==V::InputChunk&&message.count==0&&message.inputEpoch==v.inputEpoch.load());
    assert(message.pcm[0]==0x80&&message.pcm[1]==0xff); // -128 little endian
    assert(v.finish(145)&&!M5.Mic.running&&!v.capturing());
    assert(v.outgoing.pop(message)&&message.kind==V::InputEnd&&message.count==1);
    v.tick(s,1,false,false,150);assert(!v.capturing()); // same grant cannot reopen
    clearQueues(v);
  }
  // Cut-short requests may invoke the SDK release callback; Stop must not emit played receipts.
  {
    V v;assert(v.begin());auto s=current();openInput(v,s);s.hasGrant=false;strcpy(s.phase,"processing");
    v.tick(s,1,false,false,120);
    auto m=output(s,speechwire::Start);assert(v.offer(m,1));
    m=output(s,speechwire::Chunk);assert(v.offer(m,1));
    m=output(s,speechwire::End);assert(v.offer(m,1));
    v.tick(s,1,false,false,130);assert(M5.Speaker.playing&&!M5.Mic.running);
    assert(v.outgoing.empty()); // queued is not played
    v.cancelAll();assert(!M5.Speaker.running&&v.outgoing.empty());
    // A late chunk cannot reopen after the local cancellation latch.
    m=output(s,speechwire::Start);v.offer(m,1);v.tick(s,2,true,false,140);
    assert(!M5.Speaker.running);clearQueues(v);
  }
  // Actual mixer release emits started(0), progress(1), then completion only after drain guard.
  {
    V v;assert(v.begin());auto s=current();openInput(v,s);s.hasGrant=false;strcpy(s.phase,"processing");v.tick(s,1,false,false,120);
    auto m=output(s,speechwire::Start);v.offer(m,1);m=output(s,speechwire::Chunk);v.offer(m,1);m=output(s,speechwire::End);v.offer(m,1);
    v.tick(s,1,false,false,130);M5.Speaker.release();v.tick(s,1,false,false,150);
    V::Outbound o;assert(v.outgoing.pop(o)&&!strcmp(o.status,"started")&&o.count==0);
    assert(v.outgoing.pop(o)&&!strcmp(o.status,"progress")&&o.count==1);
    v.tick(s,1,false,false,249);assert(v.outgoing.empty());
    v.tick(s,1,false,false,250);assert(v.outgoing.pop(o)&&!strcmp(o.status,"completed")&&o.count==1);
    assert(!M5.Speaker.running);clearQueues(v);
  }
  // Mic mute cancels capture and unsent turn data, not unrelated output.
  {
    V v;assert(v.begin());auto s=current();openInput(v,s);s.hasGrant=false;strcpy(s.phase,"processing");v.tick(s,1,false,false,120);
    auto m=output(s,speechwire::Start);m.format={16000,640*4,640,4};v.offer(m,1);
    for(uint16_t i=0;i<3;++i){m=output(s,speechwire::Chunk);m.bytes=640;m.index=i;m.pcm[0]=uint8_t(i+1);m.pcm[1]=0;v.offer(m,1);}
    v.tick(s,1,false,false,130);assert(!M5.Speaker.playing); // bounded startup buffer
    m=output(s,speechwire::Chunk);m.bytes=640;m.index=3;m.pcm[0]=4;m.pcm[1]=0;v.offer(m,1);
    m=output(s,speechwire::End);m.count=4;v.offer(m,1);
    v.tick(s,1,false,false,140);assert(M5.Speaker.requests.size()==2);
    assert(static_cast<const int16_t*>(M5.Speaker.requests[0])[0]==1);
    assert(static_cast<const int16_t*>(M5.Speaker.requests[1])[0]==2);
    M5.Speaker.release();M5.Speaker.release();v.tick(s,1,false,false,180);
    assert(M5.Speaker.requests.size()==2); // next two queued in order, no buffer reuse
    assert(static_cast<const int16_t*>(M5.Speaker.requests[0])[0]==3);
    assert(static_cast<const int16_t*>(M5.Speaker.requests[1])[0]==4);
    V::Outbound o;assert(v.outgoing.pop(o)&&!strcmp(o.status,"started")&&o.count==0);
    assert(v.outgoing.pop(o)&&!strcmp(o.status,"progress")&&o.count==2);
    assert(v.receivedChunks()==4&&v.consumedChunks()==2);
    v.cancelAll();assert(!M5.Speaker.playing&&v.outgoing.empty());clearQueues(v);
  }
  {
    V v;assert(v.begin());auto s=current();openInput(v,s);auto epoch=v.inputEpoch.load();
    v.mute();assert(!v.capturing()&&v.inputEpoch.load()!=epoch);
    v.tick(s,1,false,false,130);assert(!v.capturing()); // unmute does not restart
    v.speak();grant(s,"second-input");v.tick(s,1,false,false,140);
    s.hasGrant=false;strcpy(s.phase,"processing");v.tick(s,1,false,false,150);
    auto m=output(s,speechwire::Start);strcpy(m.turn,"unrelated-turn");v.offer(m,1);
    m=output(s,speechwire::Chunk);strcpy(m.turn,"unrelated-turn");v.offer(m,1);
    v.tick(s,1,false,false,160);assert(M5.Speaker.playing);v.mute();
    assert(M5.Speaker.playing);++s.privacyRevision;v.tick(s,1,false,true,170);
    assert(!M5.Speaker.running);clearQueues(v);
  }
  for(int mode=0;mode<4;++mode){
    V v;assert(v.begin());auto s=current();openInput(v,s);
    if(mode==0)s.ownsEndpoint=false;
    if(mode==1)strcpy(s.phase,"paused");
    if(mode==2)s.ready=false;
    if(mode==3)++s.policyRevision;
    v.tick(s,1,false,false,140);assert(!M5.Mic.running&&!v.capturing());clearQueues(v);
  }
  {
    V v;assert(v.begin());auto s=current();openInput(v,s);
    M5.Mic.complete();v.tick(s,1,false,false,120);M5.Mic.complete();v.tick(s,1,false,false,140);
    assert(v.finish(19000));s.hasGrant=false;strcpy(s.phase,"processing");s.heartbeatAt=38999;
    v.tick(s,1,false,false,38999);assert(!v.fault.load());
    v.tick(s,1,false,false,39000);assert(v.fault.load()); // full wait measured from Finished
    clearQueues(v);
  }
  std::puts("PASS: voice driver ownership, explicit capture, frame/end, playback receipts, Stop/mute/revision/disconnect cancellation");
}
