// The second Short: an office PC becomes a gaming PC.
//
// What is real here and what is not, as before:
//
//   real  the bad paste. `badComposite` performs an actual composite badly —
//         wrong scale, wrong white balance, no contact shadow, a halo left
//         where the old machine was. Every one of those is a real operation,
//         not a drawing of a mistake. The person is the one failing, not any
//         particular piece of software: no product is named or shown, because
//         depicting a named editor producing this would be a claim about that
//         editor, and an invented one.
//   real  the editor. That is Hazelnut, running its own code — the Magic Draw
//         brush, the price quoted from what was actually painted, the confirm
//         dialog and the progress.
//   not   the final frame. It is the same room drawn with the other machine in
//         it, standing in for a generation this machine cannot make. Replace it
//         with a real Magic Draw result before this is used anywhere.

import { deskScene, badComposite, pcCutout, pcRegion, PC_RECT } from './desk-scene.js';

const $ = (id) => document.getElementById(id);

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a, b, p) => a + (b - a) * p;
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const back = (p) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

function window_(t, a, b, fadeIn = 0.3, fadeOut = 0.3) {
  if (t < a - fadeIn || t > b + fadeOut) return 0;
  if (t < a) return easeOut(clamp01((t - (a - fadeIn)) / fadeIn));
  if (t > b) return 1 - easeOut(clamp01((t - b) / fadeOut));
  return 1;
}
const span = (t, a, b, ease = easeInOut) => ease(clamp01((t - a) / (b - a)));

const DURATION = 45;
const W = 1000;
const H = 1250;
const REVEAL_AT = 33.9;

let office = null;
let gaming = null;
let cutout = null;
let region = null;
const composites = new Map();

function buildPlates() {
  office = deskScene({ width: W, height: H, pc: 'office' });
  gaming = deskScene({ width: W, height: H, pc: 'gaming' });
  cutout = pcCutout(W, H);
  region = pcRegion(W, H);
  // The paste is expensive to redo every frame, so it is built at a handful of
  // stages and held.
  for (let i = 0; i <= 10; i += 1) {
    composites.set(i, badComposite(office, cutout, region, { progress: i / 10 }));
  }
}

function paintPlate(t) {
  const ctx = $('photo').getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (t >= REVEAL_AT) { ctx.drawImage(gaming, 0, 0); return; }

  const pasting = span(t, 6.8, 14.6, (p) => p);
  if (pasting <= 0) { ctx.drawImage(office, 0, 0); return; }
  ctx.drawImage(composites.get(Math.round(pasting * 10)) || office, 0, 0);
}

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.4, 3.4, 'Work gave you<br>this machine.'],
  [3.8, 6.6, 'So you try to paste<br>a better one in.'],
  [7.0, 10.0, 'Cut it out.'],
  [10.2, 12.6, 'Paste it in.'],
  [12.8, 15.0, 'Fix the light.'],
  [15.4, 18.4, 'It is a sticker,<br>not a photograph.'],
  [19.0, 21.6, 'Or just <em>draw</em> it.'],
  [22.2, 25.4, 'Scribble the shape<br>you want.'],
  [26.0, 29.0, 'Say what it is,<br>in one line.'],
  [29.4, 33.4, 'Press Submit.'],
  [34.4, 39.8, 'Same desk. Same light.<br><em>New machine.</em>'],
];

const BOTTOM = [
  [1.2, 3.4, 'You wanted a gaming PC.'],
  [7.4, 14.6, 'Scale. Rotate. Undo. Repeat.'],
  [22.6, 25.4, 'It does not have to be good.'],
  [30.0, 33.4, 'Priced on what you actually painted.'],
];

function say(list, node, textNode, t) {
  let shown = 0;
  let text = '';
  for (const [a, b, copy] of list) {
    const o = window_(t, a, b, 0.32, 0.32);
    if (o > shown) { shown = o; text = copy; }
  }
  if (text && textNode.dataset.copy !== text) {
    textNode.innerHTML = text;
    textNode.dataset.copy = text;
  }
  node.style.opacity = shown;
  node.style.transform = `translateY(${lerp(24, 0, shown)}px)`;
  return shown;
}

// ── driving the editor ─────────────────────────────────────────────────────

const hzDoc = () => $('hz').contentDocument;

/** Image pixel -> a point in the editor's stage, mirroring Viewport.fit(). */
function docToStage(px, py) {
  const stage = hzDoc()?.getElementById('stage');
  if (!stage) return { x: 0, y: 0 };
  const r = stage.getBoundingClientRect();
  const scale = Math.min(1, Math.min((r.width - 48) / W, (r.height - 48) / H));
  return {
    x: (r.width - W * scale) / 2 + px * scale,
    y: (r.height - H * scale) / 2 + py * scale,
  };
}

