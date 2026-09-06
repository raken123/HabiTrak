// An independent LZW/GIF reader, written for the tests only.
//
// The encoder in gif.js has no third-party implementation to check against in
// this repo, so the tests decode its output with a separately written decoder.
// A round trip through both directions catches the mistakes that actually
// happen here: code-size growth landing one code early or late, and the
// dictionary reset at 4096.

export function lzwDecode(bytes, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let dict = [];
  let codeSize = minCodeSize + 1;

  const reset = () => {
    dict = [];
    for (let i = 0; i < clearCode; i += 1) dict.push([i]);
    dict.push(null); // clear
    dict.push(null); // eoi
    codeSize = minCodeSize + 1;
  };
  reset();

  const out = [];
  let bitPos = 0;
  const totalBits = bytes.length * 8;
  const readCode = () => {
    let value = 0;
    for (let i = 0; i < codeSize; i += 1) {
      const bit = (bytes[bitPos >> 3] >> (bitPos & 7)) & 1;
      value |= bit << i;
      bitPos += 1;
    }
    return value;
  };

  let prev = null;
  while (bitPos + codeSize <= totalBits) {
    const code = readCode();
    if (code === clearCode) { reset(); prev = null; continue; }
    if (code === eoiCode) break;

    let entry;
    if (code < dict.length && dict[code]) {
      entry = dict[code];
    } else if (prev) {
      entry = prev.concat(prev[0]); // the KwKwK case
    } else {
      throw new Error(`LZW: code ${code} is not in the dictionary`);
    }

    for (const v of entry) out.push(v);

    if (prev) {
      dict.push(prev.concat(entry[0]));
      if (dict.length === (1 << codeSize) && codeSize < 12) codeSize += 1;
    }
    prev = entry;
  }
  return out;
}

/** Walk a .gif file and report its structure, so the tests can assert on it. */
export function parseGif(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (o, n) => String.fromCharCode(...bytes.subarray(o, o + n));
  if (str(0, 6) !== 'GIF89a') throw new Error('not a GIF89a file');

  const width = dv.getUint16(6, true);
  const height = dv.getUint16(8, true);
  const packed = bytes[10];
  const gctSize = 1 << ((packed & 0x07) + 1);
  let p = 13 + (packed & 0x80 ? gctSize * 3 : 0);

  const palette = [];
  for (let i = 0; i < gctSize; i += 1) {
    const o = 13 + i * 3;
    palette.push([bytes[o], bytes[o + 1], bytes[o + 2]]);
  }

  const skipSubBlocks = () => {
    while (bytes[p] !== 0) p += 1 + bytes[p];
    p += 1;
  };
  const readSubBlocks = () => {
    const parts = [];
    while (bytes[p] !== 0) {
      const len = bytes[p];
      parts.push(bytes.subarray(p + 1, p + 1 + len));
      p += 1 + len;
    }
    p += 1;
    const total = parts.reduce((n, a) => n + a.length, 0);
    const joined = new Uint8Array(total);
    let o = 0;
    for (const part of parts) { joined.set(part, o); o += part.length; }
    return joined;
  };

  const frames = [];
  let loops = null;
  let pendingDelay = 0;

  while (p < bytes.length) {
    const block = bytes[p];
    if (block === 0x3b) { p += 1; break; } // trailer
    if (block === 0x21) {
      const label = bytes[p + 1];
      p += 2;
      if (label === 0xf9) {
        p += 1; // block size
        p += 1; // packed
        pendingDelay = dv.getUint16(p, true) * 10;
        p += 2;
        p += 1; // transparent index
        p += 1; // terminator
      } else if (label === 0xff) {
        const size = bytes[p];
        const ident = str(p + 1, 11);
        p += 1 + size;
        if (ident === 'NETSCAPE2.0') {
          loops = dv.getUint16(p + 2, true);
        }
        skipSubBlocks();
      } else {
        p += 1;
        skipSubBlocks();
      }
      continue;
    }
    if (block === 0x2c) {
      p += 1;
      const fx = dv.getUint16(p, true);
      const fy = dv.getUint16(p + 2, true);
      const fw = dv.getUint16(p + 4, true);
      const fh = dv.getUint16(p + 6, true);
      p += 9;
      const minCodeSize = bytes[p];
      p += 1;
      const data = readSubBlocks();
      frames.push({ x: fx, y: fy, width: fw, height: fh, minCodeSize, indices: lzwDecode(data, minCodeSize), delayMs: pendingDelay });
      continue;
    }
    throw new Error(`unexpected block 0x${block.toString(16)} at ${p}`);
  }

  return { width, height, palette, gctSize, frames, loops };
}
