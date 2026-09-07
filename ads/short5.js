// The fifth Short: how far a picture actually goes.
//
// What is real here and what is not:
//
//   real  the photograph, and the colony in it. The insects are drawn at the
//         size they would be — six or seven pixels across — so the zoom in the
//         first half is a real magnification of real pixels, and the mush it
//         arrives at is what magnifying those pixels does. No product is named
//         or shown doing it.
//   real  the editor, and every number in it. That is Hazelnut running its own
//         AIScope: the same photograph, the reticle, the magnification slider,
//         and the readout that says `optical`, then `interpolated`, then
//         `beyond detail` — the tool's own honesty about what is left to see.
//         The scope is a microscope on pixels, so at 80× it is already inside
//         three of them; the confirm dialog saying that Learn will read a
//         256 px square around the point instead is the app's own words.
//         Zooming is free at any magnification; only Learn is billed.
//   not   the card at the end. Its wording is written by this file and handed
//         to the app in place of a reading this machine cannot make. Replace it
//         with a real Learn result before this is used anywhere.

import { leafPhoto, APHIDS } from './leaf-scene.js';

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

const CUT = 19.4;
const CARD = 33.6;        // the reading comes back

let photo = null;

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.5, 3.4, 'Something is on<br>your tomatoes.'],
  [4.4, 7.6, 'So you zoom in.'],
  [8.2, 11.8, 'And keep zooming.'],
  [19.8, 22.4, 'Or open it in Hazelnut.'],
  [23.0, 26.2, 'Eighty times — and you are<br>inside three pixels.'],
  [26.8, 29.6, 'Sixty <em>thousand</em> times.'],
  [30.4, 33.2, 'Then ask what it is.'],
  [34.6, 39.6, 'It reads the area.<br>Not the mush.'],
];

