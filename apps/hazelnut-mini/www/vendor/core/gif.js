// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// A dependency-free GIF89a encoder.
//
// GIF Animate needs to turn a run of RGBA frames into one looping file, and
// pulling a native encoder into an Electron app means a build toolchain per
// platform. This does the whole job in plain JavaScript: median-cut
// quantisation to a shared 256-colour palette, optional Floyd–Steinberg
// dithering, and the LZW image data GIF requires.
//
// Frames arrive as { data: Uint8ClampedArray (RGBA), width, height, delayMs }
// — exactly the shape `CanvasRenderingContext2D.getImageData()` hands back.

const MAX_COLORS = 256;

/**
 * @param {Array<{data:Uint8ClampedArray|Uint8Array, delayMs?:number}>} frames
 * @param {{width:number, height:number, loop?:number, dither?:boolean, delayMs?:number}} opts
 * @returns {Uint8Array} the bytes of a complete .gif file
 */
export function encodeGif(frames, { width, height, loop = 0, dither = true, delayMs = 125 } = {}) {
  if (!frames.length) throw new Error('encodeGif needs at least one frame.');
  if (!width || !height) throw new Error('encodeGif needs the frame dimensions.');

  const palette = buildPalette(frames, width, height);
  const paletteBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, palette.length))));
  const paletteSize = 1 << paletteBits;
  const lookup = new NearestColor(palette);

  const out = new ByteStream();
  writeHeader(out, width, height, paletteBits);
  writePalette(out, palette, paletteSize);
  if (frames.length > 1) writeNetscapeLoop(out, loop);

  for (const frame of frames) {
    const indices = dither
      ? quantizeDithered(frame.data, width, height, lookup)
      : quantizeFlat(frame.data, lookup);
    const centiseconds = Math.max(2, Math.round((frame.delayMs ?? delayMs) / 10));
    writeGraphicControl(out, centiseconds);
    writeImageDescriptor(out, width, height);
    writeImageData(out, indices, paletteBits);
  }

  out.byte(0x3b); // trailer
  return out.toUint8Array();
}

/** Convenience: how many frames fit in `seconds` at `fps`, capped at GIF Animate's 5s. */
export function framePlan(seconds = 5, fps = 8) {
  const s = Math.min(5, Math.max(0.5, seconds));
  const f = Math.min(12, Math.max(4, Math.round(fps)));
  const count = Math.max(2, Math.round(s * f));
  return { count, delayMs: Math.round(1000 / f), seconds: s, fps: f };
}

// ---------------------------------------------------------------------------
// Quantisation
// ---------------------------------------------------------------------------

/**
 * Median cut across a sample of every frame, so the palette suits the whole
 * animation rather than whichever frame happened to be first.
 */
