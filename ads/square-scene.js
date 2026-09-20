// The square the sixth Short is set in: a crowd at night, and a billboard.
//
// Drawn as a function of time, like every other scene in these ads — nothing
// here is footage of anybody. The crowd is silhouettes and placards, and the
// placards say what the ad says they say.

const SKY_TOP = '#0d1420';
const SKY_LOW = '#2a2533';

/** Deterministic noise: the recorder steps virtual time and cannot use random. */
const hash = (i, k = 0) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const SIGNS = [
  'NO MORE AI', 'NOT IN OUR NAME', 'WHOSE WATER?', 'NO MORE AI',
  'SLOW DOWN', 'NO MORE AI', 'ASK US FIRST', 'NO MORE AI', 'ENOUGH',
];

/**
 * @param {{width:number, height:number, t:number, lit:number, panel:number,
 *          phones:number}} opts
 *   `lit` fades the billboard up, `panel` cross-fades to its second face, and
 *   `phones` is how much of the crowd has a screen on.
 */
export function squareFrame({
  width = 1000, height = 1250, t = 0, lit = 0, panel = 0, phones = 0,
} = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const S = width / 1000;

  const sky = g.createLinearGradient(0, 0, 0, height * 0.62);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_LOW);
  g.fillStyle = sky;
  g.fillRect(0, 0, width, height);

  skyline(g, S, width, height);
  billboard(g, S, width, height, { lit, panel });
  crowd(g, S, width, height, { t, phones, glow: lit });

  // The light the billboard throws back down over everything.
  if (lit > 0) {
    const wash = g.createLinearGradient(0, height * 0.30, 0, height);
    wash.addColorStop(0, `rgba(224,137,74,${0.16 * lit})`);
    wash.addColorStop(1, 'rgba(224,137,74,0)');
    g.fillStyle = wash;
    g.fillRect(0, height * 0.30, width, height * 0.70);
  }

  const grain = g.getImageData(0, 0, width, height);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  g.putImageData(grain, 0, 0);
  return c;
}

function skyline(g, S, width, height) {
  const base = height * 0.56;
  for (let i = 0; i < 14; i += 1) {
    const w = (70 + hash(i, 3) * 120) * S;
    const x = i * 78 * S - 40 * S;
    const h = (120 + hash(i, 1) * 300) * S;
    g.fillStyle = i % 2 ? '#141a24' : '#101620';
    g.fillRect(x, base - h, w, h);

    g.fillStyle = 'rgba(255,214,150,.30)';
    for (let wy = 0; wy < Math.floor(h / (34 * S)); wy += 1) {
      for (let wx = 0; wx < 3; wx += 1) {
        if (hash(i * 40 + wy * 7 + wx, 9) < 0.55) continue;
        g.fillRect(x + (12 + wx * 22) * S, base - h + (14 + wy * 34) * S, 11 * S, 15 * S);
      }
    }
  }
}

