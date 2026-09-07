// The shot the third Short is about: a car driving past a parade of shops.
//
// Drawn as a function of time so the same code makes a still, a smooth clip, or
// a deliberately stuttering one — which is what the first half of the film
// needs. Nothing here is a model output; it is the ad's placeholder footage,
// and short3.js says so where it is used.

const SKY_TOP = '#2c3d55';
const SKY_LOW = '#c98f63';

export function carFrame({ width = 1000, height = 1250, t = 0.5 } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const S = width / 1000;

  const horizon = 520 * S;
  const kerbY = 830 * S;
  const roadY = 862 * S;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_LOW);
  g.fillStyle = sky; g.fillRect(0, 0, width, horizon);

  // A parade of shopfronts, parallaxed slightly so the drive-by reads.
  const drift = t * 120 * S;
  for (let i = -1; i < 7; i += 1) {
    const x = i * 190 * S - drift * 0.35;
    const h = (250 + ((i * 37) % 90)) * S;
    g.fillStyle = ['#4a4038', '#544a40', '#3f382f', '#5c5045'][(i + 4) % 4];
    g.fillRect(x, horizon - h, 182 * S, h);
    g.fillStyle = 'rgba(255,214,150,.75)';
    for (let w = 0; w < 3; w += 1) {
      for (let r = 0; r < 2; r += 1) {
        if ((i + w + r) % 3 === 0) continue;
        g.fillRect(x + (18 + w * 56) * S, horizon - h + (34 + r * 78) * S, 34 * S, 46 * S);
      }
    }
    // Shop awning.
    g.fillStyle = i % 2 ? '#7c3f3f' : '#3f5c4a';
    g.fillRect(x + 8 * S, horizon - 74 * S, 166 * S, 20 * S);
  }

  // Pavement, kerb, road.
  g.fillStyle = '#6f6a63'; g.fillRect(0, horizon, width, kerbY - horizon);
  g.fillStyle = '#8b857c'; g.fillRect(0, kerbY, width, roadY - kerbY);
  const road = g.createLinearGradient(0, roadY, 0, height);
  road.addColorStop(0, '#3b3b3e'); road.addColorStop(1, '#2a2a2d');
  g.fillStyle = road; g.fillRect(0, roadY, width, height - roadY);

  // Centre line, sliding with the car so the motion has something to read against.
  g.fillStyle = '#d8c46a';
  const dash = 120 * S;
  for (let x = -dash + ((drift * 2.6) % (dash * 2)); x < width + dash; x += dash * 2) {
    g.fillRect(x, roadY + 150 * S, dash, 9 * S);
  }

  drawCar(g, S, width, height, t, roadY);

  const grain = g.getImageData(0, 0, width, height);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 11;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  g.putImageData(grain, 0, 0);
  return c;
}

function drawCar(g, S, width, height, t, roadY) {
  // Left to right across the frame, with a little room off each edge.
  const cx = (-0.15 + t * 1.3) * width;
  const cy = roadY + 92 * S;
  const w = 420 * S;
  const h = 118 * S;

  g.save();
  g.translate(cx, cy);

  g.fillStyle = 'rgba(0,0,0,.42)';
  g.beginPath(); g.ellipse(0, h * 0.52, w * 0.48, 14 * S, 0, 0, Math.PI * 2); g.fill();

  // Body.
  const body = g.createLinearGradient(0, -h * 0.6, 0, h * 0.5);
  body.addColorStop(0, '#d84a3f');
  body.addColorStop(0.55, '#b8352c');
  body.addColorStop(1, '#7d221c');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-w / 2, h * 0.28);
  g.lineTo(-w / 2 + 22 * S, -h * 0.14);
  g.lineTo(-w * 0.22, -h * 0.18);
  g.lineTo(-w * 0.10, -h * 0.62);
  g.lineTo(w * 0.16, -h * 0.62);
  g.lineTo(w * 0.28, -h * 0.16);
  g.lineTo(w / 2 - 16 * S, -h * 0.10);
  g.lineTo(w / 2, h * 0.28);
  g.closePath();
  g.fill();

  // Glass.
  g.fillStyle = '#26333f';
  g.beginPath();
  g.moveTo(-w * 0.085, -h * 0.56);
  g.lineTo(w * 0.14, -h * 0.56);
  g.lineTo(w * 0.235, -h * 0.20);
  g.lineTo(-w * 0.19, -h * 0.20);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.16)';
  g.beginPath();
  g.moveTo(-w * 0.07, -h * 0.54); g.lineTo(w * 0.02, -h * 0.54);
  g.lineTo(-w * 0.09, -h * 0.22); g.lineTo(-w * 0.17, -h * 0.22);
  g.closePath(); g.fill();

  // Lights.
  g.fillStyle = '#ffe9a8';
  g.fillRect(w / 2 - 26 * S, -h * 0.02, 22 * S, 14 * S);
  g.fillStyle = '#d05050';
  g.fillRect(-w / 2 + 6 * S, -h * 0.04, 16 * S, 13 * S);

  // Wheels, turning with the travel.
  const spin = t * 26;
  for (const wx of [-w * 0.28, w * 0.27]) {
    g.save();
    g.translate(wx, h * 0.30);
    g.fillStyle = '#17181a';
    g.beginPath(); g.arc(0, 0, 40 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9aa0a6';
    g.beginPath(); g.arc(0, 0, 19 * S, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6d7276'; g.lineWidth = 4 * S;
    for (let i = 0; i < 5; i += 1) {
      const a = spin + (i / 5) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 17 * S, Math.sin(a) * 17 * S);
      g.stroke();
    }
    g.restore();
  }
  g.restore();
}

/** A run of frames. `stutter` repeats and drops them, the way a preview does. */
export function carClip({ width = 1000, height = 1250, frames = 48, stutter = 0 } = {}) {
  const out = [];
  for (let i = 0; i < frames; i += 1) {
    let t = i / (frames - 1);
    if (stutter > 0) {
      // Hold on some frames and skip others: the same total length, played back
      // unevenly, which is exactly what a preview that cannot keep up looks like.
      const held = Math.floor(i / (1 + stutter * 3)) * (1 + stutter * 3);
      t = Math.min(1, (held / (frames - 1)) + (Math.random() < 0.18 ? 0.06 : 0));
    }
    out.push(carFrame({ width, height, t }));
  }
  return out;
}
