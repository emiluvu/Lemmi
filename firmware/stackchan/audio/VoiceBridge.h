#pragma once
#include <M5Unified.h>
#include <atomic>
#include <algorithm>
#include "SpeechWire.h"
#include "WipingQueue.h"

// Experimental firmware adapter: the UI task is the ONLY owner of the audio
// drivers, PCM helpers and speaker memory. The network worker only copies bounded
// messages through queues. Never initialize/stop the drivers in the worker.
class VoiceBridge {
public:
  enum Kind : uint8_t { InputChunk, InputEnd, Receipt };
  enum Failure : uint8_t { NoFailure, IncomingFull, OutgoingFull, EmptyInput, InputDeadline, InvalidOutput, PacketizerStart, MicBegin, PacketizerAppend, PacketizerTake, MicRecord, PlaybackConsume, PlaybackSubmit };
  std::atomic<uint8_t> failure{NoFailure};
  void fail(Failure reason){uint8_t expected=NoFailure;failure.compare_exchange_strong(expected,reason);fault.store(true);}
  struct Outbound {
    Kind kind;
    uint32_t localEpoch,inputEpoch,queuedAt;
    uint64_t generation,profileRevision,privacyRevision,policyRevision;
    char session[101],turn[101],lease[101],stream[101];
    uint16_t count;
    char status[10];
    uint8_t pcm[640];
  };
  enum : size_t {IncomingSlots=lemmi::PlaybackWindow::Capacity+2,OutgoingSlots=13,CaptureQueueMs=240};
  lemmi::WipingQueue<speechwire::Output,IncomingSlots> incoming;
  lemmi::WipingQueue<Outbound,OutgoingSlots> outgoing;
  std::atomic<uint32_t> inputEpoch{0};
  std::atomic<bool> fault{false};
  std::atomic<bool> captureActive{false},playbackActive{false};

