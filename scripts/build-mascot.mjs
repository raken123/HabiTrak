// Cut Hazel the Squirrel out of her character sheet.
//
// The sheet is one picture with two dozen poses on it, and the poses touch —
// a tail here overlaps an ear there — so they cannot simply be found by
// looking for islands of opaque pixels. They are named and roughly boxed
// below instead, by eye, once.
//
// What is *not* done by eye is the edge of each pose. A rough box is read,
// the islands inside it are labelled, the biggest one is taken to be the pose,
// anything close enough to it is taken to belong to it — a question mark over
// a head, the sparkles beside one, the little sign she is holding — and the
// box is then tightened onto exactly that. So a box only has to be roughly
// right, and the sprite that comes out is trimmed to the drawing.
//
//   node scripts/build-mascot.mjs [sheet.webp]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = process.env.AD_FFMPEG || 'ffmpeg';
const FFPROBE = process.env.AD_FFPROBE || 'ffprobe';

const SHEET = process.argv[2] || path.join(ROOT, 'site', 'mascot', 'hazel-sheet.webp');
const OUT = path.join(ROOT, 'site', 'mascot');

/**
 * The poses worth having, and roughly where they are on the sheet.
 *
 * `pad` is breathing room left around the tightened box — used where a pose
 * has a wisp the labeller drops, like the speed lines behind her when she runs.
 */
const POSES = [
  { name: 'hazel',        box: [20, 70, 450, 700], about: 'holding an acorn — the portrait' },
  { name: 'hazel-cheer',  box: [874, 20, 210, 268], about: 'both arms up' },
  { name: 'hazel-think',  box: [496, 286, 176, 250], about: 'a question mark over her head' },
  { name: 'hazel-sleep',  box: [466, 545, 205, 224], about: 'asleep, with the z’s' },
  { name: 'hazel-idea',   box: [1092, 545, 200, 224], about: 'a lightbulb and a raised finger' },
  { name: 'hazel-oops',   box: [1350, 545, 176, 224], about: 'holding a sign reading Oops!' },
  { name: 'hazel-camera', box: [1074, 772, 196, 232], about: 'behind a camera' },
  { name: 'hazel-laptop', box: [578, 772, 250, 232], about: 'at a laptop' },
];

/** Islands this close to the main one are part of the same pose. */
const REACH = 46;
/** Alpha at or below this is background — the sheet has a wide faint skirt. */
const CUTOFF = 140;
const MIN_PIXELS = 120;

const [W, H] = execFileSync(FFPROBE, [
  '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', SHEET,
]).toString().trim().split(',').map(Number);

fs.mkdirSync(OUT, { recursive: true });
const raw = path.join(OUT, '.sheet.raw');
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', SHEET, '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
const px = fs.readFileSync(raw);

const solidAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && px[(y * W + x) * 4 + 3] > CUTOFF);

/** Label the islands inside one rough box, in sheet coordinates. */
function islands([bx, by, bw, bh]) {
  const seen = new Set();
  const found = [];
  const stack = [];
  for (let y = by; y < by + bh; y += 1) {
    for (let x = bx; x < bx + bw; x += 1) {
      const key = y * W + x;
      if (!solidAt(x, y) || seen.has(key)) continue;
      stack.length = 0;
      stack.push(key);
      seen.add(key);
      let x0 = x; let y0 = y; let x1 = x; let y1 = y; let count = 0;
      while (stack.length) {
        const i = stack.pop();
        const cx = i % W;
        const cy = (i - cx) / W;
        count += 1;
        if (cx < x0) x0 = cx;
        if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy;
        if (cy > y1) y1 = cy;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = cx + dx; const ny = cy + dy;
            if (nx < bx || ny < by || nx >= bx + bw || ny >= by + bh) continue;
            const j = ny * W + nx;
            if (!seen.has(j) && solidAt(nx, ny)) { seen.add(j); stack.push(j); }
          }
        }
      }
      if (count >= MIN_PIXELS) found.push({ x0, y0, x1, y1, count });
    }
  }
  return found;
}

const touching = (a, b) =>
  a.x0 - REACH <= b.x1 && b.x0 - REACH <= a.x1 && a.y0 - REACH <= b.y1 && b.y0 - REACH <= a.y1;

