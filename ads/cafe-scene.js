// The shot the seventh Short is about: a café front, photographed straight on,
// with its name painted across the fascia.
//
// The lettering is a parameter. That is the whole point of the scene: the film
// draws the photograph with the old name, and later draws the same photograph
// with the new one to stand in for a result this machine cannot generate
// during a recording. short7.js says so where it uses it, and the stand-in is
// deliberately drawn by the same code as the original — it is a placeholder,
// not a claim about what the model returns.

/**
 * Seeded, so two renders of the same photograph differ only where the words
 * are. The film draws the original and its stand-in result from this one
 * function, and anything random — the grain, the wear on the board — has to
 * land in the same place both times or the cut would look like a new photo.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKY_TOP = '#2d4763';
const SKY_LOW = '#c79a6d';

/** Where the painted name sits, as fractions of the frame. */
export const SIGN = { x: 0.10, y: 0.325, w: 0.80, h: 0.098 };

/** The little plate by the door — a second piece of lettering, left alone. */
export const PLATE = { x: 0.665, y: 0.505, w: 0.145, h: 0.052 };

export function cafePhoto({
  width = 1000, height = 1250, sign = 'HAZEL & FIG', hours = 'OPEN 8–4',
  grain = true, seed = 20260920,
} = {}) {
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const S = width / 1000;

  const roof = 210 * S;
  const pave = 1052 * S;
  const kerb = 1148 * S;

  // Sky, and the roofline against it.
  const sky = g.createLinearGradient(0, 0, 0, roof);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_LOW);
  g.fillStyle = sky; g.fillRect(0, 0, width, roof);
  cloud(g, S, 170, 96, 150);
  cloud(g, S, 620, 60, 210);

  brick(g, S, roof, pave, width);

  // Cornice over the fascia.
  g.fillStyle = '#2b211b'; g.fillRect(0, 372 * S, width, 24 * S);
  g.fillStyle = 'rgba(255,225,185,.14)'; g.fillRect(0, 372 * S, width, 5 * S);

  fascia(g, S, width, sign, rnd);
  awning(g, S, width);
  window_(g, S);
  door(g, S, hours);

  // Pavement, kerb, road.
  g.fillStyle = '#867f75'; g.fillRect(0, pave, width, kerb - pave);
  for (let x = 0; x < width; x += 118 * S) {
    g.fillStyle = 'rgba(0,0,0,.14)';
    g.fillRect(x, pave, 2 * S, kerb - pave);
  }
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, pave, width, 7 * S);
  g.fillStyle = '#9a9288'; g.fillRect(0, kerb - 12 * S, width, 12 * S);
  const road = g.createLinearGradient(0, kerb, 0, height);
  road.addColorStop(0, '#3b3b3e'); road.addColorStop(1, '#2c2c2f');
  g.fillStyle = road; g.fillRect(0, kerb, width, height - kerb);

  pot(g, S, 96 * S, pave);
  pot(g, S, 916 * S, pave);
  bike(g, S, 250 * S, pave);

  // Late sun from the left: a soft wash across the front, and the shadow of
  // something off-frame falling over the right-hand brick.
  const sun = g.createLinearGradient(0, 0, width, height * 0.7);
  sun.addColorStop(0, 'rgba(255,206,142,.20)');
  sun.addColorStop(0.55, 'rgba(255,206,142,.04)');
  sun.addColorStop(1, 'rgba(20,16,30,.24)');
  g.fillStyle = sun; g.fillRect(0, roof, width, height - roof);

  g.save();
  g.globalAlpha = 0.16;
  g.fillStyle = '#100c18';
  g.beginPath();
  g.moveTo(width, roof); g.lineTo(width, pave);
  g.lineTo(width - 300 * S, pave); g.lineTo(width - 150 * S, roof);
  g.closePath(); g.fill();
  g.restore();

  if (grain) {
    const px = g.getImageData(0, 0, width, height);
    for (let i = 0; i < px.data.length; i += 4) {
      const n = (rnd() - 0.5) * 9;
      px.data[i] += n; px.data[i + 1] += n; px.data[i + 2] += n;
    }
    g.putImageData(px, 0, 0);
  }
  return c;
}

// ── the parts ──────────────────────────────────────────────────────────────

function cloud(g, S, x, y, w) {
  g.fillStyle = 'rgba(255,229,200,.28)';
  g.beginPath();
  g.ellipse(x * S, y * S, w * S * 0.5, w * S * 0.16, 0, 0, Math.PI * 2);
  g.fill();
}

