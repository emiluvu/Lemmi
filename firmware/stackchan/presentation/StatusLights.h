#pragma once
#include <stdint.h>

// Local presentation only: pass actual local driver activity, never a server
// phase, unmuted flag, capture grant, queued audio, or mouth animation frame.
// Recompute after driver start/idle/completion/cancellation and local Stop.
namespace StatusLights {
enum class Color : uint8_t { Off, Green, Blue, Pink, Yellow };
inline Color choose(bool stopped, bool capturing, bool speaking, bool petting, bool cameraActive=false) {
  if(stopped)return Color::Off;
  if(cameraActive)return Color::Yellow;
  // Capture stays visible even if a faulty caller reports simultaneous output.
  // The audio coordinator must independently prevent that overlap.
  if(capturing)return Color::Green;
  if(speaking)return Color::Blue;
  if(petting)return Color::Pink;
  return Color::Off;
}
inline uint16_t rgb565(Color color) {
  switch(color) {
    case Color::Green:return 0x0180; // RGB(0,48,0), dim and steady
    case Color::Blue:return 0x0006;  // RGB(0,0,48)
    case Color::Pink:return 0x3043;  // existing RGB(48,8,24)
    case Color::Yellow:return 0x3180; // RGB(48,48,0)
    default:return 0;
  }
}
}
