#pragma once
#include <M5Unified.h>
#include <assert.h>
typedef int uart_port_t;
static constexpr int UART_NUM_1=1,ESP_OK=0,UART_DATA_8_BITS=8;
static constexpr int UART_PARITY_DISABLE=0,UART_STOP_BITS_1=1;
static constexpr int UART_HW_FLOWCTRL_DISABLE=0,UART_SCLK_DEFAULT=0,UART_PIN_NO_CHANGE=-1;
#define pdMS_TO_TICKS(ms) (ms)
struct uart_config_t {int baud_rate,data_bits,parity,stop_bits,flow_ctrl,source_clk;};
static bool testUartInstalled=false;
static int testUartFailure=0;
static HardwareSerial testUart(1);
inline bool uart_is_driver_installed(uart_port_t){return testUartInstalled;}
inline int uart_driver_install(uart_port_t,int rx,int tx,int,void*,int){
  assert(rx==256&&tx==256);if(testUartFailure==1)return -1;
  testUartInstalled=true;return ESP_OK;
}
inline int uart_param_config(uart_port_t,const uart_config_t* c){
  assert(c->baud_rate==1000000&&c->data_bits==8&&c->stop_bits==1);
  return testUartFailure==2?-1:ESP_OK;
}
inline int uart_set_pin(uart_port_t,int tx,int rx,int,int){assert(tx==6&&rx==7);return ESP_OK;}
inline int uart_set_rx_full_threshold(uart_port_t,int n){assert(n==1);return ESP_OK;}
inline int uart_set_rx_timeout(uart_port_t,int n){assert(n==2);return ESP_OK;}
inline int uart_driver_delete(uart_port_t){testUartInstalled=false;return ESP_OK;}
inline int uart_flush_input(uart_port_t){testUart.rx.clear();return ESP_OK;}
inline int uart_write_bytes(uart_port_t,const void* p,size_t n){return int(testUart.write(static_cast<const uint8_t*>(p),n));}
inline int uart_wait_tx_done(uart_port_t,int){return testUartFailure==3?-1:ESP_OK;}
inline int uart_read_bytes(uart_port_t,void* out,size_t n,int){
  size_t used=0;auto* p=static_cast<uint8_t*>(out);
  while(used<n&&testUart.available())p[used++]=testUart.read();
  return int(used);
}