function brick(g, S, roof, pave, width) {
  g.fillStyle = '#6a4b3e'; g.fillRect(0, roof, width, pave - roof);
  for (let y = roof; y < pave; y += 26 * S) {
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.fillRect(0, y, width, 2.5 * S);
    const off = ((y - roof) / (26 * S)) % 2 ? 0 : 52 * S;
    for (let x = off; x < width; x += 104 * S) g.fillRect(x, y, 2.5 * S, 26 * S);
  }
  // A patch of older, damper brick low on the left.
  g.fillStyle = 'rgba(40,52,44,.16)';
  g.fillRect(0, pave - 150 * S, 220 * S, 150 * S);
}

/**
 * The fascia: a painted board with the name across it. The lettering is fitted
 * to the board rather than drawn at a fixed size, so a longer name tightens
 * instead of running off the end — which is what the tool is asked to do too.
 */
function fascia(g, S, width, text, rnd) {
  const x = SIGN.x * width;
  const y = SIGN.y * (width * 1.25);
  const w = SIGN.w * width;
  const h = SIGN.h * (width * 1.25);

  const board = g.createLinearGradient(0, y, 0, y + h);
  board.addColorStop(0, '#20402f');
  board.addColorStop(1, '#16301f');
  g.fillStyle = board;
  g.fillRect(x - 22 * S, y - 18 * S, w + 44 * S, h + 36 * S);
  g.strokeStyle = 'rgba(214,176,112,.55)';
  g.lineWidth = 3 * S;
  g.strokeRect(x - 14 * S, y - 10 * S, w + 28 * S, h + 20 * S);

  // The paint itself: cream, with the shadow the brush leaves under it.
  const size = fit(g, text, w, 74 * S, S);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${size}px "Bitstream Charter", Charter, Georgia, serif`;
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.fillText(text, x + w / 2 + 3 * S, y + h / 2 + 4 * S);
  g.fillStyle = '#efe0c2';
  g.fillText(text, x + w / 2, y + h / 2);

  // Wear: the board has been up a while.
  g.save();
  g.globalAlpha = 0.14;
  g.fillStyle = '#0a1410';
  for (let i = 0; i < 40; i += 1) {
    const px = x - 20 * S + rnd() * (w + 40 * S);
    const py = y - 16 * S + rnd() * (h + 32 * S);
    g.fillRect(px, py, (2 + rnd() * 9) * S, (1 + rnd() * 3) * S);
  }
  g.restore();

  // Two small spotlights on brackets, aimed down at the board.
  for (const bx of [x + w * 0.18, x + w * 0.82]) {
    g.fillStyle = '#2a2320';
    g.fillRect(bx - 4 * S, y - 46 * S, 8 * S, 26 * S);
    g.fillStyle = '#4a3f38';
    g.beginPath(); g.ellipse(bx, y - 44 * S, 16 * S, 7 * S, 0, 0, Math.PI * 2); g.fill();
    const glow = g.createRadialGradient(bx, y - 30 * S, 2 * S, bx, y + h * 0.7, 120 * S);
    glow.addColorStop(0, 'rgba(255,226,170,.30)');
    glow.addColorStop(1, 'rgba(255,226,170,0)');
    g.fillStyle = glow;
    g.fillRect(bx - 130 * S, y - 40 * S, 260 * S, h + 80 * S);
  }
}

/** The largest size that still fits, down to a floor — the same rule as paint. */
function fit(g, text, w, start, S) {
  let size = start;
  for (let i = 0; i < 40; i += 1) {
    g.font = `${size}px "Bitstream Charter", Charter, Georgia, serif`;
    if (g.measureText(text).width <= w - 20 * S) break;
    size -= 2 * S;
    if (size < 26 * S) break;
  }
  return size;
}

function awning(g, S, width) {
  const y = 560 * S;
  const h = 54 * S;
  for (let i = 0; i * 62 * S < width; i += 1) {
    g.fillStyle = i % 2 ? '#264c38' : '#ddcfb4';
    g.fillRect(i * 62 * S, y, Math.min(62 * S, width - i * 62 * S), h);
  }
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y + h, width, 10 * S);
  g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, y, width, 6 * S);
}

function window_(g, S) {
  const x = 120 * S; const y = 672 * S; const w = 470 * S; const h = 340 * S;
  const glass = g.createLinearGradient(x, y, x, y + h);
  glass.addColorStop(0, '#caa063');
  glass.addColorStop(1, '#6d4e2c');
  g.fillStyle = glass; g.fillRect(x, y, w, h);

  // Inside: a lamp, a counter, two figures reduced to shapes.
  g.fillStyle = 'rgba(255,232,186,.55)';
  g.beginPath(); g.arc(x + 110 * S, y + 80 * S, 26 * S, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(60,38,22,.55)';
  g.fillRect(x + 40 * S, y + 190 * S, 180 * S, 90 * S);
  g.fillStyle = 'rgba(40,26,16,.5)';
  g.beginPath(); g.arc(x + 300 * S, y + 170 * S, 34 * S, 0, Math.PI * 2); g.fill();
  g.fillRect(x + 266 * S, y + 200 * S, 70 * S, 110 * S);

  // Glass: the street reflected back, and the mullions.
  g.fillStyle = 'rgba(210,230,255,.13)';
  g.beginPath();
  g.moveTo(x, y + h * 0.62); g.lineTo(x + w, y + h * 0.18);
  g.lineTo(x + w, y); g.lineTo(x, y); g.closePath(); g.fill();
  g.strokeStyle = '#241a14'; g.lineWidth = 9 * S;
  g.strokeRect(x, y, w, h);
  g.lineWidth = 6 * S;
  g.beginPath();
  g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h);
  g.moveTo(x, y + h * 0.36); g.lineTo(x + w, y + h * 0.36);
  g.stroke();
}

function door(g, S, hours) {
  const x = 640 * S; const y = 660 * S; const w = 230 * S; const h = 392 * S;
  g.fillStyle = '#25402f'; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,226,175,.5)';
  g.fillRect(x + 30 * S, y + 34 * S, w - 60 * S, 150 * S);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.fillRect(x + 30 * S, y + 218 * S, w - 60 * S, 130 * S);
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 5 * S;
  g.strokeRect(x, y, w, h);
  g.fillStyle = '#c9a86a';
  g.beginPath(); g.arc(x + w - 34 * S, y + h * 0.55, 8 * S, 0, Math.PI * 2); g.fill();

  // The hours plate beside the door: small lettering, and untouched by the ad.
  const px = PLATE.x * (S * 1000);
  const py = PLATE.y * (S * 1250);
  const pw = PLATE.w * (S * 1000);
  const ph = PLATE.h * (S * 1250);
  g.fillStyle = '#17301f'; g.fillRect(px, py, pw, ph);
  g.strokeStyle = 'rgba(214,176,112,.5)'; g.lineWidth = 2 * S;
  g.strokeRect(px, py, pw, ph);
  g.fillStyle = '#e6d7ba';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round(21 * S)}px "Bitstream Charter", Charter, Georgia, serif`;
  g.fillText(hours, px + pw / 2, py + ph / 2);
}

