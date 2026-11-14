#include <M5Unified.h>
#include "PetGesture.h"
#include "TouchStrip.h"

// Separate user-requested offline petting experiment. Media/motion stay off.
namespace {
TouchStrip strip;
PetGesture gesture;
M5Canvas body(&M5.Display);
bool bodyReady = false, bodyDirty = false, zonesDirty = false;
bool stopped = false, enabled = false, unavailable = false, reacting = false;
bool dirty = true;
uint8_t zones = 0;
uint32_t lastPoll = 0, reactionAt = 0;

void button(int y, const char* text, uint32_t color, int height = 34) {
  auto& d = M5.Display;
  d.fillRect(4, y, 312, height, color);
  d.setTextColor(TFT_WHITE, color); d.setCursor(12, y + 9); d.print(text);
}
void drawZones() {
  // Only the three circles change during raw sensor transitions.
  if (enabled && !reacting && !stopped) for (int i = 0; i < 3; ++i) {
    M5.Display.fillCircle(90 + 70 * i, 163, 10, zones & (1 << i) ? TFT_GREEN : TFT_DARKGREY);
  }
  zonesDirty = false;
}
void drawBody() {
  if (!bodyReady) return;
  body.fillSprite(TFT_BLACK); body.setTextSize(2);
  body.setTextColor(TFT_WHITE, TFT_BLACK);
  if (reacting && enabled && !stopped) {
    // Static test art only; Kylie owns the final pet_ack avatar overlay.
    body.setCursor(58, 7); body.print("Pet received :)");
    body.drawLine(113, 41, 124, 33, TFT_WHITE); body.drawLine(124, 33, 135, 41, TFT_WHITE);
    body.drawLine(185, 41, 196, 33, TFT_WHITE); body.drawLine(196, 33, 207, 41, TFT_WHITE);
    body.fillCircle(108, 58, 5, TFT_PINK); body.fillCircle(212, 58, 5, TFT_PINK);
    body.drawLine(133, 60, 146, 72, TFT_WHITE); body.drawLine(146, 72, 174, 72, TFT_WHITE);
    body.drawLine(174, 72, 187, 60, TFT_WHITE);
  } else {
    body.setCursor(10, 8);
    body.print(unavailable ? "Touch strip unavailable" : enabled ? "Stroke the TOP strip" : "Local visual test only");
    body.setCursor(10, 32); body.print(enabled ? "Lift between strokes" : "Motion stays disabled");
    if (enabled) for (int i = 0; i < 3; ++i) body.fillCircle(90 + 70 * i, 71, 10, zones & (1 << i) ? TFT_GREEN : TFT_DARKGREY);
  }
  // Compose off-screen; never expose intermediate clear/draw steps to the panel.
  body.pushSprite(0, 92);
  bodyDirty = zonesDirty = false;
}
void draw() {
  auto& d = M5.Display;
  d.fillScreen(TFT_BLACK); d.setTextSize(2); d.setTextColor(TFT_WHITE, TFT_BLACK);
  d.setCursor(6, 5); d.print(stopped ? "STOPPED - petting off" : "Lemmi petting test");
  d.setCursor(6, 29); d.print("Camera / microphone off");
  button(54, stopped ? "READY (petting stays off)" : enabled ? "DISABLE PETTING" : "ENABLE PETTING", TFT_DARKGREY);
  if (bodyReady) drawBody();
  else { d.setCursor(10, 100); d.print("Display buffer unavailable"); }
  button(192, "STOP", TFT_RED, 48);
  dirty = false;
}
void disable() {
  enabled = false; reacting = false; zones = 0; gesture.reset(); dirty = true;
}
void stop() {
  stopped = true; disable();
  M5.Mic.end(); M5.Speaker.stop(); M5.Speaker.end();
  Serial.println("event=pet_stop capture=off camera=off");
}
}
void setup() {
  auto c = M5.config(); c.serial_baudrate = 115200;
  c.internal_mic = false; c.internal_spk = false;
  c.internal_imu = false; c.internal_rtc = false;
  M5.begin(c); M5.Mic.end(); M5.Speaker.end();
  body.setPsram(false); body.setColorDepth(16);
  bodyReady = body.createSprite(320, 96) != nullptr;
  draw();
  Serial.printf("firmware=lemmi-petting/0.2 display=%dx%d capture=off camera=off\n", M5.Display.width(), M5.Display.height());
}
void loop() {
  M5.update();
  // Handle Stop before any sensor polling or reaction rendering.
  for (int i = 0; i < M5.Touch.getCount(); ++i) {
    const auto t = M5.Touch.getDetail(i);
    if (!t.isPressed()) continue;
    if (t.y >= 192) { if (!stopped) stop(); break; }
    if (!t.wasPressed()) continue;
    if (t.y >= 54 && t.y < 88) {
      if (stopped) { stopped = false; disable(); }
      else if (enabled) { disable(); Serial.println("event=pet_disabled capture=off camera=off"); }
      else {
        gesture.reset(); reacting = false; zones = 0;
        enabled = bodyReady && strip.begin(); unavailable = !enabled; dirty = true;
        if (enabled) Serial.println("event=pet_enabled capture=off camera=off");
        else Serial.printf("event=pet_sensor_unavailable stage=%u capture=off camera=off\n", unsigned(bodyReady ? strip.errorStage() : 6));
      }
      break;
    }
  }
  const uint32_t now = millis();
  if (enabled && !stopped && uint32_t(now - lastPoll) >= 20) {
    lastPoll = now;
    uint8_t raw = 0;
    if (!strip.sample(raw)) {
      disable(); unavailable = true;
      Serial.printf("event=pet_sensor_unavailable stage=%u capture=off camera=off\n", unsigned(strip.errorStage()));
    } else {
      const uint8_t next = petZoneMask(raw);
      if (next != zones) { zones = next; if (!reacting) zonesDirty = true; }
      if (gesture.update(zones, true, now)) {
        reacting = true; reactionAt = now; bodyDirty = true;
        Serial.println("event=pet_ack capture=off camera=off");
      }
    }
  }
  if (reacting && uint32_t(now - reactionAt) >= 1000) { reacting = false; bodyDirty = true; }
  if (dirty) draw();
  else if (bodyDirty) drawBody();
  else if (zonesDirty) drawZones();
  delay(2);
}
