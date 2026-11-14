#pragma once
#include <atomic>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
extern SemaphoreHandle_t peripheralBus;
extern std::atomic<bool> cameraWanted;
