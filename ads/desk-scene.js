// The desk the second Short is about.
//
// The same room twice: once with the machine work gives you, once with the one
// you want. Between them sits `badComposite`, which is a real paste — scale a
// cut-out wrong, tint it wrong, leave the old object's edge showing, smear the
// join — because that is what compositing by hand looks like before you have
// spent years learning not to do exactly that.

export const PC_RECT = { x: 0.560, y: 0.398, w: 0.300, h: 0.300 };

export const pcRegion = (w, h) => ({
  x: Math.round(PC_RECT.x * w),
  y: Math.round(PC_RECT.y * h),
  w: Math.round(PC_RECT.w * w),
  h: Math.round(PC_RECT.h * h),
});

export function deskScene({ width = 1000, height = 1250, pc = 'office' } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const S = width / 1000;

  const deskY = 700 * S;
  const floorY = 1080 * S;
  const glow = pc === 'gaming';

  // ── wall ──
  const wall = g.createLinearGradient(0, 0, 0, deskY);
  wall.addColorStop(0, '#39414c');
  wall.addColorStop(1, '#4a525d');
  g.fillStyle = wall; g.fillRect(0, 0, width, deskY);

  // A warm lamp from the left, so the room has a direction of light that a
  // pasted cut-out can visibly disagree with.
  const lamp = g.createRadialGradient(120 * S, 120 * S, 0, 120 * S, 120 * S, 720 * S);
  lamp.addColorStop(0, 'rgba(255,206,140,.34)');
  lamp.addColorStop(1, 'rgba(255,206,140,0)');
  g.fillStyle = lamp; g.fillRect(0, 0, width, deskY);

  // Cable trunking and a socket, because rooms have them.
  g.fillStyle = '#333a44'; g.fillRect(0, 604 * S, width, 16 * S);
  g.fillStyle = '#5d6672'; g.fillRect(96 * S, 540 * S, 74 * S, 56 * S);

  if (glow) {
    // The case throws colour onto the wall behind it.
    const spill = g.createRadialGradient(720 * S, 560 * S, 0, 720 * S, 560 * S, 430 * S);
    spill.addColorStop(0, 'rgba(120,80,255,.34)');
    spill.addColorStop(0.5, 'rgba(60,140,255,.14)');
    spill.addColorStop(1, 'rgba(60,140,255,0)');
    g.fillStyle = spill; g.fillRect(0, 0, width, deskY + 200 * S);
  }

  // ── desk ──
  const top = g.createLinearGradient(0, deskY, 0, floorY);
  top.addColorStop(0, '#7d5c3f');
  top.addColorStop(0.06, '#6b4e35');
  top.addColorStop(1, '#4e3926');
  g.fillStyle = top; g.fillRect(0, deskY, width, floorY - deskY);
  g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, deskY, width, 7 * S);
  for (let i = 0; i < 46; i += 1) {                       // grain
    g.strokeStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
    g.lineWidth = (0.7 + Math.random() * 1.6) * S;
    const y = deskY + 14 * S + Math.random() * (floorY - deskY - 20 * S);
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(width * 0.3, y + 5 * S, width * 0.7, y - 5 * S, width, y); g.stroke();
  }

  // ── floor ──
  g.fillStyle = '#2b2118'; g.fillRect(0, floorY, width, height - floorY);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, floorY, width, 30 * S);

  // ── monitor ──
  const mx = 150 * S, my = 250 * S, mw = 470 * S, mh = 300 * S;
  g.fillStyle = '#1b1e23';
  round(g, mx - 12 * S, my - 12 * S, mw + 24 * S, mh + 24 * S, 10 * S); g.fill();
  const screen = g.createLinearGradient(mx, my, mx + mw, my + mh);
  if (glow) {
    screen.addColorStop(0, '#1a2340'); screen.addColorStop(0.5, '#2b1d4a'); screen.addColorStop(1, '#101828');
  } else {
    screen.addColorStop(0, '#20262e'); screen.addColorStop(0.5, '#2b333c'); screen.addColorStop(1, '#161b21');
  }
  g.fillStyle = screen; g.fillRect(mx, my, mw, mh);
  g.fillStyle = 'rgba(255,255,255,.05)';
  g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + mw * 0.55, my); g.lineTo(mx, my + mh * 0.75); g.fill();
  g.fillStyle = '#22262c';
  g.fillRect(mx + mw / 2 - 26 * S, my + mh + 12 * S, 52 * S, 96 * S);
  g.fillRect(mx + mw / 2 - 110 * S, deskY - 12 * S, 220 * S, 14 * S);

  // ── keyboard, mouse, mug, plant ──
  g.fillStyle = '#23272d';
  round(g, 170 * S, 800 * S, 400 * S, 90 * S, 8 * S); g.fill();
  g.fillStyle = glow ? '#4f6bd8' : '#3a4048';
  for (let r = 0; r < 3; r += 1) {
    for (let k = 0; k < 14; k += 1) {
      g.fillRect(186 * S + k * 27 * S, 814 * S + r * 24 * S, 20 * S, 17 * S);
    }
  }
  g.fillStyle = '#262b31';
  round(g, 620 * S, 820 * S, 74 * S, 108 * S, 34 * S); g.fill();

  g.fillStyle = '#c8563c';
  round(g, 60 * S, 760 * S, 92 * S, 100 * S, 12 * S); g.fill();
  g.strokeStyle = '#c8563c'; g.lineWidth = 13 * S;
  g.beginPath(); g.arc(158 * S, 806 * S, 26 * S, -1.2, 1.2); g.stroke();

  g.fillStyle = '#8d6a4a';
  round(g, 860 * S, 780 * S, 90 * S, 86 * S, 8 * S); g.fill();
  g.fillStyle = '#3f7a46';
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI / 2 + (i - 4) * 0.28;
    g.beginPath();
    g.ellipse(905 * S + Math.cos(a) * 46 * S, 762 * S + Math.sin(a) * 40 * S, 30 * S, 15 * S, a, 0, Math.PI * 2);
    g.fill();
  }

  // ── the machine ──
  if (pc === 'gaming') drawGamingPc(g, S, width, height);
  else drawOfficePc(g, S, width, height);

  const grain = g.getImageData(0, 0, width, height);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  g.putImageData(grain, 0, 0);
  return c;
}

