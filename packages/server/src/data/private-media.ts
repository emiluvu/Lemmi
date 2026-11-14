import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { AssetIdSchema } from '../../../contracts/src/profile-assets';

export const sha256 = (data: Uint8Array | string) =>
  createHash('sha256').update(data).digest('hex');
export function decodeMedia(
  base64: string,
  mediaType: string,
): { bytes: Buffer; width?: number; height?: number } {
  if (base64.length > 27962028 || base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64))
    throw new Error('Invalid base64');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64') !== base64 || bytes.length < 1 || bytes.length > 20 * 1024 * 1024)
    throw new Error('Media size limit');
  let width: number | undefined, height: number | undefined;
  if (mediaType === 'image/png') {
    if (
      bytes.length > 5 * 1024 * 1024 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw new Error('Invalid PNG');
    if (
      bytes.length < 45 ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' ||
      bytes.readUInt32BE(8) !== 13
    )
      throw new Error('Invalid PNG header');
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    // Only ordinary noninterlaced 8-bit RGB/RGBA; a narrow, bounded accepted format.
    if (
      ![2, 6].includes(bytes[25]!) ||
      bytes[24] !== 8 ||
      bytes[26] !== 0 ||
      bytes[27] !== 0 ||
      bytes[28] !== 0
    )
      throw new Error('Unsupported PNG');
    if (!width || !height || width > 4096 || height > 4096 || width * height > 8000000)
      throw new Error('Image dimensions limit');
    let offset = 8;
    const data: Buffer[] = [];
    let ended = false;
    let headers = 0;
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (offset + 12 + size > bytes.length) throw new Error('Truncated PNG');
      const chunk = bytes.subarray(offset + 8, offset + 8 + size);
      let crc = 0xffffffff;
      for (const byte of bytes.subarray(offset + 4, offset + 8 + size)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
      if ((crc ^ 0xffffffff) >>> 0 !== bytes.readUInt32BE(offset + 8 + size))
        throw new Error('Invalid PNG checksum');
      if (type === 'IHDR' && (++headers !== 1 || offset !== 8))
        throw new Error('Duplicate/out-of-order PNG header');
      if (type === 'IDAT') data.push(chunk);
      if (type === 'IEND') {
        if (size !== 0 || offset + 12 !== bytes.length) throw new Error('Invalid PNG end');
        ended = true;
        break;
      }
      // Reject textual/EXIF/ancillary metadata rather than retaining embedded private data.
      if (!['IHDR', 'IDAT', 'IEND'].includes(type))
        throw new Error('PNG metadata/chunk unsupported; export a plain RGB PNG');
      offset += 12 + size;
    }
    if (!ended || !data.length) throw new Error('Incomplete PNG');
    const expected = (width * (bytes[25] === 6 ? 4 : 3) + 1) * height;
    const pixels = inflateSync(Buffer.concat(data), { maxOutputLength: expected });
    if (pixels.length !== expected) throw new Error('Invalid PNG pixels');
    const rowBytes = width * (bytes[25] === 6 ? 4 : 3) + 1;
    for (let row = 0; row < height; row++)
      if (pixels[row * rowBytes]! > 4) throw new Error('Invalid PNG filter');
  } else if (mediaType === 'audio/wav') {
    if (
      bytes.length < 44 ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WAVE' ||
      bytes.readUInt32LE(4) + 8 !== bytes.length
    )
      throw new Error('Invalid WAV');
    if (
      bytes.toString('ascii', 12, 16) !== 'fmt ' ||
      bytes.readUInt32LE(16) !== 16 ||
      bytes.readUInt16LE(20) !== 1 ||
      ![1, 2].includes(bytes.readUInt16LE(22)) ||
      bytes.readUInt16LE(34) !== 16 ||
      bytes.toString('ascii', 36, 40) !== 'data' ||
      bytes.readUInt32LE(40) + 44 !== bytes.length
    )
      throw new Error('Only metadata-free PCM16 WAV supported');
    const channels = bytes.readUInt16LE(22),
      rate = bytes.readUInt32LE(24),
      frame = channels * 2;
    if (
      rate < 8000 ||
      rate > 48000 ||
      bytes.readUInt16LE(32) !== frame ||
      bytes.readUInt32LE(28) !== rate * frame ||
      (bytes.length - 44) % frame !== 0 ||
      (bytes.length - 44) / (rate * frame) > 300
    )
      throw new Error('Invalid/overlong WAV');
  } else throw new Error('Only plain PNG and PCM WAV are supported');
  return { bytes, ...(width && height ? { width, height } : {}) };
}

export class PrivateMedia {
  private constructor(readonly root: string) {}
  static async create(directory: string) {
    if (!isAbsolute(directory)) throw new Error('Private media directory must be absolute');
    const root = resolve(directory);
    if (root === '/' || /\/(static|public)(\/|$)/.test(root))
      throw new Error('Media must be outside public/static roots');
    await mkdir(root, { recursive: true, mode: 0o700 });
    const stat = await lstat(root);
    if (stat.isSymbolicLink() || !stat.isDirectory() || (await realpath(root)) !== root)
      throw new Error('Media root must be a real private directory');
    await chmod(root, 0o700);
    return new PrivateMedia(root);
  }
  private path(key: string) {
    return join(this.root, AssetIdSchema.parse(key));
  }
  async write(key: string, bytes: Uint8Array) {
    const handle = await open(
      this.path(key),
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  async read(key: string, length: number, digest: string) {
    const handle = await open(
      this.path(key),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== length || stat.size > 20 * 1024 * 1024)
        throw new Error('Private media unavailable');
      const bytes = Buffer.alloc(length);
      let offset = 0;
      while (offset < length) {
        const read = await handle.read(bytes, offset, length - offset, offset);
        if (!read.bytesRead) throw new Error('Private media truncated');
        offset += read.bytesRead;
      }
      if ((await handle.stat()).size !== length) throw new Error('Private media changed');
      if (sha256(bytes) !== digest) throw new Error('Private media integrity failure');
      return bytes;
    } finally {
      await handle.close();
    }
  }
  async remove(key: string) {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