const manifest = [];
for (const pose of POSES) {
  const all = islands(pose.box);
  if (!all.length) throw new Error(`${pose.name}: nothing found in ${pose.box.join(',')}`);
  all.sort((a, b) => b.count - a.count);

  // The poses on the sheet sit shoulder to shoulder, so a box drawn around one
  // of them clips the next. Those clippings are told apart from Hazel's own
  // props by where they are cut: a neighbour is severed by the side of the box,
  // while her question mark and her little sign sit inside it. So anything but
  // the main island that runs into a side wall is somebody else's arm.
  const [bx, , bw] = pose.box;
  const clipped = (part) => part.x0 <= bx || part.x1 >= bx + bw - 1;
  const parts = [all[0], ...all.slice(1).filter((part) => !clipped(part))];

  const kept = [parts[0]];
  let grew = true;
  while (grew) {
    grew = false;
    for (const part of parts) {
      if (kept.includes(part)) continue;
      if (kept.some((k) => touching(k, part))) { kept.push(part); grew = true; }
    }
  }

  const pad = pose.pad || 0;
  const x0 = Math.max(0, Math.min(...kept.map((k) => k.x0)) - pad);
  const y0 = Math.max(0, Math.min(...kept.map((k) => k.y0)) - pad);
  const x1 = Math.min(W - 1, Math.max(...kept.map((k) => k.x1)) + pad);
  const y1 = Math.min(H - 1, Math.max(...kept.map((k) => k.y1)) + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  const file = `${pose.name}.png`;
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', raw,
    '-vf', `crop=${w}:${h}:${x0}:${y0}`,
    '-frames:v', '1', path.join(OUT, file),
  ]);
  manifest.push({ name: pose.name, file, about: pose.about, x: x0, y: y0, w, h, parts: kept.length });
}

fs.rmSync(raw);

/* ── the three places she has to fit ─────────────────────────────────────── */
//
// The masters above are full size and lossless, and much too heavy to put in
// front of anybody: a megabyte of squirrel on a download page is a worse page.
// So each surface gets her at the size it actually draws her, as WebP, which
// keeps the alpha and costs a fifth of the PNG.
//
// The three differ in how they are *carried*, not just in size. The page
// inlines its copies at build time; the desktop app is served its own
// directory over the hazelnut:// scheme; and Mini's Android build ships
// exactly two files, so hers has to arrive as a data URI inside the bundle.

const derive = (file, dir, height) => {
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, file.replace(/\.png$/, '.webp'));
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error', '-i', path.join(OUT, file),
    '-vf', `scale=-1:${height}:flags=lanczos`,
    '-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-q:v', '86', '-compression_level', '6',
    '-frames:v', '1', out,
  ]);
  return out;
};

const WEB = path.join(OUT, 'web');
const APP = path.join(ROOT, 'apps', 'hazelnut', 'renderer', 'img');
fs.rmSync(WEB, { recursive: true, force: true });

let webBytes = 0;
let appBytes = 0;
for (const m of manifest) {
  webBytes += fs.statSync(derive(m.file, WEB, Math.min(440, m.h))).size;
  appBytes += fs.statSync(derive(m.file, APP, Math.min(280, m.h))).size;
}

// Mini carries only the poses it draws, because every byte here is a byte in
// the APK and the bundle.
const MINI_POSES = ['hazel-camera'];
const miniDir = path.join(ROOT, '.build', 'hazel-mini');
fs.rmSync(miniDir, { recursive: true, force: true });
const inlined = MINI_POSES.map((name) => {
  const pose = manifest.find((m) => m.name === name);
  if (!pose) throw new Error(`Mini wants ${name}, which is not a pose`);
  const file = derive(pose.file, miniDir, Math.min(200, pose.h));
  const b64 = fs.readFileSync(file).toString('base64');
  return `  ${JSON.stringify(name)}: 'data:image/webp;base64,${b64}',`;
});
const miniModule = `// GENERATED — do not edit. Rebuild with \`npm run mascot\`.
//
// Hazel, inlined. Mini's Android build ships two files and no image directory,
// so she travels as a data URI rather than as an asset beside the page.

export const HAZEL = {
${inlined.join('\n')}
};
`;
fs.writeFileSync(path.join(ROOT, 'apps', 'hazelnut-mini', 'www', 'js', 'hazel.js'), miniModule);

fs.writeFileSync(path.join(OUT, 'poses.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Hazel: ${manifest.length} poses cut from ${path.basename(SHEET)}`);
for (const m of manifest) {
  console.log(`  ${m.file.padEnd(20)} ${String(m.w).padStart(4)}x${String(m.h).padStart(4)}  ${m.parts} piece${m.parts === 1 ? '' : 's'}  — ${m.about}`);
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`  web copies ${kb(webBytes)} · app copies ${kb(appBytes)} · Mini carries ${MINI_POSES.length} inline`);