function buildPalette(frames, width, height) {
  const pixelCount = width * height;
  // Cap the sample so a 4K frame does not make palette building the slow part.
  const target = 40_000;
  const stride = Math.max(1, Math.floor((pixelCount * frames.length) / target));

  const samples = [];
  let cursor = 0;
  for (const frame of frames) {
    const data = frame.data;
    for (let p = 0; p < pixelCount; p += 1, cursor += 1) {
      if (cursor % stride) continue;
      const i = p * 4;
      if (data[i + 3] < 8) continue; // ignore fully transparent pixels
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (!samples.length) return [[0, 0, 0], [255, 255, 255]];

  let boxes = [makeBox(samples)];
  while (boxes.length < MAX_COLORS) {
    // Always split the box with the widest spread — that is where the visible
    // banding would otherwise land.
    let idx = -1;
    let best = 0;
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      if (box.pixels.length < 2) continue;
      if (box.spread > best) { best = box.spread; idx = i; }
    }
    if (idx < 0) break;
    const [a, b] = splitBox(boxes[idx]);
    boxes.splice(idx, 1, a, b);
  }

  return boxes.map((box) => box.average());
}

function makeBox(pixels) {
  let rMin = 255, gMin = 255, bMin = 255, rMax = 0, gMax = 0, bMax = 0;
  for (const [r, g, b] of pixels) {
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
    if (g < gMin) gMin = g; if (g > gMax) gMax = g;
    if (b < bMin) bMin = b; if (b > bMax) bMax = b;
  }
  const ranges = [rMax - rMin, gMax - gMin, bMax - bMin];
  // Weighted for perceived brightness: green errors show up most.
  const spread = Math.max(ranges[0] * 0.30, ranges[1] * 0.59, ranges[2] * 0.11) * pixels.length ** 0.25;
  return {
    pixels,
    ranges,
    spread,
    channel: ranges.indexOf(Math.max(...ranges)),
    average() {
      let r = 0, g = 0, b = 0;
      for (const px of pixels) { r += px[0]; g += px[1]; b += px[2]; }
      const n = pixels.length;
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    },
  };
}

function splitBox(box) {
  const c = box.channel;
  const sorted = box.pixels.slice().sort((x, y) => x[c] - y[c]);
  const mid = sorted.length >> 1;
  return [makeBox(sorted.slice(0, mid)), makeBox(sorted.slice(mid))];
}

/** Nearest-palette-entry lookup, memoised on a 5-bit-per-channel grid. */
class NearestColor {
  constructor(palette) {
    this.palette = palette;
    this.cache = new Int16Array(32768).fill(-1);
  }

  of(r, g, b) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = this.cache[key];
    if (hit >= 0) return hit;

    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.palette.length; i += 1) {
      const p = this.palette[i];
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      const dist = dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11;
      if (dist < bestDist) { bestDist = dist; best = i; if (dist === 0) break; }
    }
    this.cache[key] = best;
    return best;
  }
}

function quantizeFlat(data, lookup) {
  const n = data.length / 4;
  const out = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) {
    const i = p * 4;
    out[p] = lookup.of(data[i], data[i + 1], data[i + 2]);
  }
  return out;
}

/**
 * Floyd–Steinberg. Gradients in a generated photo turn into visible bands at
 * 256 colours without it, and the animation makes those bands crawl.
 */