  bool begin() {
    return true;
  }
  bool offer(speechwire::Output& message,uint32_t epoch) {
    message.localEpoch=epoch;
    bool ok=incoming.push(message);
    lemmi::wipePcm(message.pcm,sizeof(message.pcm));
    if(!ok)fail(IncomingFull);
    return ok;
  }
  void speak() { // explicit local action; unmute never calls this
    cancelOutput();cancelInput();allowInput_=true;blockOutput_=true;
  }
  void mute() {
    if(capturing_||pendingInput_)strcpy(blockedTurn_,capture_.grantTurn);
    cancelInput();allowInput_=false;
  }
  void cancelAll() {
    allowInput_=false;blockOutput_=true;cancelInput();cancelOutput();
    auto& m=inboundScratch_;
    for(size_t i=0;i<IncomingSlots&&incoming.pop(m);++i)lemmi::wipePcm(&m,sizeof(m));
    auto& o=outboundScratch_;
    for(size_t i=0;i<OutgoingSlots&&outgoing.pop(o);++i)lemmi::wipePcm(&o,sizeof(o));
  }
  bool capturing() const {return capturing_;}
  bool speaking() const {return playbackActive.load();}
  bool pending() const {return capturing_||pendingInput_||output_.active();}
  uint16_t receivedChunks()const{return receivedChunks_;}
  uint16_t consumedChunks()const{return consumedChunks_;}
  uint16_t bufferWaits()const{return bufferWaits_;}
  bool finish(uint32_t now) {
    if(!capturing_)return false;
    // Completed full frames already enqueued; never pad or reuse the final tail.
    M5.Mic.end();capturing_=false;recording_=false;
    captureActive.store(false);strcpy(finishedStream_,capture_.grantStream);
    memset(samples_,0,sizeof(samples_));packetizer_.finish(pcmEpoch_);
    if(!sentChunks_){fail(EmptyInput);return false;}
    auto& o=outboundScratch_;o={};scope(o,capture_);o.queuedAt=now;o.kind=InputEnd;o.count=sentChunks_;
    pendingInput_=true;pendingAt_=now;
    return queue(o);
  }
  void tick(const ControlPolicy& s,uint32_t epoch,bool stopped,bool muted,uint32_t now) {
    if(fault.load())return;
    if(pendingInput_&&uint32_t(now-pendingAt_)>=20000){fail(InputDeadline);return;}
    if(!s.ready||!s.snapshot||!s.ownsEndpoint||stopped||s.watchdog(now)||
       !strcmp(s.phase,"paused")||!strcmp(s.phase,"ended")) {
      cancelAll();return;
    }
    if((output_.active()&&!matches(s,outputScope_))||
       ((capturing_||pendingInput_)&&!sameScope(s,capture_))){cancelAll();return;}
    if((muted||s.serverMuted)&&(capturing_||pendingInput_))mute();
    if(capturing_&&(!sameScope(s,capture_)||!s.hasGrant||s.serverMuted||muted||
       strcmp(s.grantTurn,capture_.grantTurn)||strcmp(s.grantStream,capture_.grantStream)))cancelInput();
    if(muted&&capturing_)mute();

    auto& m=inboundScratch_;
    // Bound audio dispatch so touchscreen service cannot be starved by a peer.
    for(size_t i=0;i<IncomingSlots&&incoming.pop(m);++i) {
      const bool current=m.localEpoch==epoch&&matches(s,m)&&!blockOutput_&&strcmp(m.turn,blockedTurn_);
      if(current&&!accept(m,s,epoch,now))fail(InvalidOutput);
      lemmi::wipePcm(&m,sizeof(m));
      if(fault.load())return;
    }
    if(s.hasGrant&&!muted&&!s.serverMuted&&allowInput_&&s.grantExpires>time(nullptr)&&
       strcmp(s.grantStream,finishedStream_)) {
      if(!capturing_&&(!pendingInput_||strcmp(capture_.grantStream,s.grantStream))) {
        cancelOutput();cancelInput();capture_=s;epoch_=epoch;
        if(pcmEpoch_==UINT64_MAX||!packetizer_.start(++pcmEpoch_)){fail(PacketizerStart);return;}
        // Listening text is painted by the caller before this tick can start capture.
        if(!M5.Mic.begin()){fail(MicBegin);return;}
        capturing_=true;recording_=false;sentChunks_=0;captureAt_=now;
        captureActive.store(true);
        blockOutput_=false;blockedTurn_[0]=0;pendingInput_=false;
      }
    }
    if(capturing_) {
      if(s.grantExpires<=time(nullptr)||uint32_t(now-captureAt_)>=19500){finish(now);return;}
      if(recording_&&!M5.Mic.isRecording()) {
        recording_=false;size_t used=0;
        while(used<256) {
          auto result=packetizer_.append(pcmEpoch_,samples_+used,256-used);
          if(!result.consumed){fail(PacketizerAppend);break;}
          used+=result.consumed;
          if(result.status==lemmi::PcmPacketizer::Status::FrameReady) {
            lemmi::PcmPacketizer::Frame frame;
            if(!packetizer_.take(pcmEpoch_,frame)){fail(PacketizerTake);break;}
            auto& o=outboundScratch_;o={};scope(o,capture_);o.queuedAt=now;o.kind=InputChunk;o.count=sentChunks_;
            memcpy(o.pcm,frame.bytes,sizeof(o.pcm));
            if(!queue(o))break;
            ++sentChunks_;
          }
        }
        lemmi::wipePcm(samples_,sizeof(samples_));
      }
      if(!fault.load()&&!recording_) {
        recording_=M5.Mic.record(samples_,256,16000,false);
        if(!recording_)fail(MicRecord);
      }
    }
    if(output_.active())serviceSpeaker(now);
  }
private:
  lemmi::PcmPacketizer packetizer_;
  lemmi::PlaybackWindow output_;
  lemmi::PlaybackWindow::Block blocks_[2];
  ControlPolicy capture_;
  speechwire::Output outputScope_={};
  // UI-task-owned scratch. Never put a complete wire frame on each nested
  // cancellation/dispatch stack frame: the Arduino loop stack is only 8 KiB.
  speechwire::Output inboundScratch_={};
  Outbound outboundScratch_={};
  uint64_t pcmEpoch_=0,playEpoch_=0;
  uint32_t epoch_=0,captureAt_=0,pendingAt_=0,outputAt_=0,drainAt_=0,lastChunkAt_=0,progressAt_=0;
  uint16_t progressSent_=0;
  uint16_t sentChunks_=0;
  uint16_t receivedChunks_=0,consumedChunks_=0,bufferWaits_=0;
  int16_t samples_[256]={};
  bool capturing_=false,recording_=false,allowInput_=false,pendingInput_=false;
  bool speakerStarted_=false,blockOutput_=true,submitted_[2]={false,false};
  bool prebuffer_=true;
  uint8_t submitSlot_=0,consumeSlot_=0,pendingReleases_=0;
  char finishedStream_[101]={},blockedTurn_[101]={};
  std::atomic<uint8_t> released_{0};

