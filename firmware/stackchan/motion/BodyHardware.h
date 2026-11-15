#pragma once
#include <M5Unified.h>
#include <driver/uart.h>
#include "ServoPacket.h"
#include "../presentation/StatusLights.h"

// Narrow adapters derived from official register/protocol facts; no BSP begin,
// RGB animation, calibration, EEPROM, broadcast position, or pitch motion.
class BodyHardware {
public:
  const char* faultStage() const {return faultStage_;}
  const char* transportStatus() const {return transportStatus_;}
  int batteryMillivolts() const {return batteryMv_;}
  const char* yawProbeStatus() const {return yawProbe_;}
  const char* pitchProbeStatus() const {return pitchProbe_;}
  bool probeOnly(){
    if(!powered_)return fail("power_missing");
    uint8_t voltage[2]={};
    batteryMv_=M5.In_I2C.readRegister(0x41,2,voltage,2,100000)
      ? int((uint32_t(voltage[0])<<8|voltage[1])*125/100) : -1;
    int yaw=byteRead(40);yawProbe_=yaw<0?transportStatus_:yaw<=1?"ok":"value";
    int pitch=byteRead(40,2);pitchProbe_=pitch<0?transportStatus_:pitch<=1?"ok":"value";
    bool off=powerOff();
    Serial.printf("event=servo_probe battery_mv=%d yaw=%s pitch=%s off=%u capture=off camera=off\n",
      batteryMv_,yawProbe_,pitchProbe_,off);
    return off || fail("power_off");
  }
  bool begin(){
    uint8_t version=0;
    if(!read(2,version)||version==0||version==255)return false;
    // Output latch low before making VM pin an output. Preserve unrelated pins.
    ready_=updateBit(5,1,false)&&updateBit(3,1,true)
      &&updateBit(11,1,false)&&updateBit(9,1,true); // official VM pin pull-up
    if(!ready_)return false;
    if(!updateBit(4,32,true)||!updateBit(12,32,false)||!updateBit(10,32,true)||!updateBit(20,32,false)||!write(0x24,12))return false;
    return pink(false);
  }
  bool pink(bool on){
    return lights(on?StatusLights::Color::Pink:StatusLights::Color::Off);
  }
  bool lights(StatusLights::Color state){
    if(!ready_)return false;
    // LED RAM contains little-endian RGB565 words. No servo traffic.
    const uint16_t color=StatusLights::rgb565(state);
    for(int i=0;i<12;i++){
      uint8_t data[]={uint8_t(color),uint8_t(color>>8)};
      if(!M5.In_I2C.writeRegister(0x6f,0x30+i*2,data,2,100000))return false;
    }
    return write(0x24,12|64);
  }
  bool powerOff(){moving_=false;powered_=false;return ready_&&updateBit(5,1,false);}
  bool beginPower(uint32_t now){
    if(!ready_)return false;
    if(!uartReady_&&!beginUart())return fail("uart_init");
    if(!updateBit(5,1,true))return fail("power_on");
    powered_=true;powerAt_=now;return true;
  }
  bool settled(uint32_t now)const{return powered_&&uint32_t(now-powerAt_)>=250;}
  bool prepare(){
    // Only after operator-armed power-up. Never use factory default zero as pose.
    if(!powered_)return fail("power_missing");
    // A read reply distinguishes an unreachable servo from missing write ACKs.
    int torque=byteRead(40);
    if(torque<0)return fail("yaw_probe");
    if(torque>1)return fail("yaw_torque_value");
    if(!byteWrite(40,0))return fail("yaw_torque_off");
    if(!byteWrite(40,0,2))return fail("pitch_torque_off");
    int lo=wordRead(9);if(lo<0)return fail("yaw_limit_low");
    int hi=wordRead(11);if(hi<0)return fail("yaw_limit_high");
    int pos=wordRead(56);if(pos<0)return fail("yaw_position");
    if(lo<0||hi>1000||lo>=hi||pos<100||pos>900||pos<lo+12||pos>hi-12)return fail("pose_bounds");
    // Pitch torque was explicitly disabled above; never send pitch goals.
    base_=pos;
    if(!goal(pos,800))return fail("hold_goal");
    if(!byteWrite(40,1))return fail("yaw_torque_on");
    moving_=true;return true;
  }
  bool move(int offset,uint16_t duration){
    if(!moving_||offset < -6||offset>6)return fail("move_bounds");
    return goal(base_+offset,duration)||fail("move_goal");
  }
  bool finish(){
    int pos=wordRead(56);
    bool centered=pos>=base_-3&&pos<=base_+3;
    bool torqueOff=byteWrite(40,0);
    bool off=powerOff();
    if(!centered)return fail("return_position");
    if(!torqueOff)return fail("finish_torque_off");
    if(!off)return fail("power_off");
    return true;
  }
private:
  static constexpr uart_port_t port_=UART_NUM_1;
  bool beginUart(){
    transportStatus_="uart_busy";
    if(uart_is_driver_installed(port_))return false;
    transportStatus_="uart_install";
    if(uart_driver_install(port_,256,256,0,nullptr,0)!=ESP_OK)return false;
    uart_config_t config={};
    config.baud_rate=1000000;config.data_bits=UART_DATA_8_BITS;
    config.parity=UART_PARITY_DISABLE;config.stop_bits=UART_STOP_BITS_1;
    config.flow_ctrl=UART_HW_FLOWCTRL_DISABLE;config.source_clk=UART_SCLK_DEFAULT;
    transportStatus_="uart_config";
    if(uart_param_config(port_,&config)!=ESP_OK ||
       uart_set_pin(port_,6,7,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE)!=ESP_OK ||
       uart_set_rx_full_threshold(port_,1)!=ESP_OK || uart_set_rx_timeout(port_,2)!=ESP_OK){
      uart_driver_delete(port_);return false;
    }
    uartReady_=true;return true;
  }
  bool ready_=false,uartReady_=false,powered_=false,moving_=false;
  int base_=0;uint32_t powerAt_=0;
  int batteryMv_=-1;
  const char* yawProbe_="none";const char* pitchProbe_="none";
  const char* faultStage_="none";
  const char* transportStatus_="none";
  bool fail(const char* stage){
    faultStage_=stage;powerOff();
    Serial.printf("event=motion_fault stage=%s transport=%s capture=off camera=off\n",faultStage_,transportStatus_);
    return false;
  }
  bool read(uint8_t reg,uint8_t& value){return M5.In_I2C.readRegister(0x6f,reg,&value,1,100000);}
  bool write(uint8_t reg,uint8_t value){return M5.In_I2C.writeRegister8(0x6f,reg,value,100000);}
  bool updateBit(uint8_t reg,uint8_t mask,bool on){
    uint8_t old=0,check=0;if(!read(reg,old))return false;
    uint8_t next=on?old|mask:old&uint8_t(~mask);
    return write(reg,next)&&read(reg,check)&&(check&mask)==(next&mask);
  }
  bool exchange(uint8_t instruction,uint8_t reg,const uint8_t* data,size_t size,uint8_t* reply,size_t payload,uint8_t id=1){
    transportStatus_="not_ready";
    if(!uartReady_)return false;
    transportStatus_="rx_flush";
    if(uart_flush_input(port_)!=ESP_OK)return false;
    uint8_t tx[13];size_t length=servoPacket::request(tx,instruction,reg,data,size,id);
    transportStatus_="write";
    if(!length||uart_write_bytes(port_,tx,length)!=int(length))return false;
    transportStatus_="tx_wait";
    if(uart_wait_tx_done(port_,pdMS_TO_TICKS(2)+1)!=ESP_OK)return false;
    size_t used=0;uint32_t at=millis();
    while(used<payload+6&&uint32_t(millis()-at)<12){
      int got=uart_read_bytes(port_,reply+used,payload+6-used,0);
      if(got<0){transportStatus_="rx_error";return false;}
      if(got)used+=size_t(got);else delay(1);
    }
    if(used<payload+6){transportStatus_=used?"timeout_partial":"timeout_empty";return false;}
    if(!servoPacket::reply(reply,used,payload,id)){transportStatus_="reply";return false;}
    transportStatus_="ok";return true;
  }
  bool byteWrite(uint8_t reg,uint8_t value,uint8_t id=1){uint8_t rx[6];return exchange(3,reg,&value,1,rx,0,id);}
  int byteRead(uint8_t reg,uint8_t id=1){uint8_t count=1,rx[7];return exchange(2,reg,&count,1,rx,1,id)?rx[5]:-1;}
  int wordRead(uint8_t reg){uint8_t count=2,rx[8];return exchange(2,reg,&count,1,rx,2)?(int(rx[5])<<8)|rx[6]:-1;}
  bool goal(int pos,uint16_t duration){
    if(pos<0||pos>1000||duration<800||duration>1600)return false;
    uint8_t data[]={uint8_t(pos>>8),uint8_t(pos),uint8_t(duration>>8),uint8_t(duration),0,20},rx[6];
    return exchange(3,42,data,6,rx,0);
  }
};
