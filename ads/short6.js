// The sixth Short: a crowd, a billboard, and what the billboard actually says.
//
// What is real here and what is not:
//
//   not   the square. The crowd, the placards and the billboard are drawn by
//         square-scene.js. Nobody in it is a person, and no real protest,
//         organisation or slogan is depicted — the boards say what this ad
//         wrote on them.
//   real  the editor, and every number in it. That is Hazelnut: the Eco switch
//         in the menubar, the price badges dropping when it goes on, the
//         Realtouch mask, and the confirm dialog saying — in the app's own
//         words, not the film's — that Eco Mode skips the location lookup and
//         what that costs the result.
//   real  the claim, and the limit of it. Eco Mode asks the model for less
//         work; less work means less electricity and less water drawn by the
//         datacentre. How much is not measurable from the machine Hazelnut
//         runs on, so this film does not put a figure on it, and neither does
//         the app.
//
// The crowd does not fold at the end, and that is deliberate. An advert in
// which people stop objecting because a product shipped a setting would be
// making a claim on their behalf that nobody here is entitled to make.

import { squareFrame } from './square-scene.js';

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

const LIGHT = 4.8;      // the billboard comes on
const PANEL = 13.6;     // and turns over to what it means
const CUT = 19.4;       // the square gives way to the editor
const BACK = 34.0;      // and comes back

// ── the square ─────────────────────────────────────────────────────────────

function paintSquare(t) {
  const lit = span(t, LIGHT, LIGHT + 0.9, easeOut);
  const panel = span(t, PANEL, PANEL + 0.7, easeInOut);
  // Phones come out only after the crowd has had time to read the board, and
  // only some of them ever do.
  const phones = t < BACK ? 0 : span(t, BACK + 0.6, BACK + 3.4, easeOut) * 0.45;
  const frame = squareFrame({ width: W, height: H, t, lit, panel, phones });
  $('photo').getContext('2d').drawImage(frame, 0, 0);
}

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.6, 3.6, 'There is a crowd<br>outside.'],
  [5.2, 8.4, 'And a billboard,<br>lighting up.'],
  [9.2, 12.8, 'It is not an answer<br>to them.'],
  [14.2, 18.2, 'It is a smaller ask.'],
  [20.4, 23.2, 'One switch.'],
  [24.4, 27.4, 'Smaller pictures go up.'],
  [29.4, 33.2, 'Twelve credits,<br>not twenty.'],
  [34.6, 39.4, 'Some of them<br>will use it.'],
];

