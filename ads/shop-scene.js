// The shot the fourth Short is about: a slow pan along a shopfront, with a
// van parked in front of the door.
//
// Drawn as a function of time so the same code makes the clip, the clip
// without the van (the ad's stand-in for what Realtouch gives back), and a
// per-frame patch of it. Nothing here is a model output; short4.js says so
// where it is used.

const SKY_TOP = '#26364a';
const SKY_LOW = '#b98a63';

/** Where the van sits in the frame at time t, 0..1 through the pan. */
export function vanRect(width = 780, height = 976, t = 0) {
  const S = width / 780;
  const pan = t * 200 * S;
  return { x: 288 * S - pan, y: 430 * S, w: 450 * S, h: 340 * S };
}

export function shopFrame({ width = 780, height = 976, t = 0, van = true, grain = true } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const S = width / 780;
  const pan = t * 200 * S;

  const roof = 150 * S;
  const pave = 764 * S;
  const kerb = 830 * S;

  const sky = g.createLinearGradient(0, 0, 0, roof);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_LOW);
  g.fillStyle = sky; g.fillRect(0, 0, width, roof);

  // The terrace: two shopfronts and a bit of a third, sliding past.
  drawShop(g, S, -60 * S - pan, roof, pave, 0);
  drawShop(g, S, 700 * S - pan, roof, pave, 1);
  drawShop(g, S, 1460 * S - pan, roof, pave, 2);

  // Pavement, kerb, road.
  g.fillStyle = '#7b756c'; g.fillRect(0, pave, width, kerb - pave);
  g.fillStyle = '#8f887e'; g.fillRect(0, kerb - 10 * S, width, 10 * S);
  for (let x = -((pan * 0.999) % (120 * S)); x < width; x += 120 * S) {
    g.fillStyle = 'rgba(0,0,0,.16)';
    g.fillRect(x, pave, 2 * S, kerb - pave - 10 * S);
  }
  const road = g.createLinearGradient(0, kerb, 0, height);
  road.addColorStop(0, '#3a3a3d'); road.addColorStop(1, '#2b2b2e');
  g.fillStyle = road; g.fillRect(0, kerb, width, height - kerb);

  if (van) drawVan(g, S, vanRect(width, height, t));

  if (grain) {
    const px = g.getImageData(0, 0, width, height);
    for (let i = 0; i < px.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      px.data[i] += n; px.data[i + 1] += n; px.data[i + 2] += n;
    }
    g.putImageData(px, 0, 0);
  }
  return c;
}

const SHOPS = [
  { brick: '#6b4a3c', awning: '#2f5d47', name: 'MAY & SONS', door: '#2b4436' },
  { brick: '#5c4740', awning: '#7a3b3b', name: 'HARDWARE', door: '#3a2f2a' },
  { brick: '#664c3a', awning: '#3f4a6b', name: 'BAKERY', door: '#2f3550' },
];

