// The photograph the fifth Short is about: a tomato stem with a cluster of
// aphids on it, a few pixels across.
//
// The insects are really drawn, at really that size — which is the point of
// the film. Zooming the picture can only make those few pixels bigger; it
// cannot add any. Nothing here is a model output.

/** The stem, as a function of how far up it we are. Exported so the colony can
 *  be put on it rather than beside it — and so the film knows where to look. */
export function stemPoint(t, width = 1000, height = 1250) {
  return {
    x: width * (0.2 + t * 0.55) + Math.sin(t * 2.4) * width * 0.03,
    y: height * (0.95 - t * 0.85),
  };
}

const COLONY_T = 0.63;

/** Where the cluster sits, as a fraction of the picture. */
export const APHIDS = (() => {
  const p = stemPoint(COLONY_T, 1, 1);
  return { x: p.x, y: p.y };
})();

export function leafPhoto({ width = 1000, height = 1250, grain = true } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const S = width / 1000;

  // Out-of-focus greenery behind: a wash, then soft blobs of light.
  const bg = g.createLinearGradient(0, 0, width * 0.4, height);
  bg.addColorStop(0, '#2f4423');
  bg.addColorStop(0.55, '#22361b');
  bg.addColorStop(1, '#16240f');
  g.fillStyle = bg; g.fillRect(0, 0, width, height);

  g.save();
  g.filter = `blur(${18 * S}px)`;
  for (let i = 0; i < 26; i += 1) {
    const x = ((i * 137) % 100) / 100 * width;
    const y = ((i * 71) % 100) / 100 * height;
    const r = (30 + ((i * 53) % 90)) * S;
    g.fillStyle = ['rgba(150,190,90,.22)', 'rgba(96,140,60,.28)', 'rgba(220,230,150,.14)'][i % 3];
    g.beginPath(); g.ellipse(x, y, r, r * 0.8, i, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  // A leaf across the bottom, softly out of focus.
  g.save();
  g.filter = `blur(${5 * S}px)`;
  drawLeaf(g, S, width * 0.3, height * 0.86, 420 * S, -0.22, '#3f6a2c');
  g.restore();

  drawStem(g, S, width, height);
  drawAphids(g, S, width, height);
  drawDew(g, S, width, height);

  // Vignette.
  const vig = g.createRadialGradient(width / 2, height * 0.45, width * 0.2, width / 2, height * 0.5, width * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = vig; g.fillRect(0, 0, width, height);

  if (grain) {
    const px = g.getImageData(0, 0, width, height);
    for (let i = 0; i < px.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 9;
      px.data[i] += n; px.data[i + 1] += n; px.data[i + 2] += n;
    }
    g.putImageData(px, 0, 0);
  }
  return c;
}

function drawLeaf(g, S, cx, cy, len, angle, colour) {
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(-len / 2, 0);
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const x = -len / 2 + t * len;
    const lobe = Math.sin(t * Math.PI) * len * 0.22 + Math.sin(t * 22) * len * 0.02;
    g.lineTo(x, -lobe);
  }
  for (let i = 20; i >= 0; i -= 1) {
    const t = i / 20;
    const x = -len / 2 + t * len;
    const lobe = Math.sin(t * Math.PI) * len * 0.22 + Math.sin(t * 19 + 1) * len * 0.02;
    g.lineTo(x, lobe);
  }
  g.closePath();
  g.fill();

  g.strokeStyle = 'rgba(200,225,150,.35)';
  g.lineWidth = 2.5 * S;
  g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
  g.lineWidth = 1.4 * S;
  for (let i = 1; i < 9; i += 1) {
    const x = -len / 2 + (i / 9) * len;
    const h = Math.sin((i / 9) * Math.PI) * len * 0.17;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + len * 0.05, -h); g.stroke();
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + len * 0.05, h); g.stroke();
  }
  g.restore();
}

