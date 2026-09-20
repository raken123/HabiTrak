// Imagine, part two: drawing the picture the planner decided on.
//
// Everything here takes a 2D context and a plan. It runs unchanged in the
// Electron renderer, in the browser build, and in the ad harness, because a
// canvas context is a canvas context — which is also why the films can show
// real output instead of a stand-in.
//
//
// Why there is one geometry and two renderers
// ───────────────────────────────────────────
//
// Every object Hazelnut can draw is written down once, as a list of plain
// parts: ellipses, rectangles, polygons, strokes, runs of text. Neither model
// has its own tree.
//
// The models are the two functions that turn a part into pixels.
//
//   crisp (Hazelnut 5 Pro)  draws the part. A rectangle is a rectangle.
//   blob  (Hazelnut 2.5)    approximates it with a cluster of soft radial
//                           gradients, which is the only thing 2.5 ever knew
//                           how to do.
//
// That is not a stylistic filter bolted on afterwards. `blobPart` is
// structurally incapable of producing a hard edge or a straight line, so 2.5's
// weaknesses fall out of how it draws rather than being applied to the result:
// it cannot write, because a letter drawn as a cluster of blobs is not a
// letter, and it cannot do hands, because five fingers rendered this way merge
// into a mitten. The hand it draws has the wrong number of fingers on purpose
// — see `handParts` — because that is what the shipped model does, and an ad
// that showed otherwise would be selling something we do not have.

import { mulberry32 } from './imagine-plan.js';
import { UNTHOUGHT_WARNING } from './models.js';

/* ── entry point ─────────────────────────────────────────────────────────── */

/**
 * Draw a plan onto a context sized `plan.width` × `plan.height`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<import('./imagine-plan.js').planImage>} plan
 */
export function paint(ctx, plan) {
  const W = plan.width;
  const H = plan.height;
  const model = plan.model === 'hazelnut-5-pro' ? 'crisp' : 'blob';
  const rand = mulberry32(plan.seed ^ 0x9e3779b9);
  const env = { ctx, W, H, model, rand, plan, part: model === 'crisp' ? crispPart : blobPart, reserve: 0 };
  // Worked out before anything is drawn, so a document can lay itself out
  // above the disclaimer rather than underneath it.
  if (plan.unverified) env.reserve = warningBandHeight(env);

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  for (const layer of plan.layers) {
    switch (layer.kind) {
      case 'sky': paintSky(env, layer); break;
      case 'terrain': paintTerrain(env, layer); break;
      case 'object': paintParts(env, objectParts(layer, env), layer); break;
      case 'person': paintParts(env, personParts(layer, env), layer); break;
      case 'weather': paintWeather(env, layer); break;
      case 'document': paintDocument(env, layer.doc); break;
      case 'caption': paintCaption(env, layer); break;
      default: break;
    }
  }

  finish(env);

  // The warning is part of the picture, not part of the app around it: a
  // screenshot of an unchecked worksheet has to carry its own disclaimer,
  // because the screenshot is what gets sent to somebody else.
  //
  // It is driven by the plan rather than by the model, so it appears on the
  // pictures that actually claim something and not on a drawing of a hillside
  // that happens to have come from the same model on the same edition. A
  // warning printed on everything is a warning nobody reads.
  if (plan.unverified) paintWarningBand(env);

  ctx.restore();
  return plan;
}

/* ── the two renderers ───────────────────────────────────────────────────── */