function quantizeDithered(data, width, height, lookup) {
  const out = new Uint8Array(width * height);
  // Work in a float buffer so accumulated error is not repeatedly re-clamped.
  const buf = new Float32Array(width * height * 3);
  for (let p = 0; p < width * height; p += 1) {
    buf[p * 3] = data[p * 4];
    buf[p * 3 + 1] = data[p * 4 + 1];
    buf[p * 3 + 2] = data[p * 4 + 2];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const o = p * 3;
      const r = clamp255(buf[o]), g = clamp255(buf[o + 1]), b = clamp255(buf[o + 2]);
      const idx = lookup.of(r, g, b);
      out[p] = idx;
      const [pr, pg, pb] = lookup.palette[idx];
      const er = r - pr, eg = g - pg, eb = b - pb;

      spread(buf, width, height, x + 1, y, er, eg, eb, 7 / 16);
      spread(buf, width, height, x - 1, y + 1, er, eg, eb, 3 / 16);
      spread(buf, width, height, x, y + 1, er, eg, eb, 5 / 16);
      spread(buf, width, height, x + 1, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return out;
}

function spread(buf, width, height, x, y, er, eg, eb, factor) {
  if (x < 0 || x >= width || y >= height) return;
  const o = (y * width + x) * 3;
  buf[o] += er * factor;
  buf[o + 1] += eg * factor;
  buf[o + 2] += eb * factor;
}

const clamp255 = (n) => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

// ---------------------------------------------------------------------------
// File structure
// ---------------------------------------------------------------------------

function writeHeader(out, width, height, paletteBits) {
  out.string('GIF89a');
  out.short(width);
  out.short(height);
  out.byte(0x80 | ((paletteBits - 1) & 0x07)); // global colour table, size
  out.byte(0);    // background colour index
  out.byte(0);    // pixel aspect ratio
}

function writePalette(out, palette, paletteSize) {
  for (let i = 0; i < paletteSize; i += 1) {
    const [r, g, b] = palette[i] || [0, 0, 0];
    out.byte(r); out.byte(g); out.byte(b);
  }
}

function writeNetscapeLoop(out, loop) {
  out.byte(0x21); out.byte(0xff); out.byte(11);
  out.string('NETSCAPE2.0');
  out.byte(3); out.byte(1);
  out.short(loop & 0xffff); // 0 = forever
  out.byte(0);
}

function writeGraphicControl(out, centiseconds) {
  out.byte(0x21); out.byte(0xf9); out.byte(4);
  out.byte(0x04);  // disposal: restore to background, no transparency
  out.short(centiseconds);
  out.byte(0);     // transparent colour index (unused)
  out.byte(0);
}

function writeImageDescriptor(out, width, height) {
  out.byte(0x2c);
  out.short(0); out.short(0);
  out.short(width); out.short(height);
  out.byte(0); // no local colour table, not interlaced
}

function writeImageData(out, indices, paletteBits) {
  const minCodeSize = Math.max(2, paletteBits);
  out.byte(minCodeSize);
  const bytes = lzwEncode(indices, minCodeSize);
  // Image data is carried in sub-blocks of at most 255 bytes.
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.subarray(i, Math.min(i + 255, bytes.length));
    out.byte(chunk.length);
    out.bytes(chunk);
  }
  out.byte(0); // block terminator
}

/**
 * GIF's variable-width LZW. Codes start one bit wider than the palette, grow as
 * the dictionary fills, and the dictionary is reset with a clear code once it
 * reaches 4096 entries.
 */
export function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  const out = new ByteStream();
  const bits = new BitWriter(out);

  let codeSize = minCodeSize + 1;
  let dict = new Map();
  let nextCode = eoiCode + 1;

  bits.write(clearCode, codeSize);

  if (indices.length === 0) {
    bits.write(eoiCode, codeSize);
    bits.flush();
    return out.toUint8Array();
  }

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i += 1) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }

    bits.write(prefix, codeSize);
    dict.set(key, nextCode);
    nextCode += 1;

    if (nextCode > 4095) {
      bits.write(clearCode, codeSize);
      dict = new Map();
      nextCode = eoiCode + 1;
      codeSize = minCodeSize + 1;
    } else if (nextCode > (1 << codeSize)) {
      codeSize += 1;
    }
    prefix = k;
  }

  bits.write(prefix, codeSize);
  bits.write(eoiCode, codeSize);
  bits.flush();
  return out.toUint8Array();
}

class ByteStream {
  constructor() {
    this.buf = new Uint8Array(1024);
    this.len = 0;
  }

  #grow(extra) {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  byte(b) { this.#grow(1); this.buf[this.len++] = b & 0xff; }
  short(n) { this.byte(n & 0xff); this.byte((n >> 8) & 0xff); }
  string(s) { for (let i = 0; i < s.length; i += 1) this.byte(s.charCodeAt(i)); }
  bytes(arr) { this.#grow(arr.length); this.buf.set(arr, this.len); this.len += arr.length; }
  toUint8Array() { return this.buf.slice(0, this.len); }
}

/** GIF packs codes least-significant-bit first across byte boundaries. */
class BitWriter {
  constructor(stream) {
    this.stream = stream;
    this.acc = 0;
    this.bits = 0;
  }

  write(code, size) {
    this.acc |= (code << this.bits);
    this.bits += size;
    while (this.bits >= 8) {
      this.stream.byte(this.acc & 0xff);
      this.acc >>>= 8;
      this.bits -= 8;
    }
  }

  flush() {
    if (this.bits > 0) {
      this.stream.byte(this.acc & 0xff);
      this.acc = 0;
      this.bits = 0;
    }
  }
}
