// Generate the app icons.
//
// electron-builder needs a real 512×512 PNG per app. Rather than commit a
// binary nobody can diff, the icons are drawn here from a few shapes and
// written out by a minimal PNG writer, so a tweak to the mark is a code change
// like any other. Run: `node scripts/make-icons.mjs`

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIZE = 512;                   // the design space every shape is drawn in
const SS = 3;                       // supersampling factor, for clean edges

const PALETTE = {
  ground: [30, 24, 18],
  groundEdge: [22, 18, 14],
  shell: [201, 138, 75],
  shellLight: [230, 170, 104],
  cap: [122, 79, 48],
  capDark: [96, 60, 36],
  stem: [86, 56, 34],
  accent: [224, 137, 74],
};

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Signed helpers, all in the 0..512 design space. */
const inRoundedRect = (x, y, r) =>
  x >= 0 && y >= 0 && x <= SIZE && y <= SIZE
  && (() => {
    const cx = Math.min(Math.max(x, r), SIZE - r);
    const cy = Math.min(Math.max(y, r), SIZE - r);
    return Math.hypot(x - cx, y - cy) <= r;
  })();

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

const inTriangle = (x, y, a, b, c) => {
  const side = (p, q) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const s1 = side(a, b);
  const s2 = side(b, c);
  const s3 = side(c, a);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
};

/**
 * The hazelnut: a rounded shell, a scalloped cap sitting on top of it, and a
 * short stem. Returns an RGB colour or null for "not part of the mark".
 */
function nut(x, y, { scale = 1, dx = 0, dy = 0 } = {}) {
  const px = (x - 256) / scale + 256 - dx;
  const py = (y - 256) / scale + 256 - dy;

  const shellCx = 256;
  const shellCy = 316;
  const shellRx = 142;
  const shellRy = 152;

  // Cap: a wider ellipse, cut off with a wavy lower edge so it reads as a husk.
  const capCy = 206;
  const wave = 10 * Math.sin((px - 256) / 24);
  const inCap = inEllipse(px, py, shellCx, capCy, 162, 124) && py < 226 + wave;

  if (inCap) {
    const shade = (py - 90) / 170;
    return mix(PALETTE.cap, PALETTE.capDark, Math.min(1, Math.max(0, shade)));
  }

  // Stem.
  if (inEllipse(px, py, 256, 84, 17, 44) && py > 46) return PALETTE.stem;

  if (inEllipse(px, py, shellCx, shellCy, shellRx, shellRy)) {
    // Light falls from the upper left.
    const lit = 1 - Math.min(1, Math.hypot(px - 200, py - 250) / 290);
    return mix(PALETTE.shell, PALETTE.shellLight, lit * 0.85);
  }
  return null;
}

function render({ bubble = false, strip = false, size = SIZE } = {}) {
  const pixels = new Uint8Array(size * size * 4);
  const toDesign = SIZE / size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = (x + (sx + 0.5) / SS) * toDesign;
          const py = (y + (sy + 0.5) / SS) * toDesign;

          let colour = null;
          let alpha = 0;

          if (inRoundedRect(px, py, 108)) {
            // A soft vignette keeps the tile from looking flat at small sizes.
            const d = Math.hypot(px - 256, py - 240) / 380;
            colour = mix(PALETTE.ground, PALETTE.groundEdge, Math.min(1, d));
            alpha = 1;
          }

          if (strip && alpha) {
            // Squirreal's mark is the same nut, held in a strip of film: a dark
            // band down each side, punched with sprocket holes.
            const band = px < 96 || px > 416;
            if (band) { colour = [46, 36, 27]; alpha = 1; }
            const hx = px < 256 ? px - 28 : px - 424;   // 0..68 inside the band
            const hy = (py - 26) % 82;
            if (band && py > 26 && py < 486 && hx > 0 && hx < 40 && hy > 6 && hy < 52) {
              colour = [16, 13, 10];
              alpha = 1;
            }
          }

          if (bubble) {
            // Mini's mark is the same nut, inside a chat bubble.
            const inBubble = inEllipse(px, py, 256, 232, 198, 168)
              || inTriangle(px, py, [206, 358], [268, 372], [150, 452]);
            if (inBubble) { colour = [54, 43, 33]; alpha = 1; }
          }

          const mark = bubble ? nut(px, py, { scale: 0.68, dy: -14 })
            : strip ? nut(px, py, { scale: 0.74, dy: -6 })
            : nut(px, py);
          if (mark) { colour = mark; alpha = 1; }

          if (alpha) { r += colour[0]; g += colour[1]; b += colour[2]; a += 255; }
        }
      }

      const samples = SS * SS;
      const i = (y * size + x) * 4;
      const cover = a / (samples * 255);
      pixels[i] = cover ? Math.round(r / (samples * cover)) : 0;
      pixels[i + 1] = cover ? Math.round(g / (samples * cover)) : 0;
      pixels[i + 2] = cover ? Math.round(b / (samples * cover)) : 0;
      pixels[i + 3] = Math.round(cover * 255);
    }
  }
  return pixels;
}

// ── a minimal PNG writer ───────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(pixels, size) {
  // One filter byte (0 = None) in front of every scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // colour type: RGBA
  ihdr[10] = 0;   // deflate
  ihdr[11] = 0;   // adaptive filtering
  ihdr[12] = 0;   // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A .icns is a magic word, a total length, then typed chunks. Every type used
 * here takes a PNG payload directly, so the file is just our own PNGs with
 * four-byte labels — no Apple tooling needed to assemble one.
 */
function encodeIcns(entries) {
  const chunks = entries.map(({ type, png }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

// type -> pixel size, covering the Finder's whole ladder from 16pt to 512@2x.
const ICNS_SIZES = [
  ['ic11', 32], ['ic12', 64], ['ic07', 128],
  ['ic13', 256], ['ic08', 256], ['ic14', 512], ['ic09', 512], ['ic10', 1024],
];

const targets = [
  { file: path.join(HERE, '..', 'apps', 'hazelnut', 'build', 'icon.png'), bubble: false },
  { file: path.join(HERE, '..', 'apps', 'hazelnut-mini', 'build', 'icon.png'), bubble: true },
  { file: path.join(HERE, '..', 'apps', 'hazelnut-squirreal', 'build', 'icon.png'), strip: true },
];

const rel = (f) => path.relative(path.join(HERE, '..'), f);

for (const target of targets) {
  fs.mkdirSync(path.dirname(target.file), { recursive: true });

  const png = encodePng(render({ bubble: target.bubble, strip: target.strip }), SIZE);
  fs.writeFileSync(target.file, png);
  console.log(`wrote ${rel(target.file)} (${(png.length / 1024).toFixed(0)} KB)`);

  // macOS wants an .icns; render each size from the shapes rather than
  // resampling one bitmap, so the small ones stay crisp.
  const cache = new Map();
  const entries = ICNS_SIZES.map(([type, size]) => {
    if (!cache.has(size)) cache.set(size, encodePng(render({ bubble: target.bubble, strip: target.strip, size }), size));
    return { type, png: cache.get(size) };
  });
  const icns = encodeIcns(entries);
  const icnsFile = target.file.replace(/\.png$/, '.icns');
  fs.writeFileSync(icnsFile, icns);
  console.log(`wrote ${rel(icnsFile)} (${(icns.length / 1024).toFixed(0)} KB)`);
}
