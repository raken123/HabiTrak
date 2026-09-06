// The photograph the Short is about, and the two things done to it.
//
// A sofa dumped on a pavement in front of railings is the case Realtouch is
// built for: what is behind it is not texture, it is structure — bars at a
// fixed spacing, mortar courses, the line of a kerb. A fill that only looks at
// neighbouring pixels cannot know any of that, and the naive fill below is a
// real implementation of exactly that kind of fill, not a caricature.

const BRICK = '#8d5a4a';
const MORTAR = '#c9b7a6';

export const SOFA_RECT = { x: 0.470, y: 0.632, w: 0.370, h: 0.203 };

/** The region the sofa occupies, in pixels, for a given canvas size. */
export const sofaRegion = (w, h) => ({
  x: Math.round(SOFA_RECT.x * w),
  y: Math.round(SOFA_RECT.y * h),
  w: Math.round(SOFA_RECT.w * w),
  h: Math.round(SOFA_RECT.h * h),
});

export function streetScene({ width = 1200, height = 1500, sofa = true } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const S = width / 1200;                 // everything below is drawn at 1200 wide

  const skyBottom = 380 * S;
  const facadeBottom = 1010 * S;
  const railTop = 1000 * S;
  const railBottom = 1140 * S;
  const kerbY = 1330 * S;
  const roadTop = 1362 * S;

  // ── sky ──
  const sky = g.createLinearGradient(0, 0, 0, skyBottom);
  sky.addColorStop(0, '#8fa9c4');
  sky.addColorStop(1, '#d3dae0');
  g.fillStyle = sky; g.fillRect(0, 0, width, skyBottom);

  // ── brick facade ──
  g.fillStyle = MORTAR; g.fillRect(0, skyBottom, width, facadeBottom - skyBottom);
  const bh = 26 * S, bw = 74 * S, joint = 3 * S;
  for (let row = 0, y = skyBottom; y < facadeBottom; y += bh, row += 1) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < width + bw; x += bw) {
      // Vary each brick slightly, or the wall reads as wallpaper.
      const n = Math.sin((x * 0.7 + row * 31.7)) * 0.5 + 0.5;
      g.fillStyle = shade(BRICK, 0.82 + n * 0.34);
      g.fillRect(x + offset, y, bw - joint, bh - joint);
    }
  }
  // A string course, so the wall has a horizontal the fill has to get right.
  g.fillStyle = '#b9a894';
  g.fillRect(0, 690 * S, width, 22 * S);
  g.fillStyle = 'rgba(0,0,0,.12)';
  g.fillRect(0, 712 * S, width, 5 * S);

  // ── windows ──
  const window_ = (x, y, w, h) => {
    g.fillStyle = '#e8e2d8'; g.fillRect(x - 9 * S, y - 9 * S, w + 18 * S, h + 18 * S);
    const glass = g.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, '#41525f'); glass.addColorStop(0.45, '#6d818f'); glass.addColorStop(1, '#2b3843');
    g.fillStyle = glass; g.fillRect(x, y, w, h);
    g.strokeStyle = '#efe9df'; g.lineWidth = 6 * S;
    g.beginPath();
    g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h);
    g.moveTo(x, y + h * 0.46); g.lineTo(x + w, y + h * 0.46);
    g.stroke();
    g.fillStyle = '#d8d0c4'; g.fillRect(x - 14 * S, y + h + 9 * S, w + 28 * S, 12 * S);
  };
  for (const x of [110, 430, 750, 1010]) window_(x * S, 430 * S, 150 * S, 200 * S);
  for (const x of [110, 430, 750, 1010]) window_(x * S, 760 * S, 150 * S, 190 * S);

  // ── railings: the structure a naive fill cannot invent ──
  g.fillStyle = '#2c2f33';
  g.fillRect(0, railTop, width, 10 * S);                       // top rail
  g.fillRect(0, railBottom - 16 * S, width, 12 * S);           // bottom rail
  const spacing = 34 * S;
  for (let x = 12 * S; x < width; x += spacing) {
    g.fillRect(x, railTop, 7 * S, railBottom - railTop);
    g.beginPath();                                             // finial
    g.arc(x + 3.5 * S, railTop - 6 * S, 7 * S, 0, Math.PI * 2);
    g.fill();
  }

  // ── pavement ──
  const pave = g.createLinearGradient(0, railBottom, 0, kerbY);
  pave.addColorStop(0, '#9b9691'); pave.addColorStop(1, '#b3aea8');
  g.fillStyle = pave; g.fillRect(0, railBottom, width, kerbY - railBottom);
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 2 * S;
  for (let y = railBottom + 62 * S; y < kerbY; y += 62 * S) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.stroke();
  }
  for (let i = -2; i < 12; i += 1) {
    const x = i * 140 * S + 40 * S;
    g.beginPath(); g.moveTo(x, railBottom); g.lineTo(x + 26 * S, kerbY); g.stroke();
  }

  // ── kerb and road ──
  g.fillStyle = '#c6c2bc'; g.fillRect(0, kerbY, width, roadTop - kerbY);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, roadTop - 5 * S, width, 5 * S);
  g.fillStyle = '#4b4b4d'; g.fillRect(0, roadTop, width, height - roadTop);
  g.strokeStyle = '#d8b74a'; g.lineWidth = 6 * S;                // double yellows
  for (const dy of [22, 40]) {
    g.beginPath(); g.moveTo(0, roadTop + dy * S); g.lineTo(width, roadTop + dy * S); g.stroke();
  }

  // ── lamp post ──
  g.fillStyle = '#33373b';
  g.fillRect(196 * S, 300 * S, 15 * S, (kerbY - 6 * S) - 300 * S);
  g.fillRect(160 * S, kerbY - 14 * S, 88 * S, 14 * S);

  if (sofa) drawSofa(g, S, width, height);

  // A little grain, so the picture does not read as a diagram.
  const grain = g.getImageData(0, 0, width, height);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 13;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  g.putImageData(grain, 0, 0);

  return c;
}