function drawOfficePc(g, S, width, height) {
  const { x, y, w, h } = pcRegion(width, height);
  g.fillStyle = 'rgba(0,0,0,.42)';
  g.beginPath(); g.ellipse(x + w / 2, y + h - 4 * S, w * 0.54, 15 * S, 0, 0, Math.PI * 2); g.fill();

  const body = g.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, '#b9b3a6'); body.addColorStop(0.5, '#cdc7ba'); body.addColorStop(1, '#9c968a');
  g.fillStyle = body;
  round(g, x, y, w, h, 6 * S); g.fill();

  g.fillStyle = '#8e887c'; g.fillRect(x + 12 * S, y + 22 * S, w - 24 * S, 5 * S);
  g.fillStyle = '#7d776c';
  round(g, x + 16 * S, y + 46 * S, w - 32 * S, 22 * S, 3 * S); g.fill();   // optical drive
  g.fillStyle = '#6f6a60';
  for (let i = 0; i < 9; i += 1) g.fillRect(x + 20 * S, y + 100 * S + i * 12 * S, w - 40 * S, 5 * S);
  g.fillStyle = '#5c5f63';
  g.beginPath(); g.arc(x + w - 30 * S, y + h - 34 * S, 11 * S, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#79c07d';
  g.beginPath(); g.arc(x + w - 30 * S, y + h - 34 * S, 4 * S, 0, Math.PI * 2); g.fill();
  // A sticker, because work machines have one.
  g.fillStyle = '#e6e2d6'; g.fillRect(x + 18 * S, y + h - 46 * S, 54 * S, 26 * S);
  g.fillStyle = '#9aa3ad'; g.fillRect(x + 22 * S, y + h - 40 * S, 46 * S, 4 * S);
  g.fillRect(x + 22 * S, y + h - 32 * S, 34 * S, 4 * S);
}