function billboard(g, S, width, height, { lit, panel }) {
  const x = 96 * S;
  const y = 150 * S;
  const w = width - 192 * S;
  const h = 330 * S;

  // Legs, and the gantry the boards always sit on.
  g.fillStyle = '#0c1018';
  g.fillRect(x + w * 0.22, y + h, 22 * S, height * 0.62 - (y + h));
  g.fillRect(x + w * 0.74, y + h, 22 * S, height * 0.62 - (y + h));

  g.fillStyle = '#161d29';
  g.fillRect(x - 10 * S, y - 10 * S, w + 20 * S, h + 20 * S);

  // The face. Dark until the lamps come on.
  const face = g.createLinearGradient(0, y, 0, y + h);
  face.addColorStop(0, lit ? '#1d1a17' : '#121620');
  face.addColorStop(1, lit ? '#15110e' : '#0e121a');
  g.fillStyle = face;
  g.fillRect(x, y, w, h);

  if (lit > 0) {
    g.save();
    g.globalAlpha = lit;
    g.textAlign = 'center';

    if (panel < 1) {
      g.globalAlpha = lit * (1 - panel);
      g.fillStyle = '#e0894a';
      g.font = `600 ${34 * S}px "Liberation Sans", Arial, sans-serif`;
      g.fillText('INTRODUCING', width / 2, y + 96 * S);
      g.fillStyle = '#f6f1ea';
      g.font = `700 ${104 * S}px "Bitstream Charter", Charter, Georgia, serif`;
      g.fillText('Eco Mode', width / 2, y + 208 * S);
      g.fillStyle = 'rgba(246,241,234,.55)';
      g.font = `${26 * S}px "Liberation Sans", Arial, sans-serif`;
      g.fillText('hazelnut · the photo editor', width / 2, y + 268 * S);
    }

    // The second face: what it actually does. No number in litres, here or
    // anywhere else in this campaign.
    if (panel > 0) {
      g.globalAlpha = lit * panel;
      g.fillStyle = '#f6f1ea';
      g.font = `600 ${40 * S}px "Bitstream Charter", Charter, Georgia, serif`;
      const lines = [
        'Smaller pictures.',
        'No location lookup.',
        'Half the frames.',
        '40% fewer credits.',
      ];
      lines.forEach((line, i) => g.fillText(line, width / 2, y + (78 + i * 58) * S));
      g.fillStyle = '#e0894a';
      g.font = `${28 * S}px "Liberation Sans", Arial, sans-serif`;
      g.fillText('It asks for less. It does not settle this.', width / 2, y + 310 * S);
    }
    g.restore();

    // Lamps on the hood, and their spill.
    g.fillStyle = `rgba(255,226,180,${0.5 * lit})`;
    for (let i = 0; i < 5; i += 1) {
      g.beginPath();
      g.ellipse(x + w * (0.12 + i * 0.19), y - 16 * S, 26 * S, 9 * S, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function crowd(g, S, width, height, { t, phones, glow }) {
  const ground = height * 0.60;
  g.fillStyle = '#080b11';
  g.fillRect(0, ground, width, height - ground);

  // Four rows, back to front. Each is larger, lighter and closer together than
  // the one behind it, which is what makes a crowd read as depth rather than
  // as a pattern.
  for (let row = 0; row < 4; row += 1) {
    const scale = 0.78 + row * 0.22;
    const y = ground + row * 108 * S;
    const count = 10 - row;

    for (let i = 0; i < count; i += 1) {
      const seed = row * 31 + i;
      // Kept off the edges: a placard cut in half by the frame reads as a
      // mistake rather than as a crowd continuing past it.
      const margin = 120 * S;
      const x = margin + ((i + 0.5) / count) * (width - margin * 2) + (hash(seed, 2) - 0.5) * 54 * S;
      // The chant: everyone bobs, nobody in time with anybody else.
      const bob = Math.sin(t * 2.2 + hash(seed, 5) * 6.3) * 7 * S * scale;
      person(g, S, x, y + bob, scale, row, seed, { phones, glow, t });
    }
  }
}

function person(g, S, x, y, scale, row, seed, { phones, glow, t }) {
  const shade = ['#10151e', '#141a25', '#181f2b', '#1c2431'][row];
  const s = S * scale;

  // A placard, on some of them — a forest of them reads as wallpaper.
  // Fewer boards at the back, so the front row's slogans are readable rather
  // than lost in a thicket.
  if (hash(seed, 11) > (row < 2 ? 0.68 : 0.5)) {
    const text = SIGNS[Math.floor(hash(seed, 12) * SIGNS.length)];
    const lean = (hash(seed, 13) - 0.5) * 0.3 + Math.sin(t * 1.6 + seed) * 0.03;
    const stick = (180 + hash(seed, 14) * 130) * s;

    g.save();
    g.translate(x, y - 30 * s);
    g.rotate(lean);
    g.fillStyle = '#131820';
    g.fillRect(-4 * s, -stick * 0.35, 8 * s, stick);

    const bw = 210 * s;
    const bh = 104 * s;
    const top = -stick * 0.35 - bh;
    g.fillStyle = glow > 0.2 ? '#d7d0c4' : '#9b968e';
    g.fillRect(-bw / 2, top, bw, bh);
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 2 * s;
    g.strokeRect(-bw / 2, top, bw, bh);

    g.fillStyle = '#16120f';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Always two lines when there are two words to split: a board that clips
    // its own slogan is a badly made board.
    const words = text.split(' ');
    const lines = words.length > 1
      ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
      : [text];
    const size = Math.min(30 * s, (bw * 0.82) / Math.max(...lines.map((l) => l.length)) * 1.75);
    g.font = `700 ${size}px "Liberation Sans", Arial, sans-serif`;
    lines.forEach((line, i) => {
      g.fillText(line, 0, top + bh * (lines.length === 1 ? 0.5 : 0.34 + i * 0.32));
    });
    g.restore();
  }

  // Shoulders and head.
  g.fillStyle = shade;
  g.beginPath();
  g.ellipse(x, y + 52 * s, 46 * s, 58 * s, 0, Math.PI, 0);
  g.fill();
  g.beginPath();
  g.arc(x, y - 14 * s, 22 * s, 0, Math.PI * 2);
  g.fill();

  // The billboard throws a rim down the near side of everybody under it.
  if (glow > 0.15) {
    g.strokeStyle = `rgba(224,171,120,${0.3 * glow})`;
    g.lineWidth = 2.4 * s;
    g.beginPath();
    g.arc(x, y - 14 * s, 22 * s, Math.PI * 1.15, Math.PI * 1.95);
    g.stroke();
    g.beginPath();
    g.ellipse(x, y + 52 * s, 46 * s, 58 * s, 0, Math.PI * 1.08, Math.PI * 1.6);
    g.stroke();
  }

  // A phone, held up, once the billboard has been read.
  const phoneAt = hash(seed, 17);
  if (phones > phoneAt) {
    const rise = Math.min(1, (phones - phoneAt) * 4);
    const px = x + 26 * s;
    const py = y - 46 * s - 30 * s * rise;
    g.fillStyle = `rgba(200,230,255,${0.9 * rise})`;
    g.fillRect(px - 9 * s, py - 16 * s, 18 * s, 32 * s);
    g.fillStyle = `rgba(160,200,255,${0.16 * rise})`;
    g.beginPath();
    g.ellipse(px, py, 46 * s, 46 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
}
