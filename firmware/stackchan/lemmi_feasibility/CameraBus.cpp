#include <M5Unified.h>
#include "CameraBus.h"

// Application-provided SCCB implementation for the pinned static camera library.
// Do not release/reinitialize M5's bus or install a second IDF driver on it.
// Only GC0308 (0x21, 8-bit registers) is supported by this experiment.
namespace {
struct Transaction {
  bool held;
  Transaction() : held(cameraWanted.load() && xSemaphoreTake(peripheralBus, pdMS_TO_TICKS(20)) == pdTRUE) {
    if (held && !cameraWanted.load()) { xSemaphoreGive(peripheralBus); held = false; }
  }
  ~Transaction() { if (held) xSemaphoreGive(peripheralBus); }
};
}
extern "C" {
int SCCB_Init(int, int) { return -1; } // caller must explicitly reuse M5's port
int SCCB_Use_Port(int port) {
  return cameraWanted.load() && port == int(M5.In_I2C.getPort()) && M5.In_I2C.getSDA() == 12 && M5.In_I2C.getSCL() == 11 ? 0 : -1;
}
int SCCB_Deinit() { return 0; } // M5 retains ownership, including after failed init
int SCCB_Probe(uint8_t address) {
  if (address != 0x21) return -1;
  Transaction tx;
  if (!tx.held) return -1;
  uint8_t id = 0;
  return M5.In_I2C.readRegister(address, 0, &id, 1, 100000) && id == 0x9b ? 0 : -1;
}
uint8_t SCCB_Read(uint8_t address, uint8_t reg) {
  Transaction tx;
  uint8_t value = 0xff;
  if (tx.held && address == 0x21) M5.In_I2C.readRegister(address, reg, &value, 1, 100000);
  return value;
}
int SCCB_Write(uint8_t address, uint8_t reg, uint8_t value) {
  Transaction tx;
  return tx.held && address == 0x21 && M5.In_I2C.writeRegister8(address, reg, value, 100000) ? 0 : -1;
}
// Other compiled-in sensor detectors must fail without touching the shared bus.
uint8_t SCCB_Read16(uint8_t, uint16_t) { return 0xff; }
int SCCB_Write16(uint8_t, uint16_t, uint8_t) { return -1; }
uint16_t SCCB_Read_Addr16_Val16(uint8_t, uint16_t) { return 0xffff; }
int SCCB_Write_Addr16_Val16(uint8_t, uint16_t, uint16_t) { return -1; }
}