function drawGamingPc(g, S, width, height) {
  const { x, y, w, h } = pcRegion(width, height);

  g.fillStyle = 'rgba(90,60,255,.30)';
  g.beginPath(); g.ellipse(x + w / 2, y + h + 2 * S, w * 0.72, 26 * S, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.beginPath(); g.ellipse(x + w / 2, y + h - 4 * S, w * 0.54, 14 * S, 0, 0, Math.PI * 2); g.fill();

  const body = g.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, '#191c22'); body.addColorStop(0.45, '#23272f'); body.addColorStop(1, '#121419');
  g.fillStyle = body;
  round(g, x, y, w, h, 8 * S); g.fill();

  // Tempered glass panel.
  const glass = g.createLinearGradient(x + 14 * S, y + 14 * S, x + w - 14 * S, y + h - 14 * S);
  glass.addColorStop(0, 'rgba(120,150,220,.20)');
  glass.addColorStop(0.5, 'rgba(40,50,80,.30)');
  glass.addColorStop(1, 'rgba(150,120,220,.16)');
  g.fillStyle = glass;
  round(g, x + 14 * S, y + 14 * S, w - 28 * S, h - 28 * S, 5 * S); g.fill();

  // Three fans, each its own colour.
  const colours = ['#ff3d7f', '#7a4dff', '#28c8ff'];
  for (let i = 0; i < 3; i += 1) {
    const cx = x + 62 * S;
    const cy = y + 60 * S + i * 82 * S;
    const r = 30 * S;
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
    halo.addColorStop(0, colours[i] + 'cc');
    halo.addColorStop(1, colours[i] + '00');
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, r * 2.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = colours[i]; g.lineWidth = 6 * S;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3 * S;
    for (let b = 0; b < 7; b += 1) {
      const a = (b / 7) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 7 * S, cy + Math.sin(a) * 7 * S);
      g.lineTo(cx + Math.cos(a + 0.7) * (r - 5 * S), cy + Math.sin(a + 0.7) * (r - 5 * S));
      g.stroke();
    }
  }

  // A graphics card slab with its own light bar.
  g.fillStyle = '#0e1014';
  round(g, x + 108 * S, y + 130 * S, w - 132 * S, 46 * S, 4 * S); g.fill();
  const bar = g.createLinearGradient(x + 112 * S, 0, x + w - 28 * S, 0);
  bar.addColorStop(0, '#28c8ff'); bar.addColorStop(0.5, '#7a4dff'); bar.addColorStop(1, '#ff3d7f');
  g.fillStyle = bar; g.fillRect(x + 116 * S, y + 140 * S, w - 148 * S, 7 * S);

  // Front light strip.
  g.fillStyle = bar; g.fillRect(x + 4 * S, y + 10 * S, 6 * S, h - 20 * S);
}

/**
 * A cut-out pasted in by hand, badly: the wrong size, the wrong tint for the
 * light in the room, a hard edge with no shadow of its own, a halo of the old
 * object left around it, and a smeared attempt at hiding the join.
 */
export function badComposite(base, cutout, region, { progress = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);

  const { x, y, w, h } = region;
  const step = (from, to) => from + (to - from) * Math.max(0, Math.min(1, progress));

  // 1. Smear the old machine out of the way — the same patch fill as before.
  if (progress > 0.05) {
    g.save();
    g.beginPath(); g.rect(x - 14, y - 14, w + 28, h + 28); g.clip();
    const band = Math.round(w * 0.4);
    for (let i = 0, dx = x - 14; dx < x + w + 14; i += 1, dx += band * 0.8) {
      g.globalAlpha = 0.95;
      g.drawImage(c, x - band - 20, y, band, h, dx, y + i * 4, band, h);
    }
    g.globalAlpha = 0.8;
    g.filter = 'blur(2px)';
    g.drawImage(c, x - 14, y - 14, w + 28, h + 28, x - 14, y - 14, w + 28, h + 28);
    g.filter = 'none';
    g.restore();
  }

  // 2. Paste the cut-out: too big, slightly rotated, and never quite in line
  //    with the surface it is supposed to be standing on.
  if (progress > 0.35) {
    const scale = step(1, 1.34);
    const pw = w * scale;
    const ph = h * scale;
    g.save();
    g.translate(x + w / 2 + 16, y + h / 2 - 26);
    g.rotate(-0.045);
    // Hard edge, no contact shadow — the tell that gives every paste away.
    g.drawImage(cutout, -pw / 2, -ph / 2, pw, ph);
    // And the wrong white balance for a warm room.
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(90,130,190,.26)';
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.restore();
  }

  // 3. The halo left where the old object was not quite covered.
  if (progress > 0.7) {
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = 'rgba(205,199,186,.85)';
    g.lineWidth = 7;
    g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    g.restore();
  }

  return c;
}

/** Just the machine, on transparency, as a cut-out to paste. */
export function pcCutout(width = 1000, height = 1250) {
  const region = pcRegion(width, height);
  const full = deskScene({ width, height, pc: 'gaming' });
  const c = document.createElement('canvas');
  c.width = region.w; c.height = region.h;
  const g = c.getContext('2d');
  g.drawImage(full, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
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