function drawSofa(g, S, width, height) {
  const r = sofaRegion(width, height);
  const { x, y, w, h } = r;

  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath();
  g.ellipse(x + w / 2, y + h - 6 * S, w * 0.52, 16 * S, 0, 0, Math.PI * 2);
  g.fill();

  const body = g.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, '#7d8a5e');
  body.addColorStop(1, '#5c6644');
  g.fillStyle = body;

  const back = { x, y, w, h: h * 0.58 };
  round(g, back.x, back.y, back.w, back.h, 14 * S); g.fill();
  round(g, x, y + h * 0.46, w, h * 0.42, 12 * S); g.fill();

  // Arms.
  g.fillStyle = '#6c774f';
  round(g, x - 4 * S, y + h * 0.30, w * 0.13, h * 0.60, 12 * S); g.fill();
  round(g, x + w - w * 0.13 + 4 * S, y + h * 0.30, w * 0.13, h * 0.60, 12 * S); g.fill();

  // Cushions.
  g.fillStyle = '#87956a';
  for (let i = 0; i < 3; i += 1) {
    const cw = w * 0.24;
    round(g, x + w * 0.14 + i * (cw + w * 0.02), y + h * 0.50, cw, h * 0.30, 9 * S);
    g.fill();
  }
  // Tired floral speckle.
  for (let i = 0; i < 160; i += 1) {
    g.fillStyle = `rgba(${190 + Math.random() * 50 | 0},${170 + Math.random() * 60 | 0},${120 + Math.random() * 60 | 0},.28)`;
    g.beginPath();
    g.arc(x + Math.random() * w, y + h * 0.1 + Math.random() * h * 0.8, (1.5 + Math.random() * 3.5) * S, 0, Math.PI * 2);
    g.fill();
  }
  // Feet.
  g.fillStyle = '#3b2f24';
  g.fillRect(x + w * 0.10, y + h - 10 * S, 14 * S, 12 * S);
  g.fillRect(x + w * 0.84, y + h - 10 * S, 14 * S, 12 * S);
}

/**
 * A patch fill that only knows about neighbouring pixels: it tiles the hole
 * with copies of the strip beside it, then softens the seams. This is what
 * cloning by hand actually does when the thing behind the object has structure
 * — the railings come back at the wrong spacing and the courses stop lining up.
 */
export function naiveFill(source, region, { pad = 0.03 } = {}) {
  const c = document.createElement('canvas');
  c.width = source.width; c.height = source.height;
  const g = c.getContext('2d');
  g.drawImage(source, 0, 0);

  // A hand-drawn mask is never tight, so take a little more than the object.
  const grow = Math.round(region.w * pad);
  const x = region.x - grow;
  const y = region.y - grow;
  const w = region.w + grow * 2;
  const h = region.h + grow * 2;

  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();

  // Pass one: drag the band beside the hole across it. The stride is close to
  // the railing spacing but not equal to it, which is precisely why the bars
  // come back at the wrong pitch instead of lining up.
  const band = Math.round(w * 0.26);
  const stride = Math.round(band * 0.87);
  for (let i = 0, dx = x; dx < x + w + band; i += 1, dx += stride) {
    g.globalAlpha = 0.97;
    g.drawImage(c, x - band - 2, y, band, h, dx, y + Math.sin(i * 1.3) * 6, band, h);
  }

  // Pass two: pull the pavement up over the lower half, so the kerb line and
  // the paving joints stop agreeing with the ones either side.
  const below = Math.round(h * 0.42);
  g.globalAlpha = 0.9;
  g.drawImage(c, x, y + h, w, below, x - 6, y + h * 0.55, w, below);

  // Pass three: two soft ghosts, the residue of nudging a clone stamp about.
  g.globalAlpha = 0.34;
  g.drawImage(c, x, y, w, h, x + 11, y - 7, w, h);
  g.globalAlpha = 0.24;
  g.drawImage(c, x, y, w, h, x - 14, y + 5, w, h);

  // And the smear of a soft brush over all of it.
  g.globalAlpha = 0.72;
  g.filter = 'blur(1.6px)';
  g.drawImage(c, x, y, w, h, x, y, w, h);
  g.filter = 'none';
  g.restore();

  return c;
}

function round(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(((n >> 16) & 255) * factor)},${clamp(((n >> 8) & 255) * factor)},${clamp((n & 255) * factor)})`;
}
