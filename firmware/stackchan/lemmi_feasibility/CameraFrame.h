#pragma once
#include <stddef.h>

// cam_take does not finalize frame metadata. Match esp_camera_fb_get's metadata
// step using the initialized sensor, while retaining our strict format/byte gate.
// Templates keep this boundary testable without initializing camera hardware.
template <class Frame, class Sensor, class Resolution>
bool finalizePreviewFrame(Frame* frame, const Sensor* sensor, const Resolution* sizes,
                          int expectedSize, int expectedFormat) {
  if (!frame || !sensor || sensor->status.framesize != expectedSize || sensor->pixformat != expectedFormat) return false;
  frame->width = sizes[expectedSize].width;
  frame->height = sizes[expectedSize].height;
  frame->format = sensor->pixformat;
  return frame->buf && frame->width == 160 && frame->height == 120 && frame->len == size_t(160 * 120 * 2);
}