/** Hazelnut 5 Pro. Draws the part it was given. */
function crispPart(env, part) {
  const { ctx } = env;
  ctx.save();
  if (part.alpha != null) ctx.globalAlpha = part.alpha;
  ctx.fillStyle = part.fill || '#888';
  ctx.strokeStyle = part.stroke || part.fill || '#888';

  switch (part.type) {
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(part.cx, part.cy, Math.abs(part.rx), Math.abs(part.ry), part.rot || 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'rect':
      roundRect(ctx, part.x, part.y, part.w, part.h, part.r || 0);
      ctx.fill();
      break;
    case 'poly':
      ctx.beginPath();
      part.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      break;
    case 'line':
      ctx.lineWidth = part.width || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      part.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      break;
    case 'text':
      drawRealText(env, part);
      break;
    default: break;
  }
  ctx.restore();
}

/**
 * Hazelnut 2.5. Approximates the part with soft blobs.
 *
 * Every branch here ends in `blob`, which is a radial gradient that fades to
 * nothing at its rim. That is the whole model: there is no code path in 2.5
 * that puts down a hard edge.
 */
function blobPart(env, part) {
  const { ctx } = env;
  ctx.save();
  ctx.globalAlpha = (part.alpha != null ? part.alpha : 1) * 0.96;
  const fill = part.fill || '#888';

  switch (part.type) {
    case 'ellipse':
      blob(env, part.cx, part.cy, Math.abs(part.rx) * 1.12, Math.abs(part.ry) * 1.12, fill, part.rot || 0);
      break;
    case 'rect': {
      // A rectangle becomes a row of overlapping round lumps, which is why
      // nothing 2.5 draws has a corner.
      const steps = Math.max(2, Math.round(Math.max(part.w, part.h) / Math.max(8, Math.min(part.w, part.h) * 0.55)));
      const horiz = part.w >= part.h;
      const r = Math.min(part.w, part.h) * 0.62;
      for (let i = 0; i < steps; i += 1) {
        const t = steps === 1 ? 0.5 : i / (steps - 1);
        const cx = horiz ? part.x + r + t * (part.w - r * 2) : part.x + part.w / 2;
        const cy = horiz ? part.y + part.h / 2 : part.y + r + t * (part.h - r * 2);
        blob(env, cx, cy, horiz ? r * 1.15 : part.w * 0.62, horiz ? part.h * 0.62 : r * 1.15, fill, 0);
      }
      break;
    }
    case 'poly': {
      // A ridge line is a polygon a thousand pixels wide and two hundred tall.
      // Collapsing it to one lump at its centre — which is what this used to do
      // — turned every mountain range into a brown hill. So the outline is
      // walked and packed with small blobs, and the inside is filled on a grid.
      // The result still has no hard edge anywhere, which is the point, but it
      // is recognisably the shape that was asked for.
      const xs = part.points.map((p) => p[0]);
      const ys = part.points.map((p) => p[1]);
      const x0 = Math.min(...xs); const x1 = Math.max(...xs);
      const y0 = Math.min(...ys); const y1 = Math.max(...ys);
      const w = x1 - x0; const h = y1 - y0;
      // Every size in here is relative to the shape. There is deliberately no
      // absolute floor: parts are drawn inside a scaled transform, so a
      // constant here is not a number of pixels and clamping to one turns a
      // cat into a cloud.
      const r = Math.max(Math.min(w, h) * 0.16, Math.max(w, h) * 0.025) || 1e-4;

      const step = r * 1.15;
      for (let gy = y0 + step / 2; gy < y1; gy += step) {
        for (let gx = x0 + step / 2; gx < x1; gx += step) {
          if (insidePoly(part.points, gx, gy)) blob(env, gx, gy, r * 1.25, r * 1.25, fill, 0);
        }
      }
      for (let i = 0; i < part.points.length; i += 1) {
        const [ax, ay] = part.points[i];
        const [bx, by] = part.points[(i + 1) % part.points.length];
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (r * 0.85)));
        for (let j = 0; j <= n; j += 1) {
          const t = j / n;
          blob(env, ax + (bx - ax) * t, ay + (by - ay) * t, r, r, fill, 0);
        }
      }
      break;
    }
    case 'line': {
      const w = (part.width || 2) * 1.5;
      for (let i = 0; i < part.points.length - 1; i += 1) {
        const [x0, y0] = part.points[i];
        const [x1, y1] = part.points[i + 1];
        const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (w * 0.6)));
        for (let j = 0; j <= n; j += 1) {
          const t = j / n;
          blob(env, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, w, part.stroke || part.fill || '#888', 0);
        }
      }
      break;
    }
    case 'text':
      drawFakeText(env, part);
      break;
    default: break;
  }
  ctx.restore();
}

