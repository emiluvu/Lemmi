// Diagnostic-only link wrappers: observe the exact SDK calls, forward once
// with unchanged arguments/return value. Never read or retain media bytes.
#define LEMMI_VOICE 1
#define LEMMI_VOICE_DIAGNOSTICS 1
#include <sdkconfig.h>
#ifdef LEMMI_TCP_BOUNDED16
#define LEMMI_VOICE_VERSION "lemmi-voice/0.12-diag1-tcp16"
#else
#define LEMMI_VOICE_VERSION "lemmi-voice/0.11-diag1"
#endif
#include <Arduino.h>
#include <atomic>
#include <esp_transport.h>
#include <esp_tls.h>
#include <esp_tls_errors.h>
#include <lwip/api.h>
#include <lwip/tcp.h>
#include <lwip/tcpip.h>
#include "../audio/TransportProbe.h"
#include "../audio/TcpProbe.h"
static lemmi::TransportProbe transportProbe;
static lemmi::TcpProbe tcpProbe;
static std::atomic<TaskHandle_t> transportProbeTask{nullptr};
// The selected network worker owns this connection's lifetime and clears the
// binding BEFORE destruction. Snapshot TCP state only under the SDK core lock.
static netconn* transportProbeConnection=nullptr;
static void sampleTcpProbe(){
  if(!transportProbeConnection)return;
#if !LWIP_TCPIP_CORE_LOCKING
#error TCP snapshots require the pinned SDK core-locking API
#endif
  LOCK_TCPIP_CORE();
  if(NETCONNTYPE_GROUP(transportProbeConnection->type)==NETCONN_TCP&&transportProbeConnection->pcb.tcp){
    const auto pcb=transportProbeConnection->pcb.tcp;
    tcpProbe.observe(tcp_sndbuf(pcb),tcp_sndqueuelen(pcb),pcb->snd_wnd,pcb->cwnd,
                     pcb->lastack,pcb->nrtx,pcb->unacked!=nullptr,pcb->unsent!=nullptr);
  }
  UNLOCK_TCPIP_CORE();
}
static void clearTcpProbeBinding(){transportProbeConnection=nullptr;tcpProbe=lemmi::TcpProbe{};}
extern "C" int __real_esp_transport_poll_write(esp_transport_handle_t,int);
extern "C" ssize_t __real_esp_tls_conn_write(esp_tls_t*,const void*,size_t);
extern "C" err_t __real_netconn_write_partly(netconn*,const void*,size_t,u8_t,size_t*);
extern "C" err_t __wrap_netconn_write_partly(netconn* connection,const void* data,size_t bytes,u8_t flags,size_t* written){
  const bool selected=transportProbeTask.load()==xTaskGetCurrentTaskHandle();
  if(selected){transportProbeConnection=connection;sampleTcpProbe();}
  const err_t result=__real_netconn_write_partly(connection,data,bytes,flags,written);
  if(selected)sampleTcpProbe();
  return result;
}
extern "C" int __wrap_esp_transport_poll_write(esp_transport_handle_t t,int timeout){
  if(transportProbeTask.load()!=xTaskGetCurrentTaskHandle())return __real_esp_transport_poll_write(t,timeout);
  uint32_t at=micros();int result=__real_esp_transport_poll_write(t,timeout);
  transportProbe.poll(result,uint32_t(micros()-at));sampleTcpProbe();return result;
}
extern "C" ssize_t __wrap_esp_tls_conn_write(esp_tls_t* t,const void* p,size_t n){
  if(transportProbeTask.load()!=xTaskGetCurrentTaskHandle())return __real_esp_tls_conn_write(t,p,n);
  uint32_t at=micros();ssize_t result=__real_esp_tls_conn_write(t,p,n);
  transportProbe.write(int(result),uint32_t(micros()-at),ESP_TLS_ERR_SSL_WANT_READ,ESP_TLS_ERR_SSL_WANT_WRITE);
  return result;
}
#include "../lemmi_control/lemmi_control.ino"
