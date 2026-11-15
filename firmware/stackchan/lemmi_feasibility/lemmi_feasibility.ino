#include <M5Unified.h>
#include <esp_camera.h>
#include <esp_system.h>
#include <atomic>
#include "LocalGate.h"
#include "CameraBus.h"
#include "CameraFrame.h"
#include "../motion/BodyHardware.h"

// Version-specific internal camera HAL entry point from the pinned 3.3.10 SDK.
// Its declaration is verified against upstream cam_hal.h; build/link checks pin
// the binary. Unlike esp_camera_fb_get(), this accepts a short queue timeout.
extern "C" camera_fb_t* cam_take(TickType_t timeout);

SemaphoreHandle_t peripheralBus;
std::atomic<bool> cameraWanted{false};
namespace {
LocalGate gate;
BodyHardware body;
bool lightsOK=false;
StatusLights::Color shownLight=StatusLights::Color::Off;
bool dirty = true;
std::atomic<bool> cameraBusy{false};
std::atomic<int> cameraResult{0}; // 0 idle, 1 starting, 2 active, 3 failed, 4 ended
bool syncLights() {
  if(!lightsOK)return false;
  const auto color=StatusLights::choose(gate.mode==LocalGate::Stopped,
    gate.mode==LocalGate::Microphone&&M5.Mic.isRunning(),
    gate.toneTestActive(millis()),false,
    gate.mode==LocalGate::Camera&&cameraWanted.load()&&cameraBusy.load()&&cameraResult.load()==2);
  if(color==shownLight)return true;
  // Share the camera SCCB/touch lock; never wait for its worker.
  if(xSemaphoreTake(peripheralBus,0)!=pdTRUE)return true;
  const bool ok=body.lights(color);
  xSemaphoreGive(peripheralBus);
  if(ok)shownLight=color;
  else {lightsOK=false;dirty=true;}
  return ok;
}
SemaphoreHandle_t frameLock;
std::atomic<uint32_t> cameraToken{0}, cameraSince{0};
uint16_t preview[160 * 120];
uint32_t previewToken = 0, previewAt = 0;
bool fresh = false;
int16_t samples[256]; // 16 ms at 16 kHz; never persisted or replayed
bool samplePending = false;
uint32_t closingSince = 0, lastPaint = 0, lastLoop = 0, maxLoopGap = 0, lastFrameShown = 0;
int lastCameraResult = 0;
bool workerAvailable = false;

void button(int y, const char* label, uint32_t color = TFT_DARKGREY, int h = 30) {
  M5.Display.fillRect(4, y, 312, h, color);
  M5.Display.setTextColor(TFT_WHITE, color);
  M5.Display.setCursor(10, y + 7);
  M5.Display.print(label);
}
void draw() {
  auto& d = M5.Display;
  d.fillScreen(TFT_BLACK);
  d.setTextSize(2); d.setTextColor(TFT_WHITE, TFT_BLACK); d.setCursor(6, 4);
  if (cameraBusy.load()) {
    d.print(!cameraWanted.load() ? "CAMERA stopping" : cameraResult.load() == 2 ? "CAMERA ON - local only" : "CAMERA starting");
    d.setCursor(6, 28); d.print("Local only / audio off");
  } else {
    d.print(gate.mode == LocalGate::Stopped ? "STOPPED - READY to reset" : "Lemmi offline test");
    d.setCursor(6, 28);
    d.print(gate.mode == LocalGate::Microphone ? "MIC ON - level only" : "Camera / microphone off");
  }
  if (gate.mode == LocalGate::Ready) {
    button(52, workerAvailable&&lightsOK ? "Camera test (15s)" : "Camera unavailable");
    button(86, lightsOK ? "Speaker tone (1s) - blue" : "Audio lights unavailable");
    button(120, gate.muted ? "UNMUTE (stays off)" : "MUTE microphone");
    button(154, !lightsOK ? "Audio lights unavailable" : gate.muted ? "Mic test: unmute first" : "Mic test (5s) - green");
  } else if (gate.mode == LocalGate::Requested) {
    d.setCursor(8, 54); d.print("Preview on this screen?");
    button(88, "ALLOW CAMERA (15s)"); button(134, "Not now");
  } else if (gate.mode == LocalGate::Stopped && !cameraBusy.load()) {
    button(62, "READY (all capture off)");
    if (cameraResult.load() == 3) { d.setCursor(8, 154); d.print("Camera test failed"); }
    button(112, gate.muted ? "UNMUTE (stays off)" : "MUTE microphone");
  } else if (gate.mode == LocalGate::Microphone) {
    button(138, "MUTE microphone");
  } else if (gate.mode == LocalGate::Tone) {
    d.setCursor(10, 80); d.print("Low-volume 440 Hz tone");
  }
  button(192, cameraBusy.load() ? "STOP camera + all audio" : "STOP", TFT_RED, 48);
  dirty = false;
}
void discardPreview() {
  xSemaphoreTake(frameLock, portMAX_DELAY);
  memset(preview, 0, sizeof(preview)); fresh = false;
  xSemaphoreGive(frameLock);
}
void stopAll(const char* reason) {
  const uint32_t started = millis();
  gate.stop();
  cameraWanted.store(false); // invalidate before any drawing/cleanup
  if (cameraBusy.load() && !closingSince) closingSince = started;
  M5.Mic.end(); M5.Speaker.stop(); M5.Speaker.end();
  syncLights();
  samplePending = false; memset(samples, 0, sizeof(samples));
  discardPreview(); dirty = true;
  Serial.printf("event=test_stop reason=%s cleanup_ms=%lu camera_pending=%u\n",
                reason, (unsigned long)(millis() - started), unsigned(cameraBusy.load()));
}

void cameraWorker(void*) {
  for (;;) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    if (!cameraWanted.load()) {
      cameraResult.store(4); cameraBusy.store(false); continue;
    }
    const uint32_t token = cameraToken.load();
    const uint32_t started = cameraSince.load();
    camera_config_t c = {};
    c.pin_pwdn = c.pin_reset = c.pin_xclk = -1;
    c.pin_sccb_sda = c.pin_sccb_scl = -1;
    c.sccb_i2c_port = int(M5.In_I2C.getPort());
    c.pin_d0 = 39; c.pin_d1 = 40; c.pin_d2 = 41; c.pin_d3 = 42;
    c.pin_d4 = 15; c.pin_d5 = 16; c.pin_d6 = 48; c.pin_d7 = 47;
    c.pin_vsync = 46; c.pin_href = 38; c.pin_pclk = 45;
    c.xclk_freq_hz = 20000000;
    c.ledc_timer = LEDC_TIMER_0; c.ledc_channel = LEDC_CHANNEL_0;
    c.pixel_format = PIXFORMAT_RGB565; c.frame_size = FRAMESIZE_QQVGA;
    c.fb_count = 1; c.fb_location = CAMERA_FB_IN_DRAM;
    c.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    const uint32_t heapBefore = ESP.getFreeHeap();
    esp_err_t err = esp_camera_init(&c);
    bool failed = err != ESP_OK;
    uint32_t frames = 0, maxWait = 0, lastGood = millis();
    if (!failed) {
      auto sensor = esp_camera_sensor_get();
      failed = !sensor || sensor->id.PID != GC0308_PID;
      if (failed) err = ESP_ERR_NOT_SUPPORTED;
      if (!failed) cameraResult.store(2);
      while (!failed && cameraWanted.load() && uint32_t(millis() - started) < 15000) {
        const uint32_t waitStart = millis();
        camera_fb_t* fb = cam_take(pdMS_TO_TICKS(50)); // pinned internal ABI; worker only
        maxWait = max(maxWait, uint32_t(millis() - waitStart));
        if (!fb) {
          if (uint32_t(millis() - lastGood) >= 2000) { failed = true; err = ESP_ERR_TIMEOUT; }
          continue;
        }
        lastGood = millis();
        const bool valid = finalizePreviewFrame(fb, sensor, resolution, FRAMESIZE_QQVGA, PIXFORMAT_RGB565);
        if (!frames || !valid) {
          Serial.printf("event=camera_frame width=%u height=%u format=%d bytes=%lu valid=%u\n",
                        unsigned(fb->width), unsigned(fb->height), int(fb->format),
                        (unsigned long)fb->len, unsigned(valid));
        }
        if (valid && cameraWanted.load() && uint32_t(millis() - started) < 15000) {
          xSemaphoreTake(frameLock, portMAX_DELAY);
          if (cameraWanted.load()) {
            memcpy(preview, fb->buf, sizeof(preview)); previewToken = token; previewAt = millis(); fresh = true; ++frames;
          }
          xSemaphoreGive(frameLock);
        }
        // Camera driver owns the buffer until return. Wipe each consumed frame.
        memset(fb->buf, 0, fb->len); esp_camera_fb_return(fb);
        if (!valid) { failed = true; err = ESP_ERR_INVALID_SIZE; }
        // Interruptible pacing: no 300ms sleep can delay teardown after Stop.
        for (int i = 0; i < 30 && cameraWanted.load(); ++i) vTaskDelay(pdMS_TO_TICKS(10));
      }
      if (esp_camera_deinit() != ESP_OK) esp_restart(); // do not report off after failed teardown
    }
    cameraWanted.store(false);
    discardPreview();
    Serial.printf("event=camera_result code=%d frames=%lu max_wait_ms=%lu heap_before=%lu heap_after=%lu\n",
                  int(err), (unsigned long)frames, (unsigned long)maxWait,
                  (unsigned long)heapBefore, (unsigned long)ESP.getFreeHeap());
    cameraResult.store(failed ? 3 : 4);
    cameraBusy.store(false);
  }
}
TaskHandle_t cameraTask = nullptr;