/** One soft lump. The atom of Hazelnut 2.5. */
function blob(env, cx, cy, rx, ry, fill, rot = 0) {
  const { ctx } = env;
  const r = Math.max(rx, ry) || 1e-4;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.scale(rx / r, ry / r);
  const g = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
  g.addColorStop(0, withAlpha(fill, 1));
  g.addColorStop(0.62, withAlpha(fill, 0.95));
  g.addColorStop(1, withAlpha(fill, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * How big one unit of an object's local geometry is, as a fraction of the
 * frame's short side. Exported so anything that needs to find a drawn object
 * again afterwards — the advertising frames a close-up on a pair of hands —
 * can do the arithmetic from the same number the painter used.
 */
export const LAYER_UNIT = 0.16;

export function layerOrigin(plan, layer) {
  const unit = Math.min(plan.width, plan.height);
  return {
    x: layer.x * plan.width,
    y: layer.y * plan.height,
    scale: layer.scale * unit * LAYER_UNIT,
  };
}

function paintParts(env, parts, layer) {
  const x = layer.x * env.W;
  const y = layer.y * env.H;
  const s = layer.scale * Math.min(env.W, env.H) * LAYER_UNIT;
  env.ctx.save();
  env.ctx.translate(x, y);
  env.ctx.scale(s, s);
  for (const part of parts) env.part(env, part);
  env.ctx.restore();
}

/* ── text: the thing 2.5 cannot do ───────────────────────────────────────── */

const FONT_STACK = 'Georgia, "Times New Roman", serif';
const SANS_STACK = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function drawRealText(env, part) {
  const { ctx } = env;
  ctx.save();
  ctx.fillStyle = part.fill || '#222';
  ctx.textAlign = part.align || 'left';
  ctx.textBaseline = part.baseline || 'alphabetic';
  ctx.font = `${part.weight || 400} ${part.size}px ${part.sans ? SANS_STACK : FONT_STACK}`;
  ctx.fillText(part.text, part.x, part.y);
  ctx.restore();
}

/**
 * What Hazelnut 2.5 produces when asked for words.
 *
 * Letter-shaped marks in letter-shaped boxes, with the rhythm and the line
 * breaks of real text and none of the letters. It is deterministic — the same
 * string always produces the same wrong marks — because a generator that
 * reshuffled its gibberish on every redraw would be hiding the flaw rather
 * than showing it.
 */
function drawFakeText(env, part) {
  const { ctx } = env;
  const rand = mulberry32(hash(part.text) ^ (env.plan.seed >>> 3));
  const size = part.size;
  let x = part.x;
  const width = measureFake(part.text, size);
  if (part.align === 'center') x -= width / 2;
  else if (part.align === 'right') x -= width;

  ctx.save();
  ctx.fillStyle = part.fill || '#222';
  ctx.strokeStyle = part.fill || '#222';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, size * (part.weight >= 600 ? 0.17 : 0.11));

  for (const ch of part.text) {
    const advance = size * (ch === ' ' ? 0.32 : 0.56);
    if (ch !== ' ') {
      const h = size * (0.62 + rand() * 0.16);
      const top = part.y - h;
      const strokes = 2 + Math.floor(rand() * 2);
      ctx.beginPath();
      for (let i = 0; i < strokes; i += 1) {
        const x0 = x + size * (0.08 + rand() * 0.12);
        const x1 = x + advance - size * (0.08 + rand() * 0.12);
        const y0 = top + h * rand();
        const y1 = top + h * rand();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(
          (x0 + x1) / 2 + (rand() - 0.5) * size * 0.3,
          (y0 + y1) / 2 + (rand() - 0.5) * size * 0.4,
          x1, y1,
        );
      }
      ctx.stroke();
    }
    x += advance;
  }
  ctx.restore();
}

function measureFake(text, size) {
  let w = 0;
  for (const ch of text) w += size * (ch === ' ' ? 0.32 : 0.56);
  return w;
}

/** Whichever the current model can manage. */
function text(env, part) {
  env.part(env, { ...part, type: 'text' });
}

/* ── sky, ground, weather ────────────────────────────────────────────────── */

function paintSky(env, layer) {
  const { ctx, W, H } = env;
  const [top, bottom] = layer.palette.sky;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const sunX = W * (0.24 + env.rand() * 0.52);
  const sunY = H * (layer.time === 'golden' || layer.time === 'dawn' ? 0.42 : 0.2);
  if (layer.time === 'night') {
    for (let i = 0; i < 90; i += 1) {
      const x = env.rand() * W;
      const y = env.rand() * H * 0.6;
      const r = env.rand() * 1.6 + 0.4;
      ctx.globalAlpha = 0.3 + env.rand() * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(W, H) * 0.42);
  glow.addColorStop(0, withAlpha(layer.palette.sun, layer.time === 'night' ? 0.5 : 0.85));
  glow.addColorStop(1, withAlpha(layer.palette.sun, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  env.part(env, {
    type: 'ellipse', cx: sunX, cy: sunY,
    rx: Math.min(W, H) * (layer.time === 'night' ? 0.035 : 0.05),
    ry: Math.min(W, H) * (layer.time === 'night' ? 0.035 : 0.05),
    fill: layer.palette.sun,
  });

  if (layer.weather !== 'clear') {
    const clouds = layer.weather === 'storm' ? 7 : 4;
    for (let i = 0; i < clouds; i += 1) {
      const cx = env.rand() * W;
      const cy = H * (0.08 + env.rand() * 0.3);
      const rx = W * (0.1 + env.rand() * 0.14);
      const fill = layer.weather === 'storm' ? '#4a4f58' : withAlpha('#ffffff', 0.75);
      env.part(env, { type: 'ellipse', cx, cy, rx, ry: rx * 0.36, fill, alpha: 0.85 });
      env.part(env, { type: 'ellipse', cx: cx + rx * 0.4, cy: cy - rx * 0.12, rx: rx * 0.6, ry: rx * 0.3, fill, alpha: 0.8 });
    }
  }
}

function paintTerrain(env, layer) {
  const { ctx, W, H } = env;
  const rand = mulberry32(layer.seed);
  const horizon = H * 0.66;
  const ground = layer.palette.ground;

  const ridge = (baseY, amp, fill, steps = 14) => {
    const pts = [[0, H]];
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * W;
      const y = baseY - Math.sin((i / steps) * Math.PI * (1 + rand())) * amp * (0.4 + rand() * 0.9);
      pts.push([x, y]);
    }
    pts.push([W, H]);
    env.part(env, { type: 'poly', points: pts, fill });
  };

  switch (layer.form) {
    case 'mountains':
      ridge(horizon * 0.82, H * 0.2, shade(ground, 0.55), 6);
      ridge(horizon * 0.95, H * 0.14, shade(ground, 0.75), 7);
      ridge(horizon, H * 0.05, ground, 10);
      break;
    case 'sea':
    case 'lake': {
      env.part(env, { type: 'rect', x: 0, y: horizon, w: W, h: H - horizon, fill: shade(layer.palette.sky[0], 0.72) });
      for (let i = 0; i < 26; i += 1) {
        const y = horizon + (i / 26) ** 1.6 * (H - horizon);
        const w = W * (0.06 + rand() * 0.2);
        env.part(env, {
          type: 'line', width: Math.max(1.2, (i / 26) * 5),
          points: [[rand() * W, y], [rand() * W + w, y]],
          stroke: withAlpha('#ffffff', 0.18 + rand() * 0.2),
        });
      }
      break;
    }
    case 'city': {
      env.part(env, { type: 'rect', x: 0, y: horizon, w: W, h: H - horizon, fill: shade(ground, 0.5) });
      let x = 0;
      while (x < W) {
        const bw = W * (0.04 + rand() * 0.07);
        const bh = H * (0.08 + rand() * 0.3);
        env.part(env, { type: 'rect', x, y: horizon - bh, w: bw * 0.92, h: bh, fill: shade(ground, 0.4 + rand() * 0.3) });
        x += bw;
      }
      break;
    }
    case 'forest':
      ridge(horizon, H * 0.04, shade(ground, 0.6), 10);
      for (let i = 0; i < 26; i += 1) {
        const x = rand() * W;
        const s = H * (0.05 + rand() * 0.07);
        env.part(env, { type: 'poly', points: [[x, horizon - s * 2.2], [x - s * 0.55, horizon], [x + s * 0.55, horizon]], fill: shade(ground, 0.5 + rand() * 0.4) });
      }
      break;
    case 'desert':
      ridge(horizon, H * 0.06, '#d8b380', 5);
      ridge(horizon * 1.08, H * 0.04, '#c79d68', 6);
      break;
    case 'field':
    case 'hills':
    default:
      ridge(horizon * 0.98, H * 0.07, shade(ground, 0.7), 5);
      ridge(horizon, H * 0.04, ground, 6);
      break;
  }
}

function paintWeather(env, layer) {
  const { W, H } = env;
  const rand = mulberry32(layer.seed);
  if (layer.what === 'rain' || layer.what === 'storm') {
    for (let i = 0; i < 260; i += 1) {
      const x = rand() * W; const y = rand() * H;
      const len = H * (0.015 + rand() * 0.025);
      env.part(env, { type: 'line', width: 1.2, points: [[x, y], [x - len * 0.25, y + len]], stroke: withAlpha('#dbe7f2', 0.5) });
    }
  } else if (layer.what === 'snow') {
    for (let i = 0; i < 220; i += 1) {
      const r = 1 + rand() * 2.6;
      env.part(env, { type: 'ellipse', cx: rand() * W, cy: rand() * H, rx: r, ry: r, fill: withAlpha('#ffffff', 0.85) });
    }
  } else if (layer.what === 'fog') {
    const { ctx } = env;
    for (let i = 0; i < 7; i += 1) {
      const y = H * (0.4 + rand() * 0.5);
      const g = ctx.createLinearGradient(0, y - H * 0.1, 0, y + H * 0.1);
      g.addColorStop(0, withAlpha('#ffffff', 0));
      g.addColorStop(0.5, withAlpha('#ffffff', 0.32));
      g.addColorStop(1, withAlpha('#ffffff', 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - H * 0.1, W, H * 0.2);
    }
  }
}

/* ── things ──────────────────────────────────────────────────────────────── */

function objectParts(layer, env) {
  const rand = mulberry32(layer.seed);
  const tint = layer.tint;
  switch (layer.what) {
    case 'tree': return [
      { type: 'rect', x: -0.09, y: -0.6, w: 0.18, h: 0.65, fill: '#6b4b32', r: 0.04 },
      { type: 'ellipse', cx: 0, cy: -0.95, rx: 0.62, ry: 0.55, fill: tint || '#3f6f42' },
      { type: 'ellipse', cx: -0.34, cy: -0.7, rx: 0.4, ry: 0.34, fill: tint || '#477a49' },
      { type: 'ellipse', cx: 0.36, cy: -0.72, rx: 0.38, ry: 0.32, fill: tint || '#38653c' },
    ];
    case 'house': return [
      { type: 'rect', x: -0.6, y: -0.8, w: 1.2, h: 0.82, fill: tint || '#d9cbb4' },
      { type: 'poly', points: [[-0.72, -0.78], [0, -1.32], [0.72, -0.78]], fill: '#8a4a3c' },
      { type: 'rect', x: -0.18, y: -0.42, w: 0.36, h: 0.44, fill: '#5a4432', r: 0.03 },
      { type: 'rect', x: 0.24, y: -0.66, w: 0.26, h: 0.24, fill: '#9fc4d8' },
      { type: 'rect', x: -0.5, y: -0.66, w: 0.26, h: 0.24, fill: '#9fc4d8' },
    ];
    case 'car': return [
      { type: 'rect', x: -0.85, y: -0.4, w: 1.7, h: 0.42, fill: tint || '#b23b2e', r: 0.12 },
      { type: 'poly', points: [[-0.5, -0.4], [-0.3, -0.78], [0.36, -0.78], [0.56, -0.4]], fill: tint || '#9c3226' },
      { type: 'ellipse', cx: -0.48, cy: 0.04, rx: 0.2, ry: 0.2, fill: '#2b2b30' },
      { type: 'ellipse', cx: 0.48, cy: 0.04, rx: 0.2, ry: 0.2, fill: '#2b2b30' },
    ];
    case 'boat': return [
      { type: 'poly', points: [[-0.8, -0.05], [0.8, -0.05], [0.55, 0.3], [-0.55, 0.3]], fill: tint || '#7a4b30' },
      { type: 'line', width: 0.05, points: [[0, -0.05], [0, -1.1]], stroke: '#5b4130' },
      { type: 'poly', points: [[0.04, -1.05], [0.62, -0.12], [0.04, -0.12]], fill: '#f0ece2' },
    ];
    case 'cat': return [
      { type: 'ellipse', cx: 0, cy: -0.22, rx: 0.5, ry: 0.32, fill: tint || '#6d6a66' },
      { type: 'ellipse', cx: -0.42, cy: -0.5, rx: 0.26, ry: 0.24, fill: tint || '#6d6a66' },
      { type: 'poly', points: [[-0.6, -0.68], [-0.52, -0.94], [-0.38, -0.68]], fill: tint || '#6d6a66' },
      { type: 'poly', points: [[-0.34, -0.7], [-0.24, -0.92], [-0.14, -0.66]], fill: tint || '#6d6a66' },
      { type: 'line', width: 0.06, points: [[0.46, -0.3], [0.78, -0.62], [0.68, -0.86]], stroke: tint || '#6d6a66' },
    ];
    case 'dog': return [
      { type: 'ellipse', cx: 0, cy: -0.24, rx: 0.54, ry: 0.3, fill: tint || '#a97f4e' },
      { type: 'ellipse', cx: -0.5, cy: -0.46, rx: 0.28, ry: 0.22, fill: tint || '#a97f4e' },
      { type: 'ellipse', cx: -0.66, cy: -0.52, rx: 0.12, ry: 0.18, fill: '#8a6338' },
      { type: 'line', width: 0.07, points: [[0.5, -0.34], [0.8, -0.56]], stroke: tint || '#a97f4e' },
    ];
    case 'bird': return [
      { type: 'line', width: 0.06, points: [[-0.5, 0], [-0.2, -0.24], [0.1, 0]], stroke: tint || '#33383f' },
      { type: 'line', width: 0.06, points: [[0.1, 0], [0.4, -0.24], [0.7, 0]], stroke: tint || '#33383f' },
    ];
    case 'flower': return [
      { type: 'line', width: 0.05, points: [[0, 0], [0, -0.7]], stroke: '#3f6f42' },
      ...[0, 1, 2, 3, 4].map((i) => ({
        type: 'ellipse',
        cx: Math.cos((i / 5) * Math.PI * 2) * 0.26,
        cy: -0.76 + Math.sin((i / 5) * Math.PI * 2) * 0.26,
        rx: 0.2, ry: 0.2, fill: tint || '#d06a86',
      })),
      { type: 'ellipse', cx: 0, cy: -0.76, rx: 0.14, ry: 0.14, fill: '#e3c24f' },
    ];
    case 'cup': return [
      { type: 'rect', x: -0.42, y: -0.6, w: 0.84, h: 0.66, fill: tint || '#e7e2d8', r: 0.1 },
      { type: 'ellipse', cx: 0, cy: -0.6, rx: 0.42, ry: 0.12, fill: '#4a2f1e' },
      { type: 'line', width: 0.08, points: [[0.44, -0.44], [0.66, -0.34], [0.44, -0.16]], stroke: tint || '#e7e2d8' },
    ];
    case 'balloon': return [
      { type: 'ellipse', cx: 0, cy: -0.9, rx: 0.42, ry: 0.5, fill: tint || '#c8402f' },
      { type: 'line', width: 0.02, points: [[0, -0.4], [0.06, 0.1], [-0.02, 0.5]], stroke: '#555' },
    ];
    case 'lighthouse': return [
      { type: 'poly', points: [[-0.28, 0], [-0.18, -1.2], [0.18, -1.2], [0.28, 0]], fill: '#eae4d8' },
      { type: 'rect', x: -0.22, y: -0.86, w: 0.44, h: 0.16, fill: '#b23b2e' },
      { type: 'rect', x: -0.2, y: -1.42, w: 0.4, h: 0.24, fill: '#3b4149', r: 0.04 },
    ];
    case 'windmill': return [
      { type: 'poly', points: [[-0.16, 0], [-0.08, -1.1], [0.08, -1.1], [0.16, 0]], fill: '#e4e0d6' },
      ...[0, 1, 2].map((i) => ({
        type: 'line', width: 0.05,
        points: [[0, -1.1], [Math.cos(i * 2.1 + rand()) * 0.7, -1.1 + Math.sin(i * 2.1 + rand()) * 0.7]],
        stroke: '#6f7278',
      })),
    ];
    default: return [{ type: 'ellipse', cx: 0, cy: -0.4, rx: 0.5, ry: 0.5, fill: tint || '#8b8d93' }];
  }
}

/**
 * A person, and the hands question.
 *
 * `handParts` is where the two models visibly part company. Hazelnut 5 Pro is
 * handed five fingers and draws five. Hazelnut 2.5 is handed six or seven,
 * because that is what it does — and then draws them as blobs that partly fuse,
 * which is what that failure actually looks like.
 */
function personParts(layer, env) {
  const rand = mulberry32(layer.seed);
  const skin = ['#e0b48f', '#c98d63', '#8d5a3b', '#f0cdb0', '#6f452c'][Math.floor(rand() * 5)];
  const top = ['#3a6ea8', '#4a6d52', '#8c4a54', '#3e4350', '#a2703f'][Math.floor(rand() * 5)];
  const hair = ['#2a2118', '#4a3524', '#7a5c3a', '#1d1a17', '#8d8478'][Math.floor(rand() * 5)];

  const parts = [
    { type: 'poly', points: [[-0.52, 0.2], [-0.4, -0.72], [0.4, -0.72], [0.52, 0.2]], fill: top },
    { type: 'ellipse', cx: 0, cy: -0.98, rx: 0.3, ry: 0.36, fill: skin },
    { type: 'ellipse', cx: 0, cy: -1.18, rx: 0.32, ry: 0.24, fill: hair },
    { type: 'ellipse', cx: -0.11, cy: -1.0, rx: 0.035, ry: 0.045, fill: '#2b2b30' },
    { type: 'ellipse', cx: 0.11, cy: -1.0, rx: 0.035, ry: 0.045, fill: '#2b2b30' },
  ];

  if (layer.hands) {
    parts.push(...handParts(env, -0.62, -0.1, skin, rand));
    parts.push(...handParts(env, 0.62, -0.1, skin, rand));
  }
  return parts;
}

/**
 * How many fingers this renderer will put on a hand.
 *
 * Exported because it is the one claim the advertising makes that you cannot
 * check by looking at a soft-edged blob, and a claim in an ad should be
 * checkable by a test rather than by squinting. Hazelnut 5 Pro counts to five.
 * Hazelnut 2.5 does not count at all.
 */
export function fingerCount(model, rand = Math.random) {
  return model === 'crisp' || model === 'hazelnut-5-pro' ? 5 : 6 + Math.floor(rand() * 2);
}

function handParts(env, cx, cy, skin, rand) {
  const fingers = fingerCount(env.model, rand);
  const parts = [{ type: 'ellipse', cx, cy, rx: 0.17, ry: 0.19, fill: skin }];
  for (let i = 0; i < fingers; i += 1) {
    const a = -Math.PI * 0.82 + (i / Math.max(1, fingers - 1)) * Math.PI * 0.66;
    parts.push({
      type: 'line', width: 0.075,
      points: [[cx + Math.cos(a) * 0.1, cy + Math.sin(a) * 0.1],
               [cx + Math.cos(a) * 0.3, cy + Math.sin(a) * 0.3]],
      stroke: skin,
    });
  }
  return parts;
}

/* ── documents ───────────────────────────────────────────────────────────── */

/**
 * Where each question sits on the sheet.
 *
 * Exported because the advertising points at one of them — the division by
 * zero that the trial's unthinking pass lets through — and a film that
 * recomputed this layout for itself would drift out of step with the picture
 * the moment either changed. One definition, two readers.
 */
export function documentRows(plan) {
  const doc = plan.layers.find((l) => l.kind === 'document')?.doc;
  if (!doc || !doc.questions.length) return [];
  const W = plan.width;
  const H = plan.height - (plan.unverified ? estimateBandHeight(plan) : 0);
  const m = Math.min(W, H) * 0.08;
  const unit = Math.min(W, H);
  const startY = m * 3.1;
  const step = (H - startY - m * 1.4) / doc.questions.length;
  return doc.questions.map((q, i) => {
    const y = startY + step * (i + 0.5);
    return {
      question: q,
      index: i,
      x: m * 1.3,
      y: y - unit * 0.042,
      width: W - m * 2.6,
      height: unit * 0.058,
      baseline: y,
    };
  });
}

/**
 * The band's height without a context to measure with — used by
 * `documentRows`, which callers outside the painter reach for. It assumes the
 * wrap that `wrapLines` produces at this width; `warningBandHeight` measures it
 * properly when a context is in hand, and the two are kept close by the
 * document tests.
 */
function estimateBandHeight(plan) {
  const unit = Math.min(plan.width, plan.height);
  const pad = unit * 0.028;
  const headSize = Math.max(9, unit * 0.028);
  const bodySize = Math.max(8, unit * 0.023);
  // Roughly half a character per pixel of body size, which is close enough for
  // a layout reservation and always errs towards leaving more room.
  const perLine = Math.max(12, Math.floor((plan.width - pad * 2) / (bodySize * 0.5)));
  const lines = Math.max(1, Math.ceil(UNTHOUGHT_WARNING.length / perLine));
  return pad * 2 + headSize * 1.25 + lines * bodySize * 1.28;
}

/**
 * A sign is not a document on A4. It is a board on a wall with a few large
 * words on it, and rendering it as a page of paper wasted most of the frame on
 * white — which also made it useless as a demonstration of the one thing 2.5
 * cannot do, because the lettering was too small to see failing.
 */
function paintSign(env, doc) {
  const { ctx, W, H } = env;
  const unit = Math.min(W, H);
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#49505a');
  wall.addColorStop(1, '#333941');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  const bw = W * 0.84;
  const bh = (H - env.reserve) * 0.5;
  const bx = (W - bw) / 2;
  const by = ((H - env.reserve) - bh) / 2;

  env.part(env, { type: 'rect', x: bx + unit * 0.012, y: by + unit * 0.016, w: bw, h: bh, fill: 'rgba(0,0,0,0.35)', r: unit * 0.02 });
  env.part(env, { type: 'rect', x: bx, y: by, w: bw, h: bh, fill: '#1f4a3c', r: unit * 0.02 });
  env.part(env, {
    type: 'rect', x: bx + unit * 0.022, y: by + unit * 0.022,
    w: bw - unit * 0.044, h: bh - unit * 0.044, fill: 'rgba(255,255,255,0.05)', r: unit * 0.012,
  });

  const lines = doc.lines || [];
  const titleY = by + bh * (lines.length ? 0.42 : 0.58);
  text(env, {
    x: W / 2, y: titleY, size: unit * 0.13, text: doc.title,
    fill: '#f4f0e4', align: 'center', weight: 700, sans: true,
  });
  lines.forEach((line, i) => {
    text(env, {
      x: W / 2, y: by + bh * 0.66 + i * unit * 0.075, size: unit * 0.052,
      text: line, fill: '#c9d6cc', align: 'center', sans: true,
    });
  });
}

function paintDocument(env, doc) {
  if (doc.kind === 'sign') return paintSign(env, doc);
  const { ctx, W } = env;
  const H = env.H - env.reserve;
  const m = Math.min(W, H) * 0.08;
  ctx.fillStyle = '#f6f3ec';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(m * 0.6, m * 0.6, W - m * 1.2, H - m * 1.2);
  ctx.strokeStyle = '#d8d3c8';
  ctx.lineWidth = 1;
  ctx.strokeRect(m * 0.6, m * 0.6, W - m * 1.2, H - m * 1.2);

  const unit = Math.min(W, H);
  text(env, { x: W / 2, y: m * 1.9, size: unit * 0.062, text: doc.title, fill: '#1d2026', align: 'center', weight: 700 });
  env.part(env, { type: 'line', width: 2, points: [[m * 1.2, m * 2.25], [W - m * 1.2, m * 2.25]], stroke: '#c9c3b6' });

  if (doc.questions.length) {
    const startY = m * 3.1;
    const step = (H - startY - m * 1.4) / doc.questions.length;
    doc.questions.forEach((q, i) => {
      const y = startY + step * (i + 0.5);
      text(env, { x: m * 1.3, y, size: unit * 0.042, text: `${i + 1}.  ${q.text}`, fill: '#23262c' });
      text(env, { x: W - m * 1.9, y, size: unit * 0.042, text: q.answer, fill: '#3a6ea8', align: 'right', weight: 600 });
      env.part(env, { type: 'line', width: 1.5, points: [[W - m * 3.1, y + unit * 0.012], [W - m * 1.3, y + unit * 0.012]], stroke: '#ded8cb' });
    });
  } else {
    doc.lines.forEach((line, i) => {
      text(env, { x: W / 2, y: m * 3.4 + i * unit * 0.085, size: unit * 0.05, text: line, fill: '#3a3d44', align: 'center' });
    });
  }
}

function paintCaption(env, layer) {
  const { W, H } = env;
  const unit = Math.min(W, H);
  env.part(env, { type: 'rect', x: W * 0.12, y: H * 0.8, w: W * 0.76, h: unit * 0.12, fill: 'rgba(12,14,18,0.62)', r: unit * 0.02 });
  text(env, { x: W / 2, y: H * 0.8 + unit * 0.082, size: unit * 0.058, text: layer.text, fill: '#f4f1ea', align: 'center', weight: 700, sans: true });
}

/* ── finishing ───────────────────────────────────────────────────────────── */

function finish(env) {
  const { ctx, W, H, model } = env;
  if (model === 'blob') {
    // 2.5's whole output goes through a softening pass. It is why nothing it
    // makes ever looks quite in focus.
    if (typeof ctx.filter === 'string') {
      ctx.save();
      ctx.filter = `blur(${Math.max(1, Math.min(W, H) * 0.004)}px)`;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,240,220,0.10)');
    g.addColorStop(1, 'rgba(40,30,60,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.20)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function bandMetrics(env) {
  const { W, H } = env;
  const unit = Math.min(W, H);
  const pad = unit * 0.028;
  return {
    pad,
    headSize: Math.max(9, unit * 0.028),
    bodySize: Math.max(8, unit * 0.023),
    get lineHeight() { return this.bodySize * 1.28; },
    maxWidth: W - pad * 2,
  };
}

/**
 * How tall the disclaimer needs to be. Measured rather than assumed: a fixed
 * height and a variable-length warning is how disclaimers end up clipped,
 * which is the same as not having one.
 */
function warningBandHeight(env) {
  const { ctx } = env;
  const m = bandMetrics(env);
  ctx.save();
  ctx.font = `400 ${m.bodySize}px ${SANS_STACK}`;
  const lines = wrapLines(ctx, UNTHOUGHT_WARNING, m.maxWidth);
  ctx.restore();
  return m.pad * 2 + m.headSize * 1.25 + lines.length * m.lineHeight;
}

function paintWarningBand(env) {
  const { ctx, W, H } = env;
  const { pad, headSize, bodySize, lineHeight, maxWidth } = bandMetrics(env);

  ctx.save();
  ctx.font = `400 ${bodySize}px ${SANS_STACK}`;
  const lines = wrapLines(ctx, UNTHOUGHT_WARNING, maxWidth);
  const h = pad * 2 + headSize * 1.25 + lines.length * lineHeight;

  ctx.fillStyle = 'rgba(146,64,14,0.95)';
  ctx.fillRect(0, H - h, W, h);
  ctx.fillStyle = '#fff6e8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${headSize}px ${SANS_STACK}`;
  ctx.fillText('NOT CHECKED', pad, H - h + pad);
  ctx.font = `400 ${bodySize}px ${SANS_STACK}`;
  lines.forEach((line, i) => {
    ctx.fillText(line, pad, H - h + pad + headSize * 1.25 + i * lineHeight);
  });
  ctx.restore();
}

function wrapLines(ctx, str, maxWidth) {
  const out = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; }
    else line = test;
  }
  if (line) out.push(line);
  return out;
}

/** Ray casting, for filling a polygon with blobs. */
function insidePoly(points, x, y) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* ── colour helpers ──────────────────────────────────────────────────────── */

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function withAlpha(colour, a) {
  if (typeof colour !== 'string') return `rgba(136,136,136,${a})`;
  if (colour.startsWith('rgba')) return colour;
  const { r, g, b } = toRgb(colour);
  return `rgba(${r},${g},${b},${a})`;
}

function shade(colour, factor) {
  const { r, g, b } = toRgb(colour);
  const f = (n) => Math.max(0, Math.min(255, Math.round(n * factor)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function toRgb(colour) {
  if (colour.startsWith('#')) {
    const hex = colour.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }
  const m = colour.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(',').map((n) => parseInt(n, 10));
    return { r, g, b };
  }
  return { r: 136, g: 136, b: 136 };
}

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
