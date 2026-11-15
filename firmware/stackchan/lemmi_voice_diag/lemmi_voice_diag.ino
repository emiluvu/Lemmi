// Diagnostic-only link wrappers: observe the exact SDK calls, forward once
// with unchanged arguments/return value. Never read or retain media bytes.
#define LEMMI_VOICE 1
#define LEMMI_VOICE_DIAGNOSTICS 1
#define LEMMI_VOICE_VERSION "lemmi-voice/0.9-diag1"
#include <Arduino.h>
#include <atomic>
#include <esp_transport.h>
#include <esp_tls.h>
#include <esp_tls_errors.h>
#include "../audio/TransportProbe.h"
static lemmi::TransportProbe transportProbe;
static std::atomic<TaskHandle_t> transportProbeTask{nullptr};
extern "C" int __real_esp_transport_poll_write(esp_transport_handle_t,int);
extern "C" ssize_t __real_esp_tls_conn_write(esp_tls_t*,const void*,size_t);
extern "C" int __wrap_esp_transport_poll_write(esp_transport_handle_t t,int timeout){
  if(transportProbeTask.load()!=xTaskGetCurrentTaskHandle())return __real_esp_transport_poll_write(t,timeout);
  uint32_t at=micros();int result=__real_esp_transport_poll_write(t,timeout);
  transportProbe.poll(result,uint32_t(micros()-at));return result;
}
extern "C" ssize_t __wrap_esp_tls_conn_write(esp_tls_t* t,const void* p,size_t n){
  if(transportProbeTask.load()!=xTaskGetCurrentTaskHandle())return __real_esp_tls_conn_write(t,p,n);
  uint32_t at=micros();ssize_t result=__real_esp_tls_conn_write(t,p,n);
  transportProbe.write(int(result),uint32_t(micros()-at),ESP_TLS_ERR_SSL_WANT_READ,ESP_TLS_ERR_SSL_WANT_WRITE);
  return result;
}
#include "../lemmi_control/lemmi_control.ino"
