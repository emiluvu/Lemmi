"""Offline content preparation only; no uploads, publication, approval or playback.

Requires PyAV and NumPy (available in the existing isolated speech environment).
Pass the supplied folder and an ignored .data/alex-profile-media output folder.
Original files and visible watermarks are preserved. Outputs remain unapproved.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import wave
import zlib

import av


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


def convert_image(source, target):
    with av.open(str(source)) as container:
        frame = next(container.decode(video=0))
        width, height = frame.width, frame.height
        if width > 4096 or height > 4096 or width * height > 8_000_000:
            raise ValueError('Image dimensions exceed existing upload limits')
        pixels = frame.to_ndarray(format='rgb24').tobytes()
    # Only IHDR/IDAT/IEND: no EXIF, textual metadata, palette or interlacing.
    stride = width * 3
    rows = b''.join(b'\0' + pixels[i:i + stride] for i in range(0, len(pixels), stride))
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
    if len(png) > 5 * 1024 * 1024:
        raise ValueError('PNG exceeds existing upload limit')
    target.write_bytes(png)
    return {'width': width, 'height': height, 'mediaType': 'image/png'}


def convert_music(source, target):
    resampler = av.AudioResampler(format='s16', layout='mono', rate=32000)
    pcm = bytearray()
    with av.open(str(source)) as container:
        metadata_title = container.metadata.get('title')
        for frame in container.decode(audio=0):
            for output in resampler.resample(frame):
                pcm.extend(output.to_ndarray().astype('<i2', copy=False).tobytes())
                if len(pcm) > 20 * 1024 * 1024 - 44:
                    raise ValueError('Full song exceeds WAV size limit; not truncated')
        for output in resampler.resample(None):
            pcm.extend(output.to_ndarray().astype('<i2', copy=False).tobytes())
    duration = len(pcm) / (32000 * 2)
    if duration > 300 or len(pcm) + 44 > 20 * 1024 * 1024:
        raise ValueError('Full song exceeds upload limits; not truncated')
    with wave.open(str(target), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(32000)
        output.writeframes(pcm)
    return {'mediaType': 'audio/wav', 'durationSeconds': duration,
            'sampleRate': 32000, 'channels': 1, 'fullRecording': True,
            'metadataTitle': metadata_title}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    # Prepared derivatives belong only in the repository's ignored data directory.
    data_root = Path(__file__).resolve().parents[2] / '.data'
    output = args.output.resolve()
    if not output.is_relative_to(data_root.resolve()):
        parser.error('Output must be inside the repository .data directory')
    if not args.source.is_dir():
        parser.error('Source folder is missing')
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    for source in sorted(args.source.iterdir()):
        if source.suffix.lower() not in {'.jpg', '.jpeg', '.mp3'}:
            continue
        target = output / (source.stem + ('.wav' if source.suffix.lower() == '.mp3' else '.png'))
        info = (convert_music if source.suffix.lower() == '.mp3' else convert_image)(source, target)
        entries.append({'inputFile': source.name, 'outputFile': target.name,
                        'approved': False, 'permissionStatus': 'missing',
                        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                        'byteLength': target.stat().st_size, **info})
    (output / 'manifest.json').write_text(json.dumps(entries, indent=2), encoding='utf-8')
    print(f'Prepared {len(entries)} private, unapproved derivatives; no files uploaded.')


if __name__ == '__main__':
    main()