const BOTTOM = [
  [1.2, 3.4, 'Too small to name.'],
  [8.6, 11.8, 'It is only bigger pixels.'],
  [15.8, 18.6, 'Pixels are not an answer.'],
  [23.6, 26.2, 'Zooming is free at any magnification.'],
  [27.4, 29.6, 'And it says so: beyond detail.'],
  [31.2, 33.4, 'Fifteen credits. Only this costs.'],
  [36.4, 39.6, 'And it says how sure it is.'],
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

const COLONY = { x: APHIDS.x * W, y: APHIDS.y * H };

at(20.0, () => selectTool('aiscope'));

// Put the scope on the colony: a click on the picture, which is how the tool
// is aimed.
at(20.8, () => { const p = docToStage(COLONY.x, COLONY.y); pointer('pointerdown', p.x, p.y); });
at(21.0, () => { const p = docToStage(COLONY.x, COLONY.y); pointer('pointerup', p.x, p.y, 0); });

/**
 * The magnification, driven through the panel's own slider so the readout and
 * the badge come from the tool rather than from the film. Geometric, because
 * 80 to 60,000 is three orders of magnitude and a linear ramp would spend the
 * whole beat in the first tenth of it.
 */
const zoomTo = (a, b, from, to) => over(a, b, (p) => setInput(
  hzDoc()?.getElementById('scope-zoom-slider'),
  String(Math.round(from * (to / from) ** easeInOut(p))),
));

// The tool opens at 400×; wind it back to the bottom of its range first.
at(21.6, () => setInput(hzDoc()?.getElementById('scope-zoom-slider'), '80'));

zoomTo(22.4, 24.2, 80, 252);       // optical: a whole document pixel still fits
zoomTo(24.6, 26.6, 252, 2400);     // interpolated
zoomTo(27.0, 29.4, 2400, 60000);   // beyond detail

// Back to the bottom — the tool's own button, not a number typed here.
at(29.9, () => buttonIn('.optionsbar .btn', '80×')?.click());

at(30.6, () => buttonIn('.optionsbar .btn', 'Learn this')?.click());
at(31.5, () => buttonIn('.modal__foot .btn', 'Use')?.click());
at(31.9, () => hzWin().__AD_JOB?.progress('Studying the crop…'));

// The panel column is taller than it is tall enough to show: scroll the card
// into view, the way anyone reading it would.
over(34.2, 35.4, (p) => {
  const panels = hzDoc()?.querySelector('.panels');
  if (panels) panels.scrollTop = easeInOut(p) * 250;
});

// PLACEHOLDER — written here, not read off the picture by any model.
at(CARD, () => hzWin().__AD_JOB?.finish({
  subject: 'Aphids on a tomato stem',
  category: 'insect',
  description: 'A colony of soft-bodied aphids packed along new growth, head-down where the stem is thinnest and the sap easiest to reach.',
  features: [
    'Pear-shaped bodies, roughly 2 mm long',
    'Pale green, with a darker head end',
    'A pair of cornicles at the rear',
    'Clustered on the newest growth',
  ],
  scaleNote: 'Read from the 256 px square around the point; at 80× the scope itself is inside a single pixel.',
  confidence: 0.72,
}));

// ── placing the editor ─────────────────────────────────────────────────────

const APP_TOP = 620;
const SHELL_INSET = 30;
const IFRAME_SCALE = 0.803;
const STAGE = { x: 52, y: 78, w: 940, h: 616 };
const SCOPE = { x: 1136, y: 250 };     // the scope panel, in iframe pixels

const CANVAS_LX = SHELL_INSET + IFRAME_SCALE * (STAGE.x + STAGE.w / 2);
const CANVAS_LY = 10 + IFRAME_SCALE * (STAGE.y + STAGE.h / 2);
const SCOPE_LX = SHELL_INSET + IFRAME_SCALE * SCOPE.x;
const SCOPE_LY = 10 + IFRAME_SCALE * SCOPE.y;
const SLAB_LX = 540;

function placeApp(scale, t) {
  // Three framings: the whole editor, then wide enough to hold the picture and
  // the scope at once, then the panel — where the reading is written — once it
  // lands, with the picture's edge still in shot.
  const wide = span(t, 21.4, 23.6, easeInOut);
  const onCard = span(t, 33.0, 35.4, easeInOut);
  const anchorX = lerp(lerp(SLAB_LX, CANVAS_LX * 0.55 + SCOPE_LX * 0.45, wide), SCOPE_LX - 40, onCard);
  const anchorY = lerp(CANVAS_LY, 400, onCard);
  const targetY = lerp(1010, 960, span(t, 20.6, 23.0, easeInOut));
  return [540 - scale * anchorX, targetY - APP_TOP - scale * anchorY];
}

// ── per-frame ──────────────────────────────────────────────────────────────

function paint(t) {
  const plateOn = window_(t, 0.2, CUT - 0.1, 0.5, 0.16);
  const appOn = window_(t, CUT + 0.1, 39.9, 0.45, 0.3);
  const endOn = window_(t, 40.4, DURATION, 0.6, 0);

  // The zoom that gets you nowhere: a real magnification of real pixels,
  // centred on the colony.
  const scale = t < 4.2
    ? lerp(1.0, 1.12, span(t, 0, 4.2, (p) => p))
    : lerp(1.12, 9.5, span(t, 4.2, 13.4, easeInOut));
  $('plate').style.opacity = plateOn * (1 - endOn);
  $('plate').style.transformOrigin = `${APHIDS.x * 100}% ${APHIDS.y * 100}%`;
  $('plate').style.transform = `scale(${scale})`;

  const appScale = t < 21.4
    ? lerp(0.94, 1.0, span(t, CUT, 20.8, back))
    : lerp(1.0, 1.34, span(t, 21.4, 23.6, easeInOut))
      * lerp(1, 1.15, span(t, 33.0, 35.4, easeInOut));
  const [tx, ty] = placeApp(appScale, t);
  $('app').style.opacity = appOn * (1 - endOn);
  $('app').style.transformOrigin = '0 0';
  $('app').style.transform =
    `translate(${tx}px, ${ty + lerp(50, 0, span(t, CUT, 20.6, easeOut))}px) scale(${appScale})`;

  const topOn = say(TOP, $('line-top'), $('line-top-text'), t);
  const bottomOn = say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);
  $('line-top').style.opacity = topOn * (1 - endOn);
  $('line-bottom').style.opacity = bottomOn * (1 - endOn);

  const stampOn = window_(t, 12.8, 15.4, 0.2, 0.3);
  $('stamp').style.opacity = stampOn;
  $('stamp').style.transform = `scale(${lerp(1.35, 1, span(t, 12.8, 13.3, back))})`;

  const flashAt = (a) => (t >= a - 0.12 && t < a + 0.22 ? 1 - clamp01((t - (a - 0.12)) / 0.34) : 0);
  $('flash').style.opacity = flashAt(CUT);

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
    photo = leafPhoto({ width: W, height: H });
    $('photo').getContext('2d').drawImage(photo, 0, 0);

    const frame = $('hz');
    if (frame.contentDocument?.readyState !== 'complete') {
      await new Promise((r) => frame.addEventListener('load', r, { once: true }));
    }
    await new Promise((r) => setTimeout(r, 1600));

    // The editor opens the same pixels the film has been zooming, so the two
    // halves are looking at one photograph and not two.
    hzWin().__AD_PLATE = photo.toDataURL('image/jpeg', 0.92);
    hzWin().__AD_CARD = true;
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