void startCamera() {
  if (!lightsOK || !workerAvailable || cameraBusy.load() || !gate.enter(LocalGate::Camera, millis())) return;
  M5.Mic.end(); M5.Speaker.end();
  cameraToken.store(gate.generation); cameraSince.store(gate.since);
  cameraResult.store(1); cameraBusy.store(true); cameraWanted.store(true);
  closingSince = 0;
  dirty = true; draw(); // visible notice before notifying camera worker
  xTaskNotifyGive(cameraTask);
  Serial.println("event=camera_allowed local_only=1 limit_ms=15000");
}
void startAudio(bool mic) {
  const auto mode = mic ? LocalGate::Microphone : LocalGate::Tone;
  if (!lightsOK || cameraBusy.load() || !gate.enter(mode, millis())) return;
  const uint32_t token=gate.generation;
  dirty = true; draw(); // visible listening notice precedes capture initialization
  bool ok;
  if (mic) { M5.Speaker.end(); ok = M5.Mic.begin(); }
  else {
    M5.Mic.end(); M5.Speaker.setVolume(64);
    ok = M5.Speaker.begin() && M5.Speaker.tone(440, 1000);
    // Cover the full bounded tone test, including buffered output after the
    // driver's polling flag drops. Initialization must not use up its deadline.
    if(ok)ok=gate.acceptTone(token,millis());
  }
  Serial.printf("event=audio_start kind=%s ok=%u\n", mic ? "mic" : "tone", unsigned(ok));
  if (!ok || !syncLights()) stopAll("audio_error");
}
}
void setup() {
  peripheralBus = xSemaphoreCreateMutex(); frameLock = xSemaphoreCreateMutex();
  if (!peripheralBus || !frameLock) esp_restart();
  auto config = M5.config();
  config.serial_baudrate = 115200;
  // Pinned M5.begin only configures audio pins/callbacks; begin/record/tone activates it.
  config.internal_mic = true; config.internal_spk = true;
  config.internal_imu = false; config.internal_rtc = false;
  M5.begin(config);
  M5.Mic.end(); M5.Speaker.end();
  lightsOK=body.begin(); // VM off and LEDs only; no servo/UART initialization
  workerAvailable = xTaskCreatePinnedToCore(cameraWorker, "camera-test", 8192, nullptr, 1, &cameraTask, 0) == pdPASS;
  draw();
  Serial.printf("firmware=lemmi-feasibility/0.8 display=%dx%d capture=off camera=off\n", M5.Display.width(), M5.Display.height());
}
void loop() {
  const uint32_t now = millis();
  if (lastLoop) maxLoopGap = max(maxLoopGap, uint32_t(now - lastLoop));
  lastLoop = now;
  // Never wait for a camera SCCB transaction; try touch again on the next loop.
  bool updated = xSemaphoreTake(peripheralBus, 0) == pdTRUE;
  if (updated) { M5.update(); xSemaphoreGive(peripheralBus); }
  if (updated) for (int i = 0; i < M5.Touch.getCount(); ++i) {
    const auto t = M5.Touch.getDetail(i);
    if (!t.isPressed()) continue;
    if (t.y >= 192) {
      if (gate.mode != LocalGate::Stopped) stopAll("local");
      break;
    }
    if (!t.wasPressed()) continue;
    if (gate.mode == LocalGate::Stopped && !cameraBusy.load()) {
      if (t.y >= 62 && t.y < 92) { gate.ready(); dirty = true; }
      else if (t.y >= 112 && t.y < 142) { gate.muted = !gate.muted; dirty = true; }
    } else if (gate.mode == LocalGate::Ready) {
      if (t.y >= 52 && t.y < 82 && workerAvailable) { gate.enter(LocalGate::Requested, now); dirty = true; }
      else if (t.y >= 86 && t.y < 116) startAudio(false);
      else if (t.y >= 120 && t.y < 150) { gate.muted = !gate.muted; dirty = true; }
      else if (t.y >= 154 && t.y < 184) startAudio(true);
    } else if (gate.mode == LocalGate::Requested) {
      if (t.y >= 88 && t.y < 118) startCamera();
      else if (t.y >= 134 && t.y < 164) stopAll("declined");
    } else if (gate.mode == LocalGate::Microphone && t.y >= 138 && t.y < 168) {
      gate.muted = true; stopAll("mute");
    }
    break;
  }
  if (gate.mode == LocalGate::Camera && !cameraBusy.load()) stopAll("camera_done");
  if (gate.mode == LocalGate::Camera && cameraResult.load() == 1 && uint32_t(millis() - gate.since) >= 2000) stopAll("start_timeout");
  if (gate.expired(millis())) stopAll("expired");
  if (closingSince && !cameraBusy.load()) {
    Serial.printf("event=camera_closed stop_to_closed_ms=%lu max_loop_gap_ms=%lu\n",
                  (unsigned long)(millis() - closingSince), (unsigned long)maxLoopGap);
    closingSince = 0; dirty = true;
  }
  // A stalled worker cannot retain camera indefinitely. Reboot stays capture-off.
  if (closingSince && uint32_t(millis() - closingSince) >= 5000) esp_restart();
  if (cameraResult.load() != lastCameraResult) { lastCameraResult = cameraResult.load(); dirty = true; }
  if (dirty) draw();
  if (gate.mode == LocalGate::Camera && cameraWanted.load() && xSemaphoreTake(frameLock, 0) == pdTRUE) {
    if (fresh && gate.accepts(previewToken) && uint32_t(millis() - previewAt) < 1500) {
      // Match the vendor's uint16_t RGB565 pushImage path (default swap=false).
      // An additional swap scrambled colors on the observed 0.3 preview.
      const bool previousSwap = M5.Display.getSwapBytes();
      M5.Display.setSwapBytes(false);
      M5.Display.pushImage(80, 60, 160, 120, preview);
      M5.Display.setSwapBytes(previousSwap);
      fresh = false; lastFrameShown = millis();
    }
    xSemaphoreGive(frameLock);
    if (lastFrameShown && uint32_t(millis() - lastFrameShown) >= 1500) {
      M5.Display.fillRect(80, 60, 160, 120, TFT_BLACK); lastFrameShown = 0;
    }
  }
  if (gate.mode == LocalGate::Microphone) {
    if (samplePending && !M5.Mic.isRecording()) {
      int32_t peak = 0;
      for (int16_t value : samples) peak = max(peak, value < 0 ? -int32_t(value) : int32_t(value));
      memset(samples, 0, sizeof(samples)); samplePending = false;
      if (uint32_t(now - lastPaint) >= 100) {
        M5.Display.fillRect(8, 72, 304, 40, TFT_BLACK);
        M5.Display.fillRect(8, 80, min(304, int(peak * 304 / 32768)), 20, TFT_GREEN);
        lastPaint = now;
      }
    }
    if (!samplePending) {
      samplePending = M5.Mic.record(samples, 256, 16000, false);
      if (!samplePending) stopAll("audio_error");
    }
  }
  if(!syncLights()&&(gate.mode==LocalGate::Microphone||gate.mode==LocalGate::Tone||gate.mode==LocalGate::Camera))stopAll("lights_error");
  delay(2);
}