function drawShop(g, S, x0, roof, pave, which) {
  const shop = SHOPS[which % SHOPS.length];
  const w = 700 * S;
  if (x0 > g.canvas.width || x0 + w < 0) return;

  // Brick.
  g.fillStyle = shop.brick;
  g.fillRect(x0, roof, w, pave - roof);
  g.fillStyle = 'rgba(0,0,0,.13)';
  for (let y = roof; y < pave; y += 22 * S) {
    g.fillRect(x0, y, w, 2 * S);
    const off = ((y - roof) / (22 * S)) % 2 ? 0 : 44 * S;
    for (let x = x0 + off; x < x0 + w; x += 88 * S) g.fillRect(x, y, 2 * S, 22 * S);
  }
  // A little cornice under the roofline.
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x0, roof, w, 16 * S);

  // Fascia and lettering.
  g.fillStyle = '#201814';
  g.fillRect(x0 + 20 * S, 196 * S, w - 40 * S, 74 * S);
  g.fillStyle = '#e8d6b4';
  g.font = `${34 * S}px "Bitstream Charter", Charter, Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(shop.name, x0 + w / 2, 234 * S);

  // Awning: a striped valance under the fascia.
  const ax = x0 + 26 * S;
  const aw = w - 52 * S;
  for (let i = 0; i * 44 * S < aw; i += 1) {
    g.fillStyle = i % 2 ? shop.awning : '#d9cdb4';
    g.fillRect(ax + i * 44 * S, 274 * S, Math.min(44 * S, aw - i * 44 * S), 46 * S);
  }
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(ax, 318 * S, aw, 8 * S);

  // Window: warm inside, mullions across it.
  const wx = x0 + 60 * S;
  const ww = 360 * S;
  const wy = 360 * S;
  const wh = 300 * S;
  const glass = g.createLinearGradient(wx, wy, wx, wy + wh);
  glass.addColorStop(0, '#c79a55');
  glass.addColorStop(1, '#7a5730');
  g.fillStyle = glass; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = 'rgba(255,232,190,.45)';
  g.fillRect(wx + 30 * S, wy + 40 * S, 90 * S, 120 * S);
  g.fillRect(wx + 200 * S, wy + 70 * S, 70 * S, 90 * S);
  g.strokeStyle = '#241a14'; g.lineWidth = 7 * S;
  g.strokeRect(wx, wy, ww, wh);
  g.beginPath();
  g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh);
  g.moveTo(wx, wy + wh * 0.42); g.lineTo(wx + ww, wy + wh * 0.42);
  g.stroke();

  // Door, with a fanlight and a step.
  const dx = x0 + 470 * S;
  const dw = 150 * S;
  const dy = 352 * S;
  const dh = 412 * S;
  g.fillStyle = shop.door; g.fillRect(dx, dy, dw, dh);
  g.fillStyle = 'rgba(255,224,170,.55)';
  g.fillRect(dx + 22 * S, dy + 26 * S, dw - 44 * S, 96 * S);
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(dx + 22 * S, dy + 150 * S, dw - 44 * S, 110 * S);
  g.fillStyle = '#c9a86a';
  g.beginPath(); g.arc(dx + dw - 30 * S, dy + dh * 0.56, 7 * S, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(dx - 8 * S, pave - 12 * S, dw + 16 * S, 12 * S);

  // Drainpipe on the party wall.
  g.fillStyle = '#3a2f27';
  g.fillRect(x0 + w - 26 * S, roof, 14 * S, pave - roof);
}

function drawVan(g, S, r) {
  const { x, y, w, h } = r;

  g.fillStyle = 'rgba(0,0,0,.45)';
  g.beginPath();
  g.ellipse(x + w / 2, y + h - 6 * S, w * 0.47, 13 * S, 0, 0, Math.PI * 2);
  g.fill();

  // Body: a box van, nose to the right.
  const body = g.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, '#e6e3dc');
  body.addColorStop(0.6, '#cdc9c0');
  body.addColorStop(1, '#9d9990');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(x, y + 26 * S);
  g.lineTo(x + w * 0.66, y + 26 * S);
  g.lineTo(x + w * 0.78, y + 92 * S);
  g.lineTo(x + w, y + 108 * S);
  g.lineTo(x + w, y + h - 40 * S);
  g.lineTo(x, y + h - 40 * S);
  g.closePath();
  g.fill();

  // Cab glass and a mirror.
  g.fillStyle = '#2b3742';
  g.beginPath();
  g.moveTo(x + w * 0.69, y + 40 * S);
  g.lineTo(x + w * 0.985, y + 112 * S);
  g.lineTo(x + w * 0.985, y + 150 * S);
  g.lineTo(x + w * 0.69, y + 150 * S);
  g.closePath();
  g.fill();
  g.fillStyle = '#5a5651';
  g.fillRect(x + w * 0.99, y + 108 * S, 12 * S, 26 * S);

  // Side panel, with the seam and a plain painted band.
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 3 * S;
  g.beginPath();
  g.moveTo(x + w * 0.05, y + 150 * S); g.lineTo(x + w * 0.64, y + 150 * S);
  g.stroke();
  g.fillStyle = 'rgba(120,140,160,.35)';
  g.fillRect(x + w * 0.06, y + 176 * S, w * 0.5, 46 * S);

  // Wheels.
  for (const cx of [x + w * 0.2, x + w * 0.82]) {
    g.fillStyle = '#17181a';
    g.beginPath(); g.arc(cx, y + h - 40 * S, 40 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8f959b';
    g.beginPath(); g.arc(cx, y + h - 40 * S, 17 * S, 0, Math.PI * 2); g.fill();
  }

  // Rear lights, and the dark gap under the sill.
  g.fillStyle = '#c85c4a';
  g.fillRect(x + 4 * S, y + 150 * S, 14 * S, 40 * S);
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fillRect(x, y + h - 44 * S, w, 10 * S);
}

/**
 * Paint the van out of one frame, the way a clone stamp does: by dragging the
 * pixels beside the hole across it. It is a real operation and it is done per
 * frame, with no knowledge of any other frame — which is exactly why the patch
 * lands somewhere different every time the background slides.
 */
export function patchFrame(source, rect, { pad = 0.02 } = {}) {
  const c = document.createElement('canvas');
  c.width = source.width; c.height = source.height;
  const g = c.getContext('2d');
  g.drawImage(source, 0, 0);

  const grow = Math.round(rect.w * pad);
  const x = Math.round(rect.x - grow);
  const y = Math.round(rect.y - grow);
  const w = Math.round(rect.w + grow * 2);
  const h = Math.round(rect.h + grow * 2);

  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();

  // Pass one: repeat the band to the left of the hole across it. The stride is
  // near the brick pitch but not equal to it, so the courses never line up.
  const band = Math.round(w * 0.3);
  const stride = Math.round(band * 0.88);
  // Whichever side of the hole has a band to spare — a stamp cannot copy from
  // outside the frame, and near the edge of a pan there is nothing to its left.
  const srcX = x - band - 3 >= 0
    ? x - band - 3
    : Math.min(source.width - band, x + w + 3);
  for (let i = 0, dx = x; dx < x + w + band; i += 1, dx += stride) {
    g.globalAlpha = 0.98;
    g.drawImage(c, srcX, y, band, h, dx, y + Math.sin(i * 1.7) * 5, band, h);
  }

  // Pass two: pull the pavement up over the bottom of the hole, so the kerb
  // line stops agreeing with the one either side of it.
  const below = Math.round(h * 0.4);
  g.globalAlpha = 0.92;
  g.drawImage(c, x, y + h, w, below, x - 7, y + h * 0.62, w, below);

  // Pass three: the residue of nudging the stamp about.
  g.globalAlpha = 0.3;
  g.drawImage(c, x, y, w, h, x + 9, y - 6, w, h);
  g.globalAlpha = 0.22;
  g.drawImage(c, x, y, w, h, x - 12, y + 6, w, h);

  g.globalAlpha = 0.7;
  g.filter = 'blur(1.5px)';
  g.drawImage(c, x, y, w, h, x, y, w, h);
  g.filter = 'none';
  g.globalAlpha = 1;
  g.restore();
  return c;
}