const BOTTOM = [
  [1.4, 3.6, '“NO MORE AI.”'],
  [9.8, 12.8, 'It was never going to be.'],
  [15.0, 18.2, 'Fewer pixels. Fewer passes. Fewer frames.'],
  [21.6, 23.2, 'Every price in the app drops with it.'],
  [25.0, 27.4, 'One model call instead of two.'],
  [30.2, 33.2, 'And it says what that costs you.'],
  [36.2, 39.4, 'Some of them will keep shouting.'],
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

function docToStage(px, py, docW, docH) {
  const stage = hzDoc()?.getElementById('stage');
  if (!stage) return { x: 0, y: 0 };
  const r = stage.getBoundingClientRect();
  const scale = Math.min(1, Math.min((r.width - 48) / docW, (r.height - 48) / docH));
  return {
    x: (r.width - docW * scale) / 2 + px * scale,
    y: (r.height - docH * scale) / 2 + py * scale,
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

const cues = [];
const tracks = [];
const at = (t, fn) => cues.push({ t, fn, done: false });
const over = (a, b, fn) => tracks.push({ a, b, fn });

/** The litter bin in the demo photograph, in its document's coordinates. */
const BIN = { x: 1070, y: 888, w: 1600, h: 1000 };

function stroke(a, b, points, size) {
  at(a - 0.15, () => {
    const input = [...hzDoc().querySelectorAll('.optionsbar .field')]
      .find((f) => f.querySelector('label')?.textContent === 'Size')?.querySelector('input');
    if (input && size) {
      input.value = size;
      input.dispatchEvent(new (hzDoc().defaultView.Event)('input', { bubbles: true }));
    }
  });
  at(a, () => { const p = docToStage(points[0][0], points[0][1], BIN.w, BIN.h); pointer('pointerdown', p.x, p.y); });
  over(a, b, (p) => {
    const eased = easeInOut(p) * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(eased));
    const f = eased - i;
    const s = docToStage(
      lerp(points[i][0], points[i + 1][0], f),
      lerp(points[i][1], points[i + 1][1], f),
      BIN.w, BIN.h,
    );
    pointer('pointermove', s.x, s.y);
  });
  at(b, () => { const p = docToStage(points.at(-1)[0], points.at(-1)[1], BIN.w, BIN.h); pointer('pointerup', p.x, p.y, 0); });
}

at(19.9, () => clickIn('[data-command="file:open"]'));
// The switch itself — the app's own pill, not a prop drawn by this film.
at(21.2, () => clickIn('#eco-pill'));
at(23.8, () => selectTool('realtouch'));

stroke(25.0, 25.9, [
  [BIN.x - 26, BIN.y - 58], [BIN.x + 24, BIN.y - 50],
  [BIN.x + 20, BIN.y + 30], [BIN.x - 22, BIN.y + 36],
], 70);
stroke(26.1, 26.7, [[BIN.x - 30, BIN.y - 10], [BIN.x + 30, BIN.y - 4]], 70);

at(27.6, () => buttonIn('.optionsbar .btn', 'Remove')?.click());

// ── placing the editor ─────────────────────────────────────────────────────

const APP_TOP = 620;
const SHELL_INSET = 30;
const IFRAME_SCALE = 0.803;
const STAGE = { x: 52, y: 78, w: 940, h: 616 };
const MENUBAR = { x: 1180, y: 18 };            // the Eco pill, in iframe pixels

const CANVAS_LX = SHELL_INSET + IFRAME_SCALE * (STAGE.x + STAGE.w / 2);
const CANVAS_LY = 10 + IFRAME_SCALE * (STAGE.y + STAGE.h / 2);
const SLAB_LX = 540;
// A modal is centred in the editor's own window, so this is where the confirm
// dialog lands — the frame the second half of this half is built around.
const MODAL_LY = 10 + IFRAME_SCALE * 360;

function placeApp(scale, t) {
  // Two framings: the whole editor while the switch goes on — the pill, the
  // toolbar prices and the app's own toast are all on screen at once and the
  // eye can see them change — then in on the confirm dialog, which is where
  // the number and the caveat actually live.
  const onDialog = span(t, 27.9, 29.4, easeInOut);
  const anchorY = lerp(CANVAS_LY, MODAL_LY, onDialog);
  const targetY = lerp(1010, 940, span(t, 20.0, 22.4, easeInOut));
  return [540 - scale * SLAB_LX, targetY - APP_TOP - scale * anchorY];
}

// ── per-frame ──────────────────────────────────────────────────────────────

function paint(t) {
  if (t < CUT + 0.6 || t > BACK - 0.6) paintSquare(t);

  const plateOn = window_(t, 0.2, CUT - 0.1, 0.5, 0.16) || window_(t, BACK, 39.9, 0.4, 0.4);
  const appOn = window_(t, CUT + 0.1, BACK - 0.2, 0.45, 0.2);
  const endOn = window_(t, 40.4, DURATION, 0.6, 0);

  // The square: a slow push in on the crowd, then up to the board as it lights.
  const scale = t < LIGHT
    ? lerp(1.04, 1.12, span(t, 0, LIGHT, (p) => p))
    : lerp(1.12, 1.24, span(t, LIGHT, 18.0, easeInOut));
  const originY = t < LIGHT - 0.4
    ? lerp(78, 64, span(t, 0, LIGHT, easeInOut))
    : lerp(64, 30, span(t, LIGHT - 0.4, LIGHT + 1.6, easeInOut));
  const backOrigin = lerp(30, 70, span(t, BACK, BACK + 2.2, easeInOut));

  $('plate').style.opacity = plateOn * (1 - endOn);
  $('plate').style.transformOrigin = `50% ${t < BACK ? originY : backOrigin}%`;
  $('plate').style.transform = `scale(${t < BACK ? scale : lerp(1.24, 1.06, span(t, BACK, BACK + 3.0, easeInOut))})`;

  const appScale = t < 27.9
    ? lerp(0.94, 1.02, span(t, CUT, 20.4, back))
    : lerp(1.02, 1.42, span(t, 27.9, 29.4, easeInOut));
  const [tx, ty] = placeApp(appScale, t);
  $('app').style.opacity = appOn * (1 - endOn);
  $('app').style.transformOrigin = '0 0';
  $('app').style.transform =
    `translate(${tx}px, ${ty + lerp(50, 0, span(t, CUT, 20.4, easeOut))}px) scale(${appScale})`;

  const topOn = say(TOP, $('line-top'), $('line-top-text'), t);
  const bottomOn = say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);
  $('line-top').style.opacity = topOn * (1 - endOn);
  $('line-bottom').style.opacity = bottomOn * (1 - endOn);

  const flashAt = (a) => (t >= a - 0.12 && t < a + 0.22 ? 1 - clamp01((t - (a - 0.12)) / 0.34) : 0);
  $('flash').style.opacity = Math.max(flashAt(CUT), flashAt(BACK), flashAt(LIGHT) * 0.5);

  $('end').style.opacity = endOn;
  $('end-mark').style.transform = `scale(${lerp(0.8, 1, span(t, 40.6, 41.6, back))})`;
  $('end-engine').style.opacity = span(t, 41.8, 43.0, easeOut);

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
