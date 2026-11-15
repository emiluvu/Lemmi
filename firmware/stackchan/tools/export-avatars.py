#!/usr/bin/env python3
"""Deterministic RGB565 device export; original PNGs are unchanged."""
from pathlib import Path
import argparse
import shutil
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--target', choices=('avatars','display'), default='avatars')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / ('lemmi_' + args.target)
width, height = (320,240) if args.target=='display' else (144,144)
names = ('dog', 'cat', 'bunny', 'bird', 'lemming')
with (target / 'AvatarFrames.h').open('w') as out:
    out.write('#pragma once\n#include <stdint.h>\n')
    out.write('static const char* const avatarNames[]={"dog","cat","bunny","bird","lemming"};\n')
    for name in names:
        source = Image.open(root / 'assets/avatars/v1' / (name + '-strip.png')).convert('RGBA')
        if source.size != (2172, 724):
            raise SystemExit('Unexpected sprite dimensions')
        tiles = [source.crop((724*f,0,724*(f+1),724)) for f in range(3)]
        if args.target=='display':
            # Fix a single transform per identity: body centered at (160,120),
            # enlarged until either body or hearts reaches the safe screen edge.
            # Use alpha thresholds only for bounds; preserve alpha in compositing.
            bounds = [t.getchannel('A').point(lambda a:255 if a>=32 else 0).getbbox() for t in tiles]
            if not all(bounds):
                raise SystemExit('Empty avatar frame')
            body = bounds[0]
            cx,cy = (body[0]+body[2])/2,(body[1]+body[3])/2
            union = (min(b[0] for b in bounds),min(b[1] for b in bounds),
                     max(b[2] for b in bounds),max(b[3] for b in bounds))
            scale = min(156/max(cx-union[0],union[2]-cx),116/max(cy-union[1],union[3]-cy))
            scaled = (round(724*scale),round(724*scale))
            position = (round(160-cx*scale),round(120-cy*scale))
        for frame in range(3):
            if args.target=='display':
                tile = tiles[frame].resize(scaled,Image.Resampling.LANCZOS)
                bg = Image.new('RGBA',(width,height),(0,0,0,255))
                bg.alpha_composite(tile,dest=position)
            else:
                tile = tiles[frame].resize((width,height), Image.Resampling.LANCZOS)
                bg = Image.new('RGBA', tile.size, (255,248,234,255))
                bg.alpha_composite(tile)
            pixels = [((r>>3)<<11)|((g>>2)<<5)|(b>>3) for r,g,b,a in bg.getdata()]
            out.write(f'static const uint16_t {name}_{frame}[]={{\n')
            for i in range(0,len(pixels),24):
                out.write(','.join(f'0x{p:04x}' for p in pixels[i:i+24])+',\n')
            out.write('};\n')
    out.write('static const uint16_t* const avatarFrames[5][3]={\n')
    for name in names:
        out.write('{'+','.join(f'{name}_{f}' for f in range(3))+'},\n')
    out.write('};\n')
# Reuse the existing offline experiment's sensor/gesture code, without forking it.
for name in ('PetGesture.h','TouchStrip.h'):
    shutil.copyfile(root / 'lemmi_petting' / name, target / name)
print(f'Exported 15 RGB565 {width}x{height} frames ({15*width*height*2} flash bytes); reused petting headers.')