function drawStem(g, S, width, height) {
  const path = (t) => stemPoint(t, width, height);

  // Body of the stem, drawn as a tapering ribbon.
  for (let i = 0; i < 200; i += 1) {
    const t = i / 199;
    const p = path(t);
    const w = (34 - t * 13) * S;
    const lit = g.createLinearGradient(p.x - w, p.y, p.x + w, p.y);
    lit.addColorStop(0, '#3d5c25');
    lit.addColorStop(0.35, '#6f8f3f');
    lit.addColorStop(0.7, '#557331');
    lit.addColorStop(1, '#2d451c');
    g.fillStyle = lit;
    g.beginPath(); g.ellipse(p.x, p.y, w, 5 * S, 0, 0, Math.PI * 2); g.fill();
  }

  // The fine hairs a tomato stem is covered in — the detail that says this is
  // a photograph of a plant and not a green line.
  g.strokeStyle = 'rgba(214,232,168,.5)';
  g.lineWidth = 1.1 * S;
  for (let i = 0; i < 260; i += 1) {
    const t = (i * 37 % 200) / 200;
    const p = path(t);
    const w = (34 - t * 13) * S;
    const side = i % 2 ? 1 : -1;
    const y = p.y + (((i * 53) % 100) / 100 - 0.5) * 9 * S;
    g.beginPath();
    g.moveTo(p.x + side * w * 0.92, y);
    g.lineTo(p.x + side * (w + (5 + (i % 4) * 2.5) * S), y - (3 + (i % 3) * 2) * S);
    g.stroke();
  }
}

/**
 * The colony, clustered on the stem the way aphids actually sit: packed along
 * it, overlapping, mostly on one side. Each insect is six or seven pixels
 * across at the size the picture is taken at — legible as a texture, not as an
 * animal.
 */
function drawAphids(g, S, width, height) {
  // A hash rather than a modulus: stepping i through a lattice put them in
  // rows, and a colony is a huddle.
  const seed = (i, k) => {
    const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  for (let i = 0; i < 34; i += 1) {
    const t = COLONY_T + (seed(i, 1) - 0.5) * 0.1;
    const p = stemPoint(t, width, height);
    const stemW = (34 - t * 13) * S;
    // Across the stem: most of them on it, a few strays on the near edge.
    const across = (seed(i, 2) - 0.5) * 2 * stemW * 1.15;
    const x = p.x + across;
    const y = p.y + (seed(i, 3) - 0.5) * 14 * S;
    const w = (3.4 + seed(i, 4) * 1.5) * S;
    const h = w * 0.72;
    const tilt = -0.9 + (seed(i, 5) - 0.5) * 1.9;   // roughly along the stem

    const pale = i % 6 === 0;
    g.fillStyle = pale
      ? 'rgba(96,112,44,.95)'
      : `rgba(${168 + (seed(i, 6) * 42 | 0)}, ${188 + (seed(i, 7) * 34 | 0)}, ${96 + (seed(i, 8) * 30 | 0)}, .96)`;
    g.beginPath(); g.ellipse(x, y, w, h, tilt, 0, Math.PI * 2); g.fill();

    // A darker head end and the pair of cornicles that make an aphid an aphid,
    // both well under a pixel once the picture is looked at whole.
    g.fillStyle = 'rgba(84,104,38,.55)';
    g.beginPath();
    g.ellipse(x + Math.cos(tilt) * w * 0.55, y + Math.sin(tilt) * w * 0.55, w * 0.34, h * 0.62, tilt, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,235,.35)';
    g.beginPath();
    g.ellipse(x - Math.cos(tilt) * w * 0.25, y - Math.sin(tilt) * w * 0.3, w * 0.32, h * 0.34, tilt, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(60,80,25,.65)';
    g.lineWidth = 0.7 * S;
    g.beginPath();
    g.moveTo(x - Math.cos(tilt) * w * 0.8, y - Math.sin(tilt) * w * 0.8);
    g.lineTo(x - Math.cos(tilt) * w * 1.35, y - Math.sin(tilt) * w * 1.35 - h * 0.5);
    g.stroke();
  }
}

function drawDew(g, S, width, height) {
  for (const [fx, fy, r] of [[0.62, 0.55, 7], [0.3, 0.62, 5], [0.52, 0.74, 9], [0.68, 0.3, 4]]) {
    const x = width * fx;
    const y = height * fy;
    g.fillStyle = 'rgba(230,245,220,.28)';
    g.beginPath(); g.arc(x, y, r * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.beginPath(); g.arc(x - r * 0.3 * S, y - r * 0.35 * S, r * 0.3 * S, 0, Math.PI * 2); g.fill();
  }
}
