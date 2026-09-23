// Cut a character sheet into individual sprites.
//
// The mascot arrives as one big sheet with every pose on it. Rather than read
// coordinates off the picture by eye — which is tedious and goes wrong the
// moment the sheet is redrawn — this finds the poses: it walks the alpha
// channel, labels each island of opaque pixels, merges islands that are close
// enough to belong together (a question mark over a head, the sparkles beside
// one), and writes out what it found.
//
//   node scripts/cut-sprites.mjs <sheet.webp> <outDir> [gap]
//
// ffmpeg does the decoding and the encoding; the labelling is here because
// neither ffmpeg nor this machine's Python can do connected components.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const FFMPEG = process.env.AD_FFMPEG || 'ffmpeg';
const FFPROBE = process.env.AD_FFPROBE || 'ffprobe';

const [sheet, outDir, gapArg] = process.argv.slice(2);
if (!sheet || !outDir) throw new Error('usage: cut-sprites.mjs <sheet> <outDir> [gap]');

/** How far apart two islands may be and still be one pose. */
const GAP = Number(gapArg || 22);
/** Islands smaller than this are dust, not drawings. */
const MIN_PIXELS = 400;
/**
 * Alpha at or below this is background.
 *
 * Not as low as it looks like it should be. The sheet carries a wide skirt of
 * very faint pixels — a tenth of the image sits between 1 and 127 — and at a
 * low cutoff those threads join every pose on it into one island. The cutoff
 * is what separates the drawings from the haze around them.
 */
const CUTOFF = Number(process.env.SPRITE_CUTOFF || 140);

const probe = execFileSync(FFPROBE, [
  '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', sheet,
]).toString().trim().split(',').map(Number);
const [W, H] = probe;

fs.mkdirSync(outDir, { recursive: true });
const rawPath = path.join(outDir, '.sheet.raw');
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', sheet, '-f', 'rawvideo', '-pix_fmt', 'rgba', rawPath]);
const px = fs.readFileSync(rawPath);

/* ── label the islands ───────────────────────────────────────────────────── */

const solid = new Uint8Array(W * H);
for (let i = 0; i < W * H; i += 1) solid[i] = px[i * 4 + 3] > CUTOFF ? 1 : 0;

const seen = new Uint8Array(W * H);
const boxes = [];
const stack = new Int32Array(W * H);

for (let start = 0; start < W * H; start += 1) {
  if (!solid[start] || seen[start]) continue;
  let top = 0;
  stack[top] = start; top += 1;
  seen[start] = 1;
  let x0 = W; let y0 = H; let x1 = 0; let y1 = 0; let count = 0;

  while (top > 0) {
    top -= 1;
    const i = stack[top];
    const x = i % W;
    const y = (i - x) / W;
    count += 1;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (solid[j] && !seen[j]) { seen[j] = 1; stack[top] = j; top += 1; }
      }
    }
  }
  if (count >= MIN_PIXELS) boxes.push({ x0, y0, x1, y1, count });
}

/* ── merge what belongs together ─────────────────────────────────────────── */

const near = (a, b) =>
  a.x0 - GAP <= b.x1 && b.x0 - GAP <= a.x1 && a.y0 - GAP <= b.y1 && b.y0 - GAP <= a.y1;

let merged = true;
while (merged) {
  merged = false;
  outer:
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (!near(boxes[i], boxes[j])) continue;
      boxes[i] = {
        x0: Math.min(boxes[i].x0, boxes[j].x0),
        y0: Math.min(boxes[i].y0, boxes[j].y0),
        x1: Math.max(boxes[i].x1, boxes[j].x1),
        y1: Math.max(boxes[i].y1, boxes[j].y1),
        count: boxes[i].count + boxes[j].count,
      };
      boxes.splice(j, 1);
      merged = true;
      break outer;
    }
  }
}

// Reading order: down the rows, then across. Rows are found by overlap rather
// than by a fixed height, because the sheet's rows are not evenly spaced.
boxes.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
const rows = [];
for (const box of boxes) {
  const row = rows.find((r) => box.y0 < r.bottom - (box.y1 - box.y0) * 0.4);
  if (row) { row.items.push(box); row.bottom = Math.max(row.bottom, box.y1); }
  else rows.push({ bottom: box.y1, items: [box] });
}
const ordered = rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));

/* ── write them out ──────────────────────────────────────────────────────── */

const manifest = [];
ordered.forEach((box, n) => {
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const name = `sprite-${String(n + 1).padStart(2, '0')}.png`;
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', rawPath,
    '-vf', `crop=${w}:${h}:${box.x0}:${box.y0}`,
    '-frames:v', '1', path.join(outDir, name),
  ]);
  manifest.push({ name, x: box.x0, y: box.y0, w, h, pixels: box.count });
});

fs.writeFileSync(path.join(outDir, 'sprites.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.rmSync(rawPath);
console.log(`cut ${manifest.length} sprites from ${path.basename(sheet)} (${W}x${H}) into ${outDir}`);
for (const s of manifest) console.log(`  ${s.name}  ${String(s.w).padStart(4)}x${String(s.h).padStart(4)}  at ${s.x},${s.y}`);
