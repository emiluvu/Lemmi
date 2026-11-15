#include <M5Unified.h>
#include "AvatarFrames.h"
#include "PetGesture.h"
#include "TouchStrip.h"

// Explicit offline artwork experiment: no Wi-Fi, speech, camera or motion.
namespace {
TouchStrip strip;
PetGesture gesture;
M5Canvas art(&M5.Display);
constexpr uint16_t cream=0xffdd;
bool stopped=false, talking=false, petting=false, hearts=false, reduced=false;
bool dirty=true, artDirty=true, bufferOK=false, sensorError=false;
uint8_t avatar=4, frame=0;
uint32_t talkAt=0, mouthAt=0, heartAt=0, pollAt=0;
void endEffects(){talking=false;petting=false;hearts=false;frame=0;gesture.reset();artDirty=true;}
void stop(){stopped=true;endEffects();M5.Mic.end();M5.Speaker.stop();M5.Speaker.end();dirty=true;
  Serial.println("event=avatar_stop capture=off camera=off");}
void button(int y,const char* label,uint16_t color=TFT_DARKGREY){
  M5.Display.fillRoundRect(164,y,152,32,5,color);
  M5.Display.setTextSize(1);M5.Display.setTextColor(TFT_WHITE,color);
  M5.Display.setCursor(172,y+12);M5.Display.print(label);
}
void drawArt(){
  if(!bufferOK)return;
  // drawPixel takes native RGB565 values, avoiding byte-order ambiguity.
  const auto* pixels=avatarFrames[avatar][hearts&&!stopped?2:frame];
  for(int y=0;y<144;y++)for(int x=0;x<144;x++)art.drawPixel(x,y,pixels[y*144+x]);
  art.pushSprite(8,38);artDirty=false;
}
void draw(){
  M5.Display.fillScreen(cream);M5.Display.setTextSize(1);M5.Display.setTextColor(TFT_BLACK,cream);
  M5.Display.setCursor(8,3);M5.Display.print("Lemmi - OFFLINE avatar test");
  M5.Display.setCursor(8,17);M5.Display.print("Camera off / Microphone off / No sound");
  button(38,"NEXT AVATAR");
  button(76,stopped?"READY (effects off)":talking?"END MOUTH TEST":"TEST MOUTH (6 sec)");
  button(114,petting?"DISABLE PETTING":sensorError?"RETRY PETTING":"ENABLE PETTING");
  button(152,reduced?"STATIC MODE: ON":"STATIC MODE: OFF");
  M5.Display.setCursor(10,183);M5.Display.print(avatarNames[avatar]);
  M5.Display.setCursor(65,183);M5.Display.print(!bufferOK?"Art unavailable":stopped?"Stopped":sensorError?"Sensor unavailable":petting?"Pet top strip":"Preview only");
  M5.Display.fillRect(0,198,320,42,TFT_RED);M5.Display.setTextColor(TFT_WHITE,TFT_RED);
  M5.Display.setTextSize(2);M5.Display.setCursor(120,211);M5.Display.print("STOP");
  drawArt();dirty=false;
}
}
void setup(){
  auto c=M5.config();c.serial_baudrate=115200;c.internal_mic=false;c.internal_spk=false;
  c.internal_imu=false;c.internal_rtc=false;M5.begin(c);M5.Mic.end();M5.Speaker.end();
  art.setPsram(false);art.setColorDepth(16);bufferOK=art.createSprite(144,144)!=nullptr;
  draw();Serial.println("firmware=lemmi-avatars/0.1 capture=off camera=off");
}
void loop(){
  M5.update();
  // Stop always precedes sensor and animation work; no server round trip.
  for(int i=0;i<M5.Touch.getCount();i++){
    const auto t=M5.Touch.getDetail(i);if(!t.isPressed())continue;
    if(t.y>=198){if(!stopped)stop();break;}
    if(!t.wasPressed()||t.x<164)continue;
    if(t.y>=38&&t.y<70){endEffects();avatar=(avatar+1)%5;dirty=true;}
    else if(t.y>=76&&t.y<108){
      if(stopped){stopped=false;endEffects();}
      else if(talking){talking=false;frame=0;artDirty=true;}
      else if(bufferOK){talking=true;talkAt=mouthAt=millis();}
      dirty=true;
    }else if(t.y>=114&&t.y<146&&!stopped){
      if(petting){petting=false;hearts=false;gesture.reset();}
      else{gesture.reset();petting=bufferOK&&strip.begin();sensorError=!petting;}
      dirty=artDirty=true;
    }else if(t.y>=152&&t.y<184){reduced=!reduced;talking=false;frame=0;dirty=artDirty=true;}
    break;
  }
  uint32_t now=millis();
  if(petting&&!stopped&&uint32_t(now-pollAt)>=20){
    pollAt=now;uint8_t raw=0;
    if(!strip.sample(raw)){petting=false;hearts=false;sensorError=true;dirty=artDirty=true;}
    else if(!hearts&&gesture.update(petZoneMask(raw),true,now)){
      talking=false;frame=0;hearts=true;heartAt=now;dirty=artDirty=true;
    }
  }
  if(hearts&&uint32_t(now-heartAt)>=1200){hearts=false;artDirty=true;}
  if(talking&&!stopped){
    if(uint32_t(now-talkAt)>=6000){talking=false;frame=0;dirty=artDirty=true;}
    else if(!reduced&&uint32_t(now-mouthAt)>=300){mouthAt=now;frame=1-frame;artDirty=true;}
  }
  if(dirty)draw();else if(artDirty)drawArt();
  delay(2);
}
