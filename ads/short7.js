// The seventh Short: the words in the picture.
//
// What is real here and what is not:
//
//   real  the photograph, and the name painted across the fascia. It is drawn
//         by cafe-scene.js from a seed, so every version of it in this film is
//         the same photograph down to the grain.
//   real  the editor, the tool, the mask, the field, the confirm dialog and
//         every number on screen. That is Hazelnut running its own Magic Text:
//         the mask brush Erase uses, the words typed into the tool's own
//         field, `Generate 12` read off the button rather than written here,
//         and the Eco switch afterwards re-quoting the same tool at 4.
//   not   the result. No model runs during a recording, so what lands on the
//         canvas is the same scene re-drawn with the new name — the film's
//         stand-in for an answer this machine cannot generate. It is what the
//         tool is asked for, not evidence of what it returns. Replace it with
//         a real generation before this is used anywhere.

import { cafePhoto, SIGN } from './cafe-scene.js';

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

const CUT = 18.6;
const FINISH = 31.2;      // the new board lands
const ECO = 34.2;         // the same tool, re-quoted

const OLD_NAME = 'HAZEL & FIG';
const NEW_NAME = 'THE HAZEL TREE';

let photo = null;
let result = null;

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.6, 3.6, 'The café changed<br>its name.'],
  [4.6, 8.0, 'The photograph<br>did not.'],
  [8.8, 12.4, 'And it is the good one.'],
  [13.2, 17.4, 'Reshoot it, then.'],
  [19.6, 22.6, 'Or paint over the words.'],
  [23.4, 26.2, 'And type the new ones.'],
  [27.0, 30.0, 'Then press Generate.'],
  [31.4, 34.0, 'Same board. Same paint.<br>Same evening.'],
  [35.2, 39.6, 'Twelve credits.<br>Four in Eco Mode.'],
];

