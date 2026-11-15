"""Pack user-supplied expressions for the web UI; requires Pillow, no network.

Usage: python3 scripts/build-avatar-strips.py /path/to/Untitled_Message
The existing web base images remain the source of each neutral frame.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'apps/web/static/images/avatars'
SOURCES = {
    'dog': ('IMG_3322.png', 'IMG_3315.png'),
    'cat': ('IMG_3320.png', 'IMG_3313.png'),
    'bunny': ('IMG_3319.png', 'IMG_3314.png'),
    'bird': ('IMG_3321.png', 'IMG_3316.png'),
    'lemming': ('IMG_3318.png', 'IMG_3317.png'),
}
CELL = 724
PADDING = 24


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    manifest = {
        'purpose': 'Lemmi web avatar expressions',
        'source': 'User-supplied Untitled_Message folder; existing user-supplied base artwork',
        'permission': 'User requested Lemmi project use; creator and broader license unspecified',
        'encoding': 'PNG RGBA',
        'cellSize': CELL,
        'frames': ['base', 'open_mouth', 'thinking'],
        'avatars': {},
    }
    for avatar, (mouth, thinking) in SOURCES.items():
        paths = [DEST / f'{avatar}.png', args.source / mouth, args.source / thinking]
        strip = Image.new('RGBA', (CELL * 3, CELL))
        entries = []
        for i, path in enumerate(paths):
            with Image.open(path) as original:
                frame = original.convert('RGBA')
                # Ignore nearly invisible export speckles when fitting the visible art.
                bounds = frame.getchannel('A').point(lambda alpha: 255 if alpha > 16 else 0).getbbox()
                if bounds is None:
                    raise ValueError(f'No visible artwork in {path.name}')
                left, top, right, bottom = bounds
                frame = frame.crop((max(0, left - 4), max(0, top - 4), min(frame.width, right + 4), min(frame.height, bottom + 4)))
                frame.thumbnail((CELL - PADDING * 2, CELL - PADDING * 2), Image.Resampling.LANCZOS)
                strip.paste(frame, (i * CELL + (CELL - frame.width) // 2, CELL - PADDING - frame.height))
                entries.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'width': original.width, 'height': original.height})
        output = DEST / f'{avatar}-strip.png'
        strip.save(output, optimize=True)
        manifest['avatars'][avatar] = {
            'file': output.name, 'width': CELL * 3, 'height': CELL,
            'bytes': output.stat().st_size, 'sources': entries,
            'alt': f'Lemmi {avatar}: base, open mouth, and thinking with dots',
        }
    (DEST / 'expressions.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
