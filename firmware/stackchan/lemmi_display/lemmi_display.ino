#include <M5Unified.h>
#include "AvatarFrames.h"
#include "PetGesture.h"
#include "TouchStrip.h"
#include "../motion/BodyHardware.h"

// Offline avatar and pet-triggered lights only. No servo/network/mic/camera use.
namespace {
BodyHardware body;
bool bodyOK=false,lightFault=false;
TouchStrip strip;
PetGesture gesture;
M5Canvas canvas(&M5.Display);
bool bufferOK=false, sensorOK=false, stopped=false, hearts=false, dirty=true;
bool reduced=false;
bool resumePending=false;
uint8_t avatar=4;
uint32_t pollAt=0, heartAt=0;
void button(int y,const char* label,uint16_t color=TFT_DARKGREY){
  M5.Display.fillRoundRect(8,y,304,38,5,color);
  M5.Display.setTextColor(TFT_WHITE,color);M5.Display.setTextSize(2);
  M5.Display.setCursor(16,y+11);M5.Display.print(label);
}
void stop(){
  if(bodyOK){if(!body.powerOff())lightFault=true;if(!body.pink(false))lightFault=true;}
  stopped=true;resumePending=false;hearts=false;gesture.reset();dirty=true;
  M5.Mic.end();M5.Speaker.stop();M5.Speaker.end();
  Serial.println("event=display_stop capture=off camera=off");
}
void draw(){
  if(stopped){
    M5.Display.fillScreen(TFT_BLACK);M5.Display.setTextColor(TFT_WHITE,TFT_BLACK);
    M5.Display.setTextSize(2);M5.Display.setCursor(12,5);M5.Display.print("Stopped - effects off");
    M5.Display.setTextSize(1);M5.Display.setCursor(12,29);M5.Display.print("OFFLINE / microphone off / camera off");
    button(44,"NEXT AVATAR");
    button(88,reduced?"STATIC MODE: ON":"STATIC MODE: OFF");
    button(132,"RESUME DISPLAY",sensorOK?TFT_DARKGREEN:TFT_DARKGREY);
    M5.Display.setTextColor(TFT_WHITE,TFT_BLACK);M5.Display.setTextSize(1);
    M5.Display.setTextColor(TFT_WHITE,TFT_BLACK);M5.Display.setTextSize(2);
    M5.Display.setCursor(16,186);M5.Display.print("MOTION DISABLED");
    M5.Display.setTextSize(1);M5.Display.setCursor(12,220);
    M5.Display.print(!bodyOK||lightFault?"LIGHTS UNAVAILABLE":"Pink lights only with petting hearts");
  }else if(bufferOK){
    const auto* pixels=avatarFrames[avatar][hearts?2:0];
    for(int y=0;y<240;y++)for(int x=0;x<320;x++)canvas.drawPixel(x,y,pixels[y*320+x]);
    canvas.pushSprite(0,0);
  }
  dirty=false;
}
}
void setup(){
  auto c=M5.config();c.serial_baudrate=115200;c.internal_mic=false;c.internal_spk=false;
  c.internal_imu=false;c.internal_rtc=false;
  M5.begin(c);M5.Mic.end();M5.Speaker.end();
  bodyOK=body.begin();
  canvas.setPsram(false);canvas.setColorDepth(16);bufferOK=canvas.createSprite(320,240)!=nullptr;
  sensorOK=bufferOK&&strip.begin();gesture.reset();
  // Failed initialization stays in an explicit stopped/unavailable view.
  stopped=!bufferOK||!sensorOK;
  draw();Serial.println("firmware=lemmi-display/0.7 capture=off camera=off");
}
void loop(){
  M5.update();
  for(int i=0;i<M5.Touch.getCount();i++){
    const auto t=M5.Touch.getDetail(i);if(!t.isPressed())continue;
    // Whole display is the immediate local Stop target in the avatar view.
    if(!stopped){stop();break;}
    if(!t.wasPressed())continue;
    if(t.y>=44&&t.y<82){avatar=(avatar+1)%5;dirty=true;}
    else if(t.y>=88&&t.y<126){reduced=!reduced;dirty=true;}
    else if(t.y>=132&&t.y<170&&bufferOK){
      resumePending=true;
    }
    break;
  }
  // Finish explicit Resume on release, so its own held touch cannot immediately
  // trigger the full-screen Stop target in the newly displayed avatar view.
  if(resumePending){
    bool pressed=false;
    for(int i=0;i<M5.Touch.getCount();i++)if(M5.Touch.getDetail(i).isPressed())pressed=true;
    if(!pressed){
      resumePending=false;
      if(!sensorOK)sensorOK=strip.begin();
      if(sensorOK){gesture.reset();hearts=false;stopped=false;if(bodyOK&&!body.pink(false))lightFault=true;}
      dirty=true;
    }
  }
  uint32_t now=millis();
  if(!stopped&&sensorOK&&uint32_t(now-pollAt)>=20){
    pollAt=now;uint8_t raw=0;
    if(!strip.sample(raw)){sensorOK=false;stop();}
    else {
      const uint8_t zones=petZoneMask(raw);
      if(!hearts&&gesture.update(zones,true,now)){
        hearts=true;heartAt=now;dirty=true;
        if(bodyOK&&!lightFault&&!body.pink(true)){lightFault=true;stop();}
      }
    }
  }
  // Static pet_ack in either mode; no continuous animation or motion.
  if(hearts&&uint32_t(now-heartAt)>=1200){
    hearts=false;dirty=true;
    if(bodyOK&&!body.pink(false)){lightFault=true;stop();}
  }
  if(dirty)draw();
  delay(2);
}
