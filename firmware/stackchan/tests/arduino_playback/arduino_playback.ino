#include "../../audio/PlaybackWindow.h"

// Compile probe only: no hardware, credentials, audio, network or upload target.
lemmi::PlaybackWindow playback;
lemmi::PlaybackWindow::Block block;
void setup() {
  const lemmi::PlaybackWindow::Format format = {22050, 882, 882, 1};
  if (playback.start(1, format)) playback.cancel();
}
void loop() { delay(1000); }