function pointer(type, sx, sy, buttons = 1) {
  const doc = hzDoc();
  const stage = doc?.getElementById('stage');
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  stage.dispatchEvent(new doc.defaultView.PointerEvent(type, {
    clientX: r.left + sx, clientY: r.top + sy,
    bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
    pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : buttons,
  }));
}

const clickIn = (sel) => hzDoc()?.querySelector(sel)?.click();
const selectTool = (id) => clickIn(`.tool[data-tool="${id}"]`);

function setField(sel, value) {
  const doc = hzDoc();
  const input = doc?.querySelector(sel);
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
}

const cues = [];
const tracks = [];
const at = (t, fn) => cues.push({ t, fn, done: false });
const over = (a, b, fn) => tracks.push({ a, b, fn });

/** A stroke through points given in image coordinates. */
function stroke(a, b, points, colour, size) {
  at(a - 0.2, () => {
    if (colour) clickIn(`.swatch[title="${colour}"]`);
    if (size) setField('.optionsbar input[type="range"]', size);
  });
  at(a, () => { const p = docToStage(points[0][0], points[0][1]); pointer('pointerdown', p.x, p.y); });
  over(a, b, (p) => {
    const eased = easeInOut(p) * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(eased));
    const f = eased - i;
    const s = docToStage(
      lerp(points[i][0], points[i + 1][0], f),
      lerp(points[i][1], points[i + 1][1], f),
    );
    pointer('pointermove', s.x, s.y);
  });
  at(b, () => { const p = docToStage(points.at(-1)[0], points.at(-1)[1]); pointer('pointerup', p.x, p.y, 0); });
}

const R = { x: PC_RECT.x * W, y: PC_RECT.y * H, w: PC_RECT.w * W, h: PC_RECT.h * H };
const box = [
  [R.x + 6, R.y + 10], [R.x + R.w - 6, R.y - 4], [R.x + R.w - 2, R.y + R.h - 8],
  [R.x + 10, R.y + R.h - 2], [R.x + 4, R.y + 14],
];
const ring = (cx, cy, r) => Array.from({ length: 14 }, (_, i) => {
  const a = (i / 13) * Math.PI * 2;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});

at(20.2, () => clickIn('[data-command="file:open"]'));
at(21.4, () => selectTool('magic-draw'));

// The sketch: a box for the case, three rings for the fans, a bar for the card.
stroke(22.6, 24.5, box, '#3d9dd6', 30);
stroke(24.8, 25.8, ring(R.x + 72, R.y + 80, 40), '#e05a8f', 24);
stroke(25.9, 26.9, ring(R.x + 72, R.y + 162, 40), '#8b5cf6', 24);
stroke(27.0, 28.0, ring(R.x + 72, R.y + 244, 40), '#3d9dd6', 24);
stroke(28.1, 28.8, [[R.x + 132, R.y + 152], [R.x + R.w - 20, R.y + 144]], '#f2c14e', 26);

over(29.1, 31.6, (p) => setField('.optionsbar input[type="text"]',
  'a gaming PC with a glass side panel and RGB fans'.slice(0, Math.round(easeInOut(p) * 47))));

at(32.0, () => {
  const submit = [...hzDoc().querySelectorAll('.optionsbar .btn')].find((b) => b.textContent.startsWith('Submit'));
  submit?.click();
});
at(33.1, () => {
  const use = [...hzDoc().querySelectorAll('.modal__foot .btn')].find((b) => b.textContent.startsWith('Use'));
  use?.click();
});

// ── placing the editor ─────────────────────────────────────────────────────

// Constants of the slab's layout, so the camera maths below is readable.
const APP_TOP = 620;        // .app top, from short2.css
const SHELL_INSET = 30;     // 20px auto margin + 10px shell padding
const IFRAME_SCALE = 0.803; // .app iframe transform
const STAGE = { x: 52, y: 78, w: 940, h: 616 };  // the canvas area inside the editor

// Where the canvas centre sits in film coordinates when the slab is at rest.
const CANVAS_CX = SHELL_INSET + IFRAME_SCALE * (STAGE.x + STAGE.w / 2);
const CANVAS_CY = APP_TOP + 10 + IFRAME_SCALE * (STAGE.y + STAGE.h / 2);

function placeApp(scale, t) {
  // Sit the slab low while it is whole, and centre the canvas once we are in.
  const targetX = 540;
  const targetY = lerp(1010, 890, span(t, 21.6, 24.0, easeInOut));
  return [targetX - scale * CANVAS_CX, targetY - scale * CANVAS_CY];
}

// ── per-frame ──────────────────────────────────────────────────────────────