const BOTTOM = [
  [1.6, 3.6, 'It is <em>The Hazel Tree</em> now.'],
  [9.2, 12.4, 'Low sun, nobody in the doorway.'],
  [14.2, 17.4, 'That light was in June.'],
  [20.4, 22.6, 'The mask Erase uses, on the lettering.'],
  [24.0, 26.2, 'Character for character.'],
  [27.8, 30.0, 'Twelve credits, quoted on the button.'],
  [32.0, 34.0, 'Nothing outside the mask changes.'],
  [36.2, 39.6, 'A crop, not the picture.<br>Rougher — and it says so.'],
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
const hzWin = () => $('hz').contentWindow;

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
const buttonIn = (sel, label) => [...hzDoc().querySelectorAll(sel)]
  .find((b) => b.textContent.startsWith(label));

function fieldInput(label, sel = 'input') {
  for (const f of hzDoc()?.querySelectorAll('.optionsbar .field') || []) {
    if (f.querySelector('label')?.textContent === label) return f.querySelector(sel);
  }
  return null;
}

function setInput(input, value) {
  const view = hzDoc()?.defaultView;
  if (!input || !view) return;
  input.value = value;
  input.dispatchEvent(new view.Event('input', { bubbles: true }));
}

const cues = [];
const tracks = [];
const at = (t, fn) => cues.push({ t, fn, done: false });
const over = (a, b, fn) => tracks.push({ a, b, fn });

/** A stroke through points given in image coordinates. */
function stroke(a, b, points, size) {
  at(a - 0.15, () => { if (size) setInput(fieldInput('Size', 'input[type="range"]'), size); });
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

function type(a, b, label, text) {
  over(a, b, (p) => setInput(
    fieldInput(label, 'input[type="text"]'),
    text.slice(0, Math.round(easeInOut(p) * text.length)),
  ));
  at(b + 0.05, () => setInput(fieldInput(label, 'input[type="text"]'), text));
}

// The board, in document pixels: two passes across the lettering, the way you
// would cover it with the brush.
const BOARD = {
  x: SIGN.x * W, y: SIGN.y * H, w: SIGN.w * W, h: SIGN.h * H,
};
const band = (y) => [
  [BOARD.x + 26, y], [BOARD.x + BOARD.w * 0.34, y - 6],
  [BOARD.x + BOARD.w * 0.7, y + 5], [BOARD.x + BOARD.w - 22, y],
];

at(18.9, () => selectTool('magic-text'));

stroke(20.3, 21.5, band(BOARD.y + 34), 110);
stroke(21.8, 23.0, band(BOARD.y + 88), 110);

type(23.6, 25.9, 'Say instead', NEW_NAME);

let charged = 12;
at(26.8, () => {
  // The price is read off the app's own badge, so the film cannot quote a
  // number the app would not charge.
  charged = Number(hzDoc().getElementById('magic-text-cost')?.textContent) || charged;
  buttonIn('.optionsbar .btn--primary', 'Generate')?.click();
});
at(28.2, () => buttonIn('.modal__foot .btn', 'Use')?.click());
at(28.5, () => hzWin().__AD_JOB?.progress('Sending the picture…'));

// PLACEHOLDER — the same scene re-drawn with the new name. Not a generation.
at(FINISH, () => hzWin().__AD_JOB?.finish(result.toDataURL('image/png'), { charged }));

// The switch, and the same tool quoted again underneath it.
at(ECO, () => clickIn('#eco-pill'));

// ── placing the editor ─────────────────────────────────────────────────────

const APP_TOP = 620;        // .app top, from short2.css
const SHELL_INSET = 30;     // 20px auto margin + 10px shell padding
const IFRAME_SCALE = 0.803; // .app iframe transform
const STAGE = { x: 52, y: 78, w: 940, h: 616 };
const SLAB_LX = 540;

// Anchors are element-local: `.app` is already offset down the frame, and the
// iframe inside it is scaled, so a point in film coordinates is only right at
// scale 1. These are measured in the slab's own space instead.
const CANVAS_LX = SHELL_INSET + IFRAME_SCALE * (STAGE.x + STAGE.w / 2);
const CANVAS_LY = 10 + IFRAME_SCALE * (STAGE.y + STAGE.h / 2);

/**
 * The camera, as a list of framings rather than a pile of spans: each one is a
 * scale, a point inside the editor to hold on, and where in the frame to hold
 * it. Between two framings everything interpolates, anchors included.
 */
const SHOTS = [
  { t: CUT, scale: 0.94, anchor: 'slab', y: 1010 },
  { t: 19.4, scale: 1.0, anchor: 'slab', y: 1000 },
  { t: 21.0, scale: 2.05, anchor: 'sign', y: 950 },
  { t: 26.0, scale: 2.05, anchor: 'sign', y: 950 },
  { t: 26.8, scale: 1.16, anchor: 'work', y: 900 },
  { t: 32.6, scale: 1.16, anchor: 'work', y: 900 },
  { t: ECO + 0.4, scale: 1.9, anchor: 'eco', y: 720 },
];

/** The centre of something inside the editor, in the slab's own coordinates. */
function localOf(selector, fallback) {
  const node = hzDoc()?.querySelector(selector);
  if (!node) return fallback;
  const r = node.getBoundingClientRect();
  return {
    x: SHELL_INSET + IFRAME_SCALE * (r.left + r.width / 2),
    y: 10 + IFRAME_SCALE * (r.top + r.height / 2),
  };
}

function anchorPoint(name) {
  if (name === 'slab') return { x: SLAB_LX, y: CANVAS_LY };
  if (name === 'work') return { x: CANVAS_LX, y: CANVAS_LY - 70 };
  if (name === 'eco') {
    const pill = localOf('#eco-pill', { x: 900, y: 34 });
    const gen = localOf('#magic-text-cost', { x: CANVAS_LX, y: 70 });
    return { x: (pill.x + gen.x) / 2, y: (pill.y + gen.y) / 2 + 100 };
  }
  // The sign, where the editor has actually put it: the stage fits the picture
  // to itself, so this is measured rather than assumed.
  const board = docToStage(BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2);
  const r = hzDoc()?.getElementById('stage')?.getBoundingClientRect();
  if (!r) return { x: CANVAS_LX, y: CANVAS_LY };
  return {
    x: SHELL_INSET + IFRAME_SCALE * (r.left + board.x),
    y: 10 + IFRAME_SCALE * (r.top + board.y),
  };
}

function camera(t) {
  let a = SHOTS[0];
  let b = SHOTS[0];
  for (let i = 0; i < SHOTS.length - 1; i += 1) {
    if (t >= SHOTS[i].t) { a = SHOTS[i]; b = SHOTS[i + 1]; }
  }
  if (t >= SHOTS.at(-1).t) { a = SHOTS.at(-1); b = a; }
  const p = a === b ? 1 : span(t, a.t, b.t, easeInOut);
  const pa = anchorPoint(a.anchor);
  const pb = anchorPoint(b.anchor);
  const scale = lerp(a.scale, b.scale, p);
  const anchorX = lerp(pa.x, pb.x, p);
  const anchorY = lerp(pa.y, pb.y, p);
  const targetY = lerp(a.y, b.y, p);
  return { scale, tx: 540 - scale * anchorX, ty: targetY - APP_TOP - scale * anchorY };
}

// ── per-frame ──────────────────────────────────────────────────────────────

function paint(t) {
  const plateOn = window_(t, 0.2, CUT - 0.1, 0.5, 0.16);
  const appOn = window_(t, CUT + 0.1, 39.9, 0.45, 0.3);
  const endOn = window_(t, 40.4, DURATION, 0.6, 0);

  // The first half is one move: the whole front, then in on the name, which is
  // the only thing in the picture that is wrong.
  const scale = lerp(1.0, 1.75, span(t, 1.0, 17.6, easeInOut));
  $('plate').style.opacity = plateOn * (1 - endOn);
  $('plate').style.transformOrigin =
    `${(SIGN.x + SIGN.w / 2) * 100}% ${(SIGN.y + SIGN.h / 2) * 100}%`;
  $('plate').style.transform = `scale(${scale})`;

  const shot = camera(t);
  $('app').style.opacity = appOn * (1 - endOn);
  $('app').style.transformOrigin = '0 0';
  $('app').style.transform =
    `translate(${shot.tx}px, ${shot.ty + lerp(50, 0, span(t, CUT, 19.6, easeOut))}px) scale(${shot.scale})`;

  const topOn = say(TOP, $('line-top'), $('line-top-text'), t);
  const bottomOn = say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);
  $('line-top').style.opacity = topOn * (1 - endOn);
  $('line-bottom').style.opacity = bottomOn * (1 - endOn);

  const stampOn = window_(t, 14.6, 17.2, 0.2, 0.3);
  $('stamp').style.opacity = stampOn;
  $('stamp').style.transform = `scale(${lerp(1.35, 1, span(t, 14.6, 15.1, back))})`;

  const flashAt = (a) => (t >= a - 0.12 && t < a + 0.22 ? 1 - clamp01((t - (a - 0.12)) / 0.34) : 0);
  $('flash').style.opacity = Math.max(flashAt(CUT), flashAt(FINISH) * 0.5);

  $('end').style.opacity = endOn;
  $('end-mark').style.transform = `scale(${lerp(0.8, 1, span(t, 40.6, 41.6, back))})`;
  $('end-engine').style.opacity = span(t, 41.6, 42.8, easeOut);

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
    photo = cafePhoto({ width: W, height: H, sign: OLD_NAME });
    // The stand-in: one seed, one scene, one word changed. Everything outside
    // the board is the same pixels as the photograph above.
    result = cafePhoto({ width: W, height: H, sign: NEW_NAME });
    $('photo').getContext('2d').drawImage(photo, 0, 0);

    const frame = $('hz');
    if (frame.contentDocument?.readyState !== 'complete') {
      await new Promise((r) => frame.addEventListener('load', r, { once: true }));
    }
    await new Promise((r) => setTimeout(r, 1600));

    hzWin().__AD_PLATE = photo.toDataURL('image/jpeg', 0.94);
    hzWin().__AD_PLATE_NAME = 'hazel-and-fig.jpg';
    hzWin().__AD_TRANSFORM = true;
    clickIn('[data-command="file:open"]');
    for (let i = 0; i < 120 && !hzDoc()?.querySelector('#app.has-document'); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }

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
