// Canvas exports differ between browsers. Keep only pixel chunks so sRGB/pHYs
// metadata cannot make an otherwise ordinary export fail the private PNG parser.
export function plainPngBase64(encoded: string): string {
  const raw = atob(encoded);
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  let output = raw.slice(0, 8);
  for (let offset = 8; offset + 12 <= bytes.length; ) {
    const size = view.getUint32(offset);
    const end = offset + 12 + size;
    if (end > bytes.length) throw new Error('Invalid exported PNG');
    const type = raw.slice(offset + 4, offset + 8);
    if (['IHDR', 'IDAT', 'IEND'].includes(type)) output += raw.slice(offset, end);
    offset = end;
  }
  return btoa(output);
}