function paint(t) {
  paintPlate(t);

  const plateOn = window_(t, 0.2, 18.6, 0.5, 0.6) || window_(t, REVEAL_AT - 0.1, 40.0, 0.12, 0.6);
  const appOn = window_(t, 19.4, REVEAL_AT - 0.15, 0.5, 0.15);
  const endOn = window_(t, 40.4, DURATION, 0.6, 0);

  const FOCUS_X = (PC_RECT.x + PC_RECT.w / 2) * 100;
  const FOCUS_Y = (PC_RECT.y + PC_RECT.h / 2) * 100;

  let scale;
  let origin;
  let dy;
  if (t < 14.0) {
    scale = lerp(0.98, 1.05, span(t, 0, 14.0, (p) => p));
    origin = '50% 46%';
    dy = lerp(0, -34, span(t, 0, 14.0, (p) => p));
  } else if (t < 19.0) {
    scale = lerp(1.05, 1.9, span(t, 14.2, 17.4, easeInOut));
    origin = `${FOCUS_X}% ${FOCUS_Y}%`;
    dy = -34;
  } else {
    scale = lerp(1.8, 1.05, span(t, REVEAL_AT, 39.4, easeInOut));
    origin = `${FOCUS_X}% ${FOCUS_Y}%`;
    dy = lerp(-24, -60, span(t, REVEAL_AT, 39.4, easeInOut));
  }
  const jolt = t > 14.4 && t < 15.2 ? Math.sin((t - 14.4) * 46) * (1 - (t - 14.4) / 0.8) * 13 : 0;

  $('plate').style.opacity = plateOn * (1 - endOn);
  $('plate').style.transformOrigin = origin;
  $('plate').style.transform = `translate(${jolt}px, ${dy}px) scale(${scale})`;

  // The editor slab. A percentage transform-origin is guesswork here — the
  // canvas is a rectangle inside an iframe inside a scaled shell — so the
  // camera is placed explicitly instead: work out where the canvas centre sits
  // at rest, then translate so it lands where it should at whatever scale.
  const appScale = t < 22.0
    ? lerp(0.94, 1.0, span(t, 19.2, 20.6, back))
    : lerp(1.0, 1.9, span(t, 22.0, 27.2, easeInOut)) * (1 - 0.18 * span(t, 31.6, 33.4, easeInOut));
  const [tx, ty] = placeApp(appScale, t);
  $('app').style.opacity = appOn * (1 - endOn);
  $('app').style.transformOrigin = '0 0';
  $('app').style.transform = `translate(${tx}px, ${ty + lerp(50, 0, span(t, 19.2, 20.4, easeOut))}px) scale(${appScale})`;

  const topOn = say(TOP, $('line-top'), $('line-top-text'), t);
  say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);
  $('line-top').style.opacity = topOn * (1 - endOn);
  $('line-bottom').style.opacity = Number($('line-bottom').style.opacity) * (1 - endOn);

  const stampOn = window_(t, 15.4, 18.4, 0.2, 0.32);
  $('stamp').style.opacity = stampOn;
  $('stamp').style.transform = `scale(${lerp(1.35, 1, span(t, 15.4, 15.9, back))})`;

  // The cut is instant, so the frame flashes rather than dissolves.
  $('flash').style.opacity = t >= REVEAL_AT - 0.12 && t < REVEAL_AT + 0.22
    ? 1 - clamp01((t - (REVEAL_AT - 0.12)) / 0.34)
    : 0;

  $('end').style.opacity = endOn;
  $('end-mark').style.transform = `scale(${lerp(0.8, 1, span(t, 40.6, 41.6, back))})`;

  // Belt and braces against the same thing `overflow: clip` prevents.
  const film = $('film');
  if (film.scrollLeft || film.scrollTop) { film.scrollLeft = 0; film.scrollTop = 0; }

  for (const spinner of hzDoc()?.querySelectorAll('.spinner') || []) {
    spinner.style.animation = 'none';
    spinner.style.transform = `rotate(${(t * 400) % 360}deg)`;
  }
}

let lastT = -1;

window.AD = {
  duration: DURATION,

  async ready() {
    buildPlates();
    const frame = $('hz');
    if (frame.contentDocument?.readyState !== 'complete') {
      await new Promise((r) => frame.addEventListener('load', r, { once: true }));
    }
    await new Promise((r) => setTimeout(r, 1600));
    const stage = hzDoc()?.getElementById('stage');
    if (stage) stage.setPointerCapture = () => {};
    return true;
  },

  seek(t) {
    for (const cue of cues) {
      if (!cue.done && t >= cue.t && cue.t > lastT) { cue.done = true; cue.fn(); }
    }
    for (const track of tracks) {
      if (t >= track.a && t <= track.b) track.fn(clamp01((t - track.a) / (track.b - track.a)));
    }
    lastT = t;
    paint(t);
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
};