function pot(g, S, x, pave) {
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(x, pave + 6 * S, 46 * S, 9 * S, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8a5a41';
  g.beginPath();
  g.moveTo(x - 36 * S, pave - 60 * S); g.lineTo(x + 36 * S, pave - 60 * S);
  g.lineTo(x + 26 * S, pave); g.lineTo(x - 26 * S, pave);
  g.closePath(); g.fill();
  g.fillStyle = '#2f5a3a';
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI / 2 + (i - 4) * 0.22;
    g.save();
    g.translate(x, pave - 62 * S);
    g.rotate(a);
    g.beginPath(); g.ellipse(0, -44 * S, 11 * S, 44 * S, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}

function bike(g, S, x, pave) {
  const y = pave - 6 * S;
  g.strokeStyle = '#1f1b18'; g.lineWidth = 5 * S;
  for (const cx of [x, x + 118 * S]) {
    g.beginPath(); g.arc(cx, y - 42 * S, 42 * S, 0, Math.PI * 2); g.stroke();
  }
  g.lineWidth = 7 * S;
  g.strokeStyle = '#7a2f2f';
  g.beginPath();
  g.moveTo(x, y - 42 * S); g.lineTo(x + 46 * S, y - 96 * S);
  g.lineTo(x + 104 * S, y - 96 * S); g.lineTo(x + 118 * S, y - 42 * S);
  g.moveTo(x + 46 * S, y - 96 * S); g.lineTo(x + 70 * S, y - 42 * S);
  g.lineTo(x + 118 * S, y - 42 * S);
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(x + 60 * S, pave + 5 * S, 90 * S, 8 * S, 0, 0, Math.PI * 2); g.fill();
}
