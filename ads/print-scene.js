// The photograph the restore chapter is about: a scanned print from the early
// sixties — two people outside a small house, with the car they were proud of.
//
// Drawn once, in colour, and then put through the two things that actually
// happened to it: the paper aged, and the scan is monochrome. The flags undo
// those in the order the tools do — `damage: false` is what Restore is asked
// for, `colour: true` is what Colourise is asked for — so the film can show a
// stand-in for each without inventing a different photograph.
//
// Nothing here is a model output. recap.js says so where it uses it, and the
// film marks every stand-in on screen.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function printPhoto({
  width = 1200, height = 900, damage = true, colour = false, seed = 611960,
} = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d', { willReadFrequently: true });
  const S = width / 1200;
  const rnd = mulberry32(seed);

  // ── the scene, in the colours it was ────────────────────────────────────
  const sky = g.createLinearGradient(0, 0, 0, height * 0.55);
  sky.addColorStop(0, '#7fa6c4');
  sky.addColorStop(1, '#cfd8d2');
  g.fillStyle = sky; g.fillRect(0, 0, width, height);

  // Hedge and lawn.
  g.fillStyle = '#6f8a58'; g.fillRect(0, height * 0.62, width, height * 0.38);
  g.fillStyle = '#5d7a4a';
  for (let x = 0; x < width; x += 26 * S) {
    g.beginPath(); g.ellipse(x, height * 0.625, 22 * S, 13 * S, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#8c8577'; g.fillRect(0, height * 0.79, width, height * 0.21);
  g.fillStyle = 'rgba(0,0,0,.08)';
  for (let x = -40 * S; x < width; x += 150 * S) g.fillRect(x, height * 0.79, 3 * S, height * 0.21);

  house(g, S, width, height, rnd);
  car(g, S, width * 0.60, height * 0.585);
  person(g, S, width * 0.255, height * 0.50, {
    coat: '#b9463f', skin: '#c98d63', hair: '#3a2b22', hat: false, height: 1.0,
  });
  person(g, S, width * 0.335, height * 0.505, {
    coat: '#3f4f6e', skin: '#e0b48d', hair: '#6b5138', hat: true, height: 0.97,
  });

  // The light of the day it was taken: low sun from the left.
  const sun = g.createLinearGradient(0, 0, width, height);
  sun.addColorStop(0, 'rgba(255,224,170,.18)');
  sun.addColorStop(1, 'rgba(30,26,40,.16)');
  g.fillStyle = sun; g.fillRect(0, 0, width, height);

  // ── what time did to it ─────────────────────────────────────────────────
  if (!colour) monochrome(g, width, height);
  if (damage) {
    fade(g, width, height, S);
    scratches(g, width, height, S, rnd);
    speckle(g, width, height, rnd);
    crease(g, width, height, S);
    stain(g, width, height, S);
  }
  grain(g, width, height, rnd, damage ? 13 : 7);
  return c;
}

// ── the parts ──────────────────────────────────────────────────────────────

function house(g, S, width, height, rnd) {
  const x = width * 0.06;
  const y = height * 0.30;
  const w = width * 0.40;
  const h = height * 0.34;
  g.fillStyle = '#c9bca6'; g.fillRect(x, y, w, h);
  // Pebbledash, and the roof over it.
  g.fillStyle = 'rgba(0,0,0,.05)';
  for (let i = 0; i < 900; i += 1) {
    g.fillRect(x + rnd() * w, y + rnd() * h, 2 * S, 2 * S);
  }
  g.fillStyle = '#6d4b41';
  g.beginPath();
  g.moveTo(x - 18 * S, y); g.lineTo(x + w + 18 * S, y);
  g.lineTo(x + w - 30 * S, y - 58 * S); g.lineTo(x + 30 * S, y - 58 * S);
  g.closePath(); g.fill();

  // Door and two sash windows.
  g.fillStyle = '#2f4d3a'; g.fillRect(x + w * 0.44, y + h * 0.42, w * 0.13, h * 0.58);
  g.fillStyle = '#d8d2c4';
  for (const wx of [x + w * 0.12, x + w * 0.70]) {
    g.fillRect(wx, y + h * 0.22, w * 0.18, h * 0.30);
    g.strokeStyle = '#8b8171'; g.lineWidth = 3 * S;
    g.strokeRect(wx, y + h * 0.22, w * 0.18, h * 0.30);
    g.beginPath();
    g.moveTo(wx + w * 0.09, y + h * 0.22); g.lineTo(wx + w * 0.09, y + h * 0.52);
    g.moveTo(wx, y + h * 0.37); g.lineTo(wx + w * 0.18, y + h * 0.37);
    g.stroke();
  }
  // A drainpipe, and the shadow the house throws on the grass.
  g.fillStyle = '#7d6a5c'; g.fillRect(x + w - 14 * S, y, 9 * S, h);
  g.fillStyle = 'rgba(0,0,0,.14)';
  g.fillRect(x, y + h, w, 14 * S);
}

function car(g, S, cx, cy) {
  const w = 300 * S;
  const h = 96 * S;
  const x = cx - w / 2;
  const y = cy;

  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(cx, y + h + 6 * S, w * 0.48, 11 * S, 0, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#4c6f7a';
  g.beginPath();
  g.moveTo(x, y + h * 0.55);
  g.quadraticCurveTo(x + w * 0.08, y + h * 0.16, x + w * 0.30, y + h * 0.14);
  g.lineTo(x + w * 0.62, y + h * 0.13);
  g.quadraticCurveTo(x + w * 0.86, y + h * 0.18, x + w, y + h * 0.55);
  g.lineTo(x + w, y + h * 0.82); g.lineTo(x, y + h * 0.82);
  g.closePath(); g.fill();

  // Glass, chrome, wheels.
  g.fillStyle = 'rgba(224,236,240,.75)';
  g.beginPath();
  g.moveTo(x + w * 0.16, y + h * 0.5);
  g.quadraticCurveTo(x + w * 0.22, y + h * 0.22, x + w * 0.40, y + h * 0.22);
  g.lineTo(x + w * 0.60, y + h * 0.22);
  g.quadraticCurveTo(x + w * 0.74, y + h * 0.26, x + w * 0.80, y + h * 0.5);
  g.closePath(); g.fill();
  g.fillStyle = '#d7d2c6';
  g.fillRect(x, y + h * 0.60, w, 5 * S);
  for (const wx of [x + w * 0.22, x + w * 0.78]) {
    g.fillStyle = '#20201f';
    g.beginPath(); g.arc(wx, y + h * 0.82, 20 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b9b3a6';
    g.beginPath(); g.arc(wx, y + h * 0.82, 8 * S, 0, Math.PI * 2); g.fill();
  }
  // A highlight along the wing, because chrome is what the picture is about.
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 3 * S;
  g.beginPath();
  g.moveTo(x + w * 0.1, y + h * 0.45);
  g.quadraticCurveTo(x + w * 0.5, y + h * 0.3, x + w * 0.9, y + h * 0.47);
  g.stroke();
}

/**
 * A person, drawn as a photograph of one at this distance would read: a coat,
 * a face too small for features, and the posture of standing still for a
 * camera that needs a moment.
 */
function person(g, S, cx, topY, { coat, skin, hair, hat, height = 1 }) {
  const h = 250 * S * height;
  const shoulder = 54 * S;

  g.fillStyle = 'rgba(0,0,0,.22)';
  g.beginPath(); g.ellipse(cx, topY + h, 34 * S, 8 * S, 0, 0, Math.PI * 2); g.fill();

  // Legs.
  g.fillStyle = '#3a3630';
  g.fillRect(cx - 17 * S, topY + h * 0.58, 14 * S, h * 0.42);
  g.fillRect(cx + 3 * S, topY + h * 0.58, 14 * S, h * 0.42);

  // Coat.
  g.fillStyle = coat;
  g.beginPath();
  g.moveTo(cx - shoulder / 2, topY + h * 0.22);
  g.quadraticCurveTo(cx, topY + h * 0.17, cx + shoulder / 2, topY + h * 0.22);
  g.lineTo(cx + shoulder / 2 + 4 * S, topY + h * 0.62);
  g.lineTo(cx - shoulder / 2 - 4 * S, topY + h * 0.62);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.14)';
  g.fillRect(cx - 2 * S, topY + h * 0.22, 4 * S, h * 0.40);

  // Arms, hands.
  g.fillStyle = coat;
  g.fillRect(cx - shoulder / 2 - 10 * S, topY + h * 0.24, 11 * S, h * 0.34);
  g.fillRect(cx + shoulder / 2 - 1 * S, topY + h * 0.24, 11 * S, h * 0.34);
  g.fillStyle = skin;
  g.beginPath(); g.arc(cx - shoulder / 2 - 5 * S, topY + h * 0.60, 6 * S, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + shoulder / 2 + 4 * S, topY + h * 0.60, 6 * S, 0, Math.PI * 2); g.fill();

  // Head, hair, hat.
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(cx, topY + h * 0.12, 19 * S, 23 * S, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hair;
  g.beginPath();
  g.ellipse(cx, topY + h * 0.075, 20 * S, 15 * S, 0, Math.PI, 0);
  g.fill();
  if (hat) {
    g.fillStyle = '#4b4237';
    g.fillRect(cx - 26 * S, topY + h * 0.055, 52 * S, 5 * S);
    g.beginPath(); g.ellipse(cx, topY + h * 0.04, 17 * S, 13 * S, 0, Math.PI, 0); g.fill();
  }
}

// ── what the years did ─────────────────────────────────────────────────────

function monochrome(g, width, height) {
  const px = g.getImageData(0, 0, width, height);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    // Rec. 601 luma, then warmed towards the brown a print of this age goes.
    const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // A print has more contrast than a straight luma conversion gives, and it
    // carries the brown the paper went, not a grey.
    const y = Math.max(0, Math.min(255, (luma - 128) * 1.18 + 122));
    d[i] = Math.min(255, y * 1.04 + 8);
    d[i + 1] = Math.min(255, y * 0.95 + 3);
    d[i + 2] = Math.min(255, y * 0.80);
  }
  g.putImageData(px, 0, 0);
}

function fade(g, width, height, S) {
  // Paper lightens from the edges in, where the light and the air got at it.
  const wash = g.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.25,
    width / 2, height / 2, Math.max(width, height) * 0.72,
  );
  wash.addColorStop(0, 'rgba(226,208,176,0)');
  wash.addColorStop(1, 'rgba(226,208,176,.5)');
  g.fillStyle = wash; g.fillRect(0, 0, width, height);
  g.fillStyle = 'rgba(255,248,232,.10)'; g.fillRect(0, 0, width, height);
}

function scratches(g, width, height, S, rnd) {
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * width;
    const y = rnd() * height;
    const len = (30 + rnd() * 240) * S;
    const angle = (rnd() - 0.5) * 0.7 + (rnd() < 0.5 ? Math.PI / 2 : 0);
    g.strokeStyle = `rgba(255,252,240,${0.18 + rnd() * 0.3})`;
    g.lineWidth = (0.8 + rnd() * 1.6) * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    g.stroke();
  }
  g.restore();
}

