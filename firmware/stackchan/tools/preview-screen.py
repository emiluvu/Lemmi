#!/usr/bin/env python3
"""Make a self-contained, offline layout study from Kylie's original PNGs.

No serial, network, image conversion, or firmware build/upload is performed.
"""
import argparse
import base64
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("artwork", type=Path)
args = parser.parse_args()
files = {
    "dog": (3322, 3315), "cat": (3320, 3313),
    "bunny": (3319, 3314), "bird": (3321, 3316),
    "lemming": (3318, 3317),
}
images = {}
for avatar, numbers in files.items():
    images[avatar] = []
    for number in numbers:
        data = (args.artwork / f"IMG_{number}.png").read_bytes()
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise SystemExit("Expected original PNG artwork")
        images[avatar].append("data:image/png;base64," + base64.b64encode(data).decode("ascii"))

html = """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lemmi — offline screen study</title>
<style>
*{box-sizing:border-box}body{background:#ede7de;color:#30271e;font:16px system-ui;margin:32px}
main{max-width:740px;margin:auto}h1{font-size:24px}p{line-height:1.5}
label{display:inline-block;margin:0 16px 16px 0}select{font:inherit;padding:8px}
.screen{width:320px;height:240px;background:#fff7e9;position:relative;overflow:hidden;
font-family:Arial,sans-serif;box-shadow:0 0 0 8px #252321;border-radius:5px;margin:24px 8px}
.privacy{position:absolute;top:0;left:0;width:320px;height:24px;background:#423426;
color:white;font-size:14px;line-height:24px;text-align:center}
.status{position:absolute;left:10px;top:29px;font-size:18px;font-weight:bold}
.art{position:absolute;left:5px;top:53px;width:176px;height:132px;overflow:hidden}
.art img{position:absolute;width:218px;height:199px;object-fit:contain;left:-21px;top:-33px}
.actions{position:absolute;right:8px;top:51px;width:126px;display:grid;gap:5px}
button{font: bold 17px Arial;border:0;border-radius:8px;min-height:40px;
background:#e5d4bb;color:#30271e}
button:disabled{opacity:1;color:#655c51;background:#e8e1d6}
.bottom{position:absolute;left:8px;right:8px;bottom:8px;display:flex;gap:8px}
.bottom button{height:43px}.mute{width:140px}.stop{flex:1;background:#a62524;color:white}
small{display:block;margin-top:16px;line-height:1.5}
</style><main><h1>Lemmi screen layout study</h1>
<p>Offline artwork preview · 320 × 240 pixels · no device connection.<br>
Controls below the selectors are visual samples and perform no actions.</p>
<label>Avatar <select id="avatar"><option>dog</option><option>cat</option><option>bunny</option>
<option>bird</option><option selected>lemming</option></select></label>
<label>Artwork <select id="expression"><option value="0">Open eyes</option>
<option value="1">Closed eyes + dots</option></select></label>
<div class="screen" aria-label="Offline stopped screen layout">
<div class="privacy">Microphone off · Camera off</div>
<div class="status">Stopped · Offline</div>
<div class="art"><img id="art" alt=""></div>
<div class="actions"><button disabled>Start</button><button disabled>Pause</button>
<button disabled>Get help</button></div>
<div class="bottom"><button class="mute" disabled>Mic muted</button>
<button class="stop" disabled>Stop</button></div></div>
<small>Original artwork: Kylie, supplied by Emilia. Identity mapping is provisional.
Two supplied expressions per avatar; interaction-state mapping is not yet agreed.
This study does not add listening, speaking, camera or petting behavior.
Connection/setup controls still need a separate layout before firmware integration.
Readability, touch reach and RGB565 rendering require actual hardware checks.</small>
<script>const images=__IMAGES__;
const avatar=document.getElementById('avatar'),expression=document.getElementById('expression');
function render(){const art=document.getElementById('art');art.src=images[avatar.value][+expression.value];
art.alt=avatar.value+' artwork, '+expression.selectedOptions[0].text;}
avatar.addEventListener('change',render);expression.addEventListener('change',render);render();
</script></main></html>"""
destination = Path(__file__).resolve().parents[1] / "build" / "ui-preview.html"
destination.parent.mkdir(exist_ok=True)
destination.write_text(html.replace("__IMAGES__", json.dumps(images)), encoding="utf-8")
print(destination)
