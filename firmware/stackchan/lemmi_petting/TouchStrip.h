#pragma once
#include <M5Unified.h>

// Touch-only register adapter; no BSP/body initialization, bus reinit, servo,
// RGB, NFC or power-expander writes. Register facts are documented in README.
class TouchStrip {
public:
  uint8_t errorStage() const { return errorStage_; }
  bool begin() {
    errorStage_ = 1;
    if (M5.In_I2C.getSDA() != 12 || M5.In_I2C.getSCL() != 11) return false;
    uint8_t value = 0;
    errorStage_ = 2;
    if (!read(0x10, value)) return false;
    errorStage_ = 3;
    // Vendor channel/reference setup, followed by active scanning (sleep off).
    for (uint8_t reg = 0x0a; reg <= 0x0f; ++reg) if (!write(reg, 0)) return false;
    if (!write(0x09, 0x0f) || !write(0x09, 0x03) || !write(0x08, 0x22)) return false;
    for (uint8_t reg = 0x02; reg <= 0x06; ++reg) if (!write(reg, 0x33)) return false;
    errorStage_ = 4;
    for (uint8_t reg = 0x02; reg <= 0x06; ++reg) if (!read(reg, value) || value != 0x33) return false;
    if (!read(0x08, value) || value != 0x22) return false;
    if (!read(0x09, value) || (value & 0x0f) != 0x03) return false;
    errorStage_ = 5;
    if (!read(0x10, value)) return false;
    errorStage_ = 0;
    return true;
  }
  bool sample(uint8_t& output) {
    if (!read(0x10, output)) { errorStage_ = 5; return false; }
    return true;
  }
private:
  uint8_t errorStage_ = 0;
  bool read(uint8_t reg, uint8_t& value) {
    return M5.In_I2C.readRegister(0x68, reg, &value, 1, 100000);
  }
  bool write(uint8_t reg, uint8_t value) {
    return M5.In_I2C.writeRegister8(0x68, reg, value, 100000);
  }
};
