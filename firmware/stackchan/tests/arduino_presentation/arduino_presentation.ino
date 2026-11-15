// Compile-only integration probe. No network, media, display, or upload target.
#include "../../presentation/AvatarPresentation.h"
AvatarPresentation presentation;
volatile bool presentationProbeResult=false;
void setup(){
  const AvatarPresentation::Scope scope={1,1,1,1};
  const bool selected=presentation.select("bird",scope,false);
  const auto token=presentation.arm(scope,true,true,true);
  const bool started=presentation.playbackStarted(token,0);
  const bool open=presentation.frame(0)==AvatarPresentation::Frame::Open;
  presentation.invalidate();
  presentationProbeResult=selected&&started&&open&&!presentation.playbackStarted(token,1)&&
    presentation.frame(1)==AvatarPresentation::Frame::Closed;
}
void loop(){}