  static bool sameScope(const ControlPolicy& a,const ControlPolicy& b) {
    return !strcmp(a.session,b.session)&&a.generation==b.generation&&!strcmp(a.lease,b.lease)&&
      a.profileRevision==b.profileRevision&&a.privacyRevision==b.privacyRevision&&a.policyRevision==b.policyRevision;
  }
  static bool matches(const ControlPolicy& s,const speechwire::Output& m) {
    return !strcmp(s.session,m.session)&&s.generation==m.generation&&!strcmp(s.lease,m.lease)&&
      s.profileRevision==m.profileRevision&&s.privacyRevision==m.privacyRevision&&s.policyRevision==m.policyRevision;
  }
  void scope(Outbound& o,const ControlPolicy& s) {
    o.localEpoch=epoch_;o.inputEpoch=inputEpoch.load();o.generation=s.generation;
    o.profileRevision=s.profileRevision;o.privacyRevision=s.privacyRevision;o.policyRevision=s.policyRevision;
    strcpy(o.session,s.session);strcpy(o.turn,s.grantTurn);strcpy(o.lease,s.lease);strcpy(o.stream,s.grantStream);
  }
  bool queue(Outbound& o) {
    // One serialized producer, consumer only removes: reserve the thirteenth
    // slot for input-end. Never allow more than twelve queued capture frames.
    bool ok=(o.kind!=InputChunk||outgoing.size()<12)&&outgoing.push(o);lemmi::wipePcm(&o,sizeof(o));
    if(!ok)fail(OutgoingFull);return ok;
  }
  void receipt(const char* status) {
    auto& o=outboundScratch_;o={};o.kind=Receipt;o.localEpoch=epoch_;o.generation=outputScope_.generation;
    o.profileRevision=outputScope_.profileRevision;o.privacyRevision=outputScope_.privacyRevision;o.policyRevision=outputScope_.policyRevision;
    strcpy(o.session,outputScope_.session);strcpy(o.turn,outputScope_.turn);
    strcpy(o.lease,outputScope_.lease);strcpy(o.stream,outputScope_.stream);
    strcpy(o.status,status);o.count=output_.playedChunks();queue(o);
  }
  void cancelInput() {
    inputEpoch.fetch_add(1);packetizer_.cancel();
    if(capturing_||recording_)M5.Mic.end();
    capturing_=recording_=pendingInput_=false;
    captureActive.store(false);
    lemmi::wipePcm(samples_,sizeof(samples_));
  }
  void cancelOutput() {
    output_.cancel(); // invalidate first; a Stop callback cannot count as played
    if(speakerStarted_){M5.Speaker.stop();M5.Speaker.end();}
    speakerStarted_=false;submitted_[0]=submitted_[1]=false;released_.store(0);
    submitSlot_=consumeSlot_=pendingReleases_=0;prebuffer_=true;
    playbackActive.store(false);
    for(auto& block:blocks_)block.clear();
    lemmi::wipePcm(&outputScope_,sizeof(outputScope_));drainAt_=0;
  }
  static void release(void* args,const void* data,uint8_t channel) {
    auto self=static_cast<VoiceBridge*>(args);
    if(channel!=0)return;
    for(unsigned i=0;i<2;++i)if(data==self->blocks_[i].samples)self->released_.fetch_or(uint8_t(1u<<i));
  }
  bool accept(const speechwire::Output& m,const ControlPolicy& s,uint32_t epoch,uint32_t now) {
    if(m.kind==speechwire::Start) {
      if(capturing_||output_.active()||playEpoch_==UINT64_MAX)return false;
      outputScope_=m;epoch_=epoch;outputAt_=lastChunkAt_=now;
      progressAt_=now;progressSent_=0;
      receivedChunks_=consumedChunks_=bufferWaits_=0;
      pendingInput_=false;
      if(!output_.start(++playEpoch_,m.format,m.outputWindowChunks))return false;
      M5.Mic.end();M5.Speaker.setVolume(64);
      auto config=M5.Speaker.config();config.sample_rate=48000;config.dma_buf_len=128;config.dma_buf_count=4;
      M5.Speaker.config(config);M5.Speaker.setBufferReleaseCallback(this,release);
      speakerStarted_=M5.Speaker.begin();return speakerStarted_;
    }
    if(!output_.active()||strcmp(outputScope_.turn,m.turn)||strcmp(outputScope_.stream,m.stream))return m.kind==speechwire::Cancel;
    if(m.kind==speechwire::Cancel){cancelOutput();return true;}
    if(m.kind==speechwire::Chunk){
      lastChunkAt_=now;
      bool ok=output_.append(playEpoch_,m.index,m.pcm,m.bytes);
      if(ok)receivedChunks_=m.index+1;
      return ok;
    }
    if(m.kind==speechwire::End)return output_.end(playEpoch_,m.count);
    (void)s;return false;
  }
  void serviceSpeaker(uint32_t now) {
    const bool running=submitted_[0]||submitted_[1];
    if(uint32_t(now-outputAt_)>=35000||(!running&&!output_.buffered()&&!output_.complete()&&uint32_t(now-lastChunkAt_)>3000)) {
      receipt("failed");cancelOutput();return;
    }
    pendingReleases_|=released_.exchange(0);
    for(int i=0;i<2&&submitted_[consumeSlot_]&&(pendingReleases_&(1u<<consumeSlot_));++i){
      const uint8_t slot=consumeSlot_;pendingReleases_&=uint8_t(~(1u<<slot));
      if(output_.playedChunks()==0)receipt("started");
      if(!output_.consumed(playEpoch_,blocks_[slot].index)){fail(PlaybackConsume);return;}
      submitted_[slot]=false;blocks_[slot].clear();consumeSlot_^=1;
      consumedChunks_=output_.playedChunks();
      drainAt_=now;
    }
    // Conservative consumption receipts, at most 25 progress messages/second
    // except a final tail. This stays below the gateway's 30/s control limit.
    if(output_.playedChunks()>progressSent_&&(output_.complete()||uint32_t(now-progressAt_)>=40)){
      receipt("progress");progressSent_=output_.playedChunks();progressAt_=now;
    }
    if(!submitted_[0]&&!submitted_[1]&&!output_.buffered()&&!output_.complete()){
      if(!prebuffer_)++bufferWaits_;
      prebuffer_=true;
    }
    const size_t remaining=outputScope_.format.chunkCount-output_.playedChunks();
    if(prebuffer_&&output_.buffered()>=std::min(output_.window(),remaining))prebuffer_=false;
    for(int i=0;i<2&&!prebuffer_&&!submitted_[submitSlot_]&&M5.Speaker.isPlaying(0)<2;++i){
      const uint8_t slot=submitSlot_;
      if(!output_.acquire(playEpoch_,blocks_[slot]))break;
      if(!M5.Speaker.playRaw(blocks_[slot].samples,blocks_[slot].count,output_.sampleRate(),false,1,0,false)){fail(PlaybackSubmit);return;}
      submitted_[slot]=true;submitSlot_^=1;
    }
    playbackActive.store(output_.playedChunks()>0&&(((submitted_[0]||submitted_[1])&&M5.Speaker.isPlaying(0)>0)||uint32_t(now-drainAt_)<100));
    // Conservative final drain guard: 128 words × 4 descriptors at 48 kHz
    // mono, plus mixer/driver slack. Physical completion/Stop acceptance pending.
    if(output_.complete()&&!submitted_[0]&&!submitted_[1]&&!M5.Speaker.isPlaying()&&uint32_t(now-drainAt_)>=100) {
      receipt("completed");cancelOutput();
    }
  }
};
