#include <M5Unified.h>

// Standalone display/touch test only. No camera, network, motion or capture path.
// Stop/mute tests with actual audio queues and transport remain a later milestone.
namespace {
bool stopped = false;
bool micMuted = true;
int screenWidth = 0;
int screenHeight = 0;

bool inside(int x, int y, int left, int top, int width, int height) {
  return x >= left && x < left + width && y >= top && y < top + height;
}

void silenceLocalAudio() {
  M5.Mic.end();
  M5.Speaker.stop();
  M5.Speaker.end();
}

void drawScreen() {
  auto& display = M5.Display;
  display.fillScreen(TFT_BLACK);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
  display.setTextSize(3);
  display.setCursor(8, 12);
  display.print("Lemmi");
  display.drawRect(screenWidth - 100, 6, 92, 42, TFT_WHITE);
  display.setTextSize(2);
  display.setCursor(screenWidth - 84, 19);
  display.print("READY");

  display.setCursor(8, 54);
  display.print(stopped ? "STOPPED - capture off" : "Ready - capture off");
  display.setCursor(8, 77);
  display.print("Camera off / no network");

  const int stopTop = screenHeight - 76;
  const int muteTop = stopTop - 60;
  display.drawRect(8, muteTop, screenWidth - 16, 52, TFT_WHITE);
  display.setCursor(18, muteTop + 18);
  display.print(micMuted ? "UNMUTE (stays off)" : "MUTE microphone");

  display.fillRect(8, stopTop, screenWidth - 16, 68, TFT_RED);
  display.setTextColor(TFT_WHITE, TFT_RED);
  display.setTextSize(3);
  display.setCursor(screenWidth / 2 - 36, stopTop + 22);
  display.print("STOP");
}

void stopLocally() {
  // Invalidate the local interaction before any drawing or future networking.
  stopped = true;
  silenceLocalAudio();
  drawScreen();
  Serial.println("event=local_stop capture=off camera=off");
}
} // namespace

void setup() {
  auto config = M5.config();
  config.serial_baudrate = 115200;
  config.internal_mic = false;
  config.internal_spk = false;
  config.internal_imu = false;
  config.internal_rtc = false;
  M5.begin(config);
  silenceLocalAudio();
  screenWidth = M5.Display.width();
  screenHeight = M5.Display.height();
  drawScreen();
  Serial.printf("firmware=lemmi-foundation/0.1 display=%dx%d capture=off camera=off\n",
                screenWidth, screenHeight);
}

void loop() {
  M5.update();
  const int stopTop = screenHeight - 76;
  const int muteTop = stopTop - 60;
  for (int index = 0; index < M5.Touch.getCount(); ++index) {
    const auto touch = M5.Touch.getDetail(index);
    if (!touch.isPressed()) continue;
    // Stop is checked before all other actions and does not require release.
    if (inside(touch.x, touch.y, 8, stopTop, screenWidth - 16, 68)) {
      if (!stopped) stopLocally();
      break;
    }
    if (!touch.wasPressed()) continue;
    if (inside(touch.x, touch.y, 8, muteTop, screenWidth - 16, 52)) {
      micMuted = !micMuted;
      // Unmute changes the setting only; it never initializes capture.
      silenceLocalAudio();
      drawScreen();
      Serial.println(micMuted ? "event=mic_muted capture=off" : "event=mic_unmuted capture=off");
      break;
    }
    if (inside(touch.x, touch.y, screenWidth - 100, 6, 92, 42)) {
      stopped = false;
      silenceLocalAudio();
      drawScreen();
      Serial.println("event=ready capture=off");
      break;
    }
  }
  delay(2);
}