function speckle(g, width, height, rnd) {
  for (let i = 0; i < 1400; i += 1) {
    const x = rnd() * width;
    const y = rnd() * height;
    const r = 0.5 + rnd() * 2.2;
    g.fillStyle = rnd() < 0.62 ? 'rgba(252,246,232,.55)' : 'rgba(40,30,20,.35)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

function crease(g, width, height, S) {
  // One fold, across a corner, the way a print carried in a wallet goes.
  g.save();
  g.translate(width * 0.72, 0);
  g.rotate(0.42);
  const band = g.createLinearGradient(-14 * S, 0, 14 * S, 0);
  band.addColorStop(0, 'rgba(60,44,30,0)');
  band.addColorStop(0.45, 'rgba(255,250,238,.5)');
  band.addColorStop(0.55, 'rgba(70,52,34,.30)');
  band.addColorStop(1, 'rgba(60,44,30,0)');
  g.fillStyle = band;
  g.fillRect(-14 * S, -40, 28 * S, height * 1.6);
  g.restore();
}

function stain(g, width, height, S) {
  const damp = g.createRadialGradient(
    width * 0.13, height * 0.88, 6 * S,
    width * 0.13, height * 0.88, 180 * S,
  );
  damp.addColorStop(0, 'rgba(124,96,54,.34)');
  damp.addColorStop(0.7, 'rgba(124,96,54,.12)');
  damp.addColorStop(1, 'rgba(124,96,54,0)');
  g.fillStyle = damp;
  g.fillRect(0, height * 0.55, width * 0.5, height * 0.45);
}

function grain(g, width, height, rnd, amount) {
  const px = g.getImageData(0, 0, width, height);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(px, 0, 0);
}
