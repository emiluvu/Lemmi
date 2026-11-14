#include "../lemmi_feasibility/CameraFrame.h"
#include <cassert>
#include <stdint.h>
struct Frame { uint8_t* buf; size_t len, width, height; int format; };
struct Sensor { struct { int framesize; } status; int pixformat; };
struct Resolution { size_t width, height; };
int main() {
  uint8_t dummy = 0;
  const Resolution sizes[] = {{160, 120}, {320, 240}};
  Sensor sensor = {{0}, 7};
  // Regression: HAL supplies payload/length, public wrapper supplies metadata.
  Frame frame = {&dummy, 38400, 0, 0, 0};
  assert(finalizePreviewFrame(&frame, &sensor, sizes, 0, 7));
  assert(frame.width == 160 && frame.height == 120 && frame.format == 7);
  frame.len = 38399;
  assert(!finalizePreviewFrame(&frame, &sensor, sizes, 0, 7));
  frame.len = 38401;
  assert(!finalizePreviewFrame(&frame, &sensor, sizes, 0, 7));
  frame.len = 38400; frame.buf = nullptr;
  assert(!finalizePreviewFrame(&frame, &sensor, sizes, 0, 7));
  frame.buf = &dummy; sensor.status.framesize = 1;
  assert(!finalizePreviewFrame(&frame, &sensor, sizes, 0, 7));
  sensor.status.framesize = 0; sensor.pixformat = 8;
  assert(!finalizePreviewFrame(&frame, &sensor, sizes, 0, 7));
  assert(!finalizePreviewFrame(static_cast<Frame*>(nullptr), &sensor, sizes, 0, 7));
}
