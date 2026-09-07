// The third Short: one drawn frame becomes a moving shot.
//
// What is real here and what is not:
//
//   not   the timeline in the first half. It is drawn here, by this file: a
//         generic editing surface — a preview, a keyframe track, a render bar —
//         standing in for editing motion by hand. It is not any particular
//         application, and no product is named or shown, because depicting a
//         named editor stuttering would be a claim about that editor, and one
//         nobody here has measured.
//   real  the editor in the second half. That is Hazelnut Squirreal, running
//         its own code — the Magic Draw brush, the length and movement fields,
//         the price quoted from what was actually painted, the confirm dialog,
//         the progress, the transport bar and the playhead.
//   not   the clip that comes back. It is the ad's own drawn footage — the same
//         street the timeline was previewing — handed to the editor in place of
//         a generation this machine cannot make. Replace it with a real Magic
//         Draw result before this is used anywhere.

import { carFrame } from './car-scene.js';

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
const W = 780;          // the plate, and so the document in the editor
const H = 975;
const PLATE_COUNT = 24;
const CLIP_FPS = 12;

const CUT = 19.4;       // the timeline gives way to the editor
const FINISH = 34.6;    // the clip lands
const PLAY = 35.4;      // and the film starts driving the playhead

const plates = [];
let clipUrls = [];
let plateUrl = null;
let keys = [];
let playhead = null;

// ── the timeline ───────────────────────────────────────────────────────────

/**
 * Where the preview's playhead sits, 0..1 through the shot.
 *
 * Smooth while he is only watching it; once he is keyframing, quantised into
 * uneven holds with the odd hitch backwards — playback that cannot keep up.
 * Deterministic: the recorder steps virtual time, so nothing here may depend on
 * the wall clock or on Math.random.
 */
function preview(t) {
  if (t < 6.4) return (t * 0.26) % 1;
  const hold = 0.34;
  const k = Math.floor(t / hold);
  const noise = ((k * 2654435761) % 997) / 997;
  let u = (((k * hold) - 6.4) * 0.26 + (6.4 * 0.26)) % 1;
  if (noise < 0.3) u = (u - 0.06 + 1) % 1;
  return u;
}

/** The render bar: a crawl that never gets anywhere in the time we watch it. */
function renderPct(t) {
  if (t < 10.2) return 0;
  return Math.floor(13 * (1 - Math.exp(-(t - 10.2) / 9)));
}

function paintNle(t) {
  const u = preview(t);
  const g = $('nle-canvas').getContext('2d');
  g.drawImage(plates[Math.min(plates.length - 1, Math.floor(u * plates.length))], 0, 0);

  const frame = Math.round(u * 96);          // a four-second shot at 24 fps
  $('nle-time').textContent = `00:00:0${Math.floor(frame / 24)}:${String(frame % 24).padStart(2, '0')}`;

  // Keyframes land one by one as he sets them.
  const laid = span(t, 3.6, 9.2, (p) => p) * keys.length;
  keys.forEach((key, i) => { key.style.opacity = i < laid ? 1 : 0; });
  playhead.style.left = `${u * 100}%`;

  const pct = renderPct(t);
  $('nle-progress').style.width = `${pct}%`;
  $('nle-pct').textContent = `${pct}%`;
}

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.5, 3.2, 'You want one shot.'],
  [3.8, 6.4, 'So you set it moving<br>by hand.'],
  [6.9, 9.6, 'Key. Nudge. Key again.'],
  [10.2, 13.2, 'Preview it.'],
  [13.6, 16.0, 'Wait for it.'],
  [19.8, 22.0, 'Or draw <em>one</em> frame.'],
  [22.6, 25.8, 'Scribble the shot<br>you want.'],
  [26.4, 29.6, 'Say how it moves.'],
  [30.2, 33.6, 'Press Submit.'],
  [35.6, 39.6, 'Same street.<br><em>Now it moves.</em>'],
];

const BOTTOM = [
  [1.0, 3.2, 'A car, driving past.'],
  [7.0, 9.6, 'For four seconds of picture.'],
  [10.6, 15.8, 'And wait. And wait.'],
  [23.0, 25.8, 'It does not have to be good.'],
  [30.4, 33.6, 'Priced on the clip you asked for.'],
  [36.4, 39.6, 'One sketch. One line. One clip.'],
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

const sqDoc = () => $('sq').contentDocument;
// The bridge lives in the editor's window, not the film's.
const sqWin = () => $('sq').contentWindow;

/** Image pixel -> a point in the editor's stage, mirroring Viewport.fit(). */
function docToStage(px, py) {
  const stage = sqDoc()?.getElementById('stage');
  if (!stage) return { x: 0, y: 0 };
  const r = stage.getBoundingClientRect();
  const scale = Math.min(1, Math.min((r.width - 48) / W, (r.height - 48) / H));
  return {
    x: (r.width - W * scale) / 2 + px * scale,
    y: (r.height - H * scale) / 2 + py * scale,
  };
}

function pointer(type, sx, sy, buttons = 1) {
  const doc = sqDoc();
  const stage = doc?.getElementById('stage');
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  stage.dispatchEvent(new doc.defaultView.PointerEvent(type, {
    clientX: r.left + sx, clientY: r.top + sy,
    bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
    pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : buttons,
  }));
}

const clickIn = (sel) => sqDoc()?.querySelector(sel)?.click();
const selectTool = (id) => clickIn(`.tool[data-tool="${id}"]`);

/** The options bar now carries two ranges and two text boxes, so ask by label. */
function fieldInput(label, sel = 'input') {
  for (const f of sqDoc()?.querySelectorAll('.optionsbar .field') || []) {
    if (f.querySelector('label')?.textContent === label) return f.querySelector(sel);
  }
  return null;
}

function setInput(input, value) {
  const view = sqDoc()?.defaultView;
  if (!input || !view) return;
  input.value = value;
  // `new sqDoc().defaultView.Event(…)` would parse as `(new sqDoc()).…`, which
  // throws after the value is set — the field looks typed and nothing listens.
  input.dispatchEvent(new view.Event('input', { bubbles: true }));
}

const cues = [];
const tracks = [];
const at = (t, fn) => cues.push({ t, fn, done: false });
const over = (a, b, fn) => tracks.push({ a, b, fn });

/** A stroke through points given in image coordinates. */
function stroke(a, b, points, colour, size) {
  at(a - 0.2, () => {
    if (colour) clickIn(`.swatch[title="${colour}"]`);
    if (size) setInput(fieldInput('Size', 'input[type="range"]'), size);
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

const ring = (cx, cy, r) => Array.from({ length: 14 }, (_, i) => {
  const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});

at(20.0, () => clickIn('[data-command="file:open"]'));
at(21.0, () => selectTool('magic-draw'));

// The sketch: a body, a roof, two wheels. Deliberately rough.
stroke(22.4, 24.0, [
  [212, 748], [242, 716], [330, 708], [368, 682], [470, 682],
  [508, 712], [562, 720], [566, 750], [212, 750],
], '#d94f4f', 26);
stroke(24.2, 24.9, [[372, 690], [462, 690], [500, 716], [352, 716]], '#3d9dd6', 20);
stroke(25.1, 25.6, ring(292, 752, 34), '#000000', 11);
stroke(25.7, 26.2, ring(492, 752, 34), '#000000', 11);

/** Types into a labelled box, and lands on the whole line however we sample. */
function type(a, b, label, text) {
  over(a, b, (p) => setInput(
    fieldInput(label, 'input[type="text"]'),
    text.slice(0, Math.round(easeInOut(p) * text.length)),
  ));
  at(b + 0.05, () => setInput(fieldInput(label, 'input[type="text"]'), text));
}

type(26.6, 28.0, 'Describe it', 'a red hatchback on a wet high street at dusk');
type(28.4, 29.9, 'Movement', 'it drives past, left to right, camera still');

// Two seconds of picture: the length moves the price, so the badge on Submit
// re-quotes as the slider does.
over(30.2, 30.9, (p) => setInput(
  fieldInput('Seconds', 'input[type="range"]'),
  String(Math.round(lerp(4, 2, easeInOut(p)))),
));

let charged = 62;
at(31.3, () => {
  charged = Number(sqDoc().getElementById('magic-cost')?.textContent) || charged;
  const submit = [...sqDoc().querySelectorAll('.optionsbar .btn')]
    .find((b) => b.textContent.startsWith('Submit'));
  submit?.click();
});
at(32.2, () => {
  const use = [...sqDoc().querySelectorAll('.modal__foot .btn')]
    .find((b) => b.textContent.startsWith('Use'));
  use?.click();
});

// The job is driven from here rather than from a timer inside the bridge: the
// recorder steps virtual time, so a wall-clock delay would land anywhere.
at(32.8, () => sqWin().__AD_JOB?.progress('Rendering the clip… (2s)'));
at(33.6, () => sqWin().__AD_JOB?.progress('Rendering the clip… (4s)'));
at(34.2, () => sqWin().__AD_JOB?.progress('Rendering the clip… (6s)'));
at(FINISH, () => sqWin().__AD_JOB?.finish(clipUrls, { fps: CLIP_FPS, charged }));

// ── placing the editor ─────────────────────────────────────────────────────

const APP_TOP = 620;        // .app top, from short2.css
const SHELL_INSET = 30;     // 20px auto margin + 10px shell padding
const IFRAME_SCALE = 0.803; // .app iframe transform
const STAGE = { x: 52, y: 78, w: 940, h: 616 };  // the canvas area in the editor

// Where the canvas centre sits inside the slab — local to .app, which is the
// box the transform scales about. Film coordinates would only be right at
// scale 1: the element's own origin is already 620px down the frame.
const CANVAS_LX = SHELL_INSET + IFRAME_SCALE * (STAGE.x + STAGE.w / 2);
const CANVAS_LY = 10 + IFRAME_SCALE * (STAGE.y + STAGE.h / 2);
const SLAB_LX = 540;        // the slab's own centre

function placeApp(scale, t) {
  // Whole editor while it is being taken in, then on the stage — which is left
  // of the slab's centre, so anchoring there from the start would push the
  // panels off the right of a portrait frame, and staying on the slab's centre
  // would leave the playhead half out of shot at the reveal.
  const anchorX = lerp(SLAB_LX, CANVAS_LX, span(t, 22.6, 26.0, easeInOut));
  const targetY = lerp(1010, 880, span(t, 21.0, 23.4, easeInOut))
    + lerp(0, 120, span(t, 33.4, 35.6, easeInOut));
  return [540 - scale * anchorX, targetY - APP_TOP - scale * CANVAS_LY];
}

// ── the playhead, once the clip is in ──────────────────────────────────────

/**
 * Runs the transport from film time rather than leaving it playing on its own:
 * the transport advances on the wall clock, and the wall clock has nothing to
 * do with the time the recorder is stepping through.
 */
function drivePlayback(t) {
  const scrub = sqDoc()?.getElementById('transport-scrub');
  if (!scrub) return;
  const length = Number(scrub.max) + 1;
  if (!length) return;
  const index = Math.floor((t - PLAY) * CLIP_FPS) % length;
  if (Number(scrub.value) === index) return;
  setInput(scrub, String(index));
}

// ── per-frame ──────────────────────────────────────────────────────────────

function paint(t) {
  if (t < CUT + 0.6) paintNle(t);
  if (t >= PLAY) drivePlayback(t);

  const nleOn = window_(t, 0.2, CUT - 0.1, 0.5, 0.16);
  const appOn = window_(t, CUT + 0.1, 39.9, 0.45, 0.3);
  const endOn = window_(t, 40.4, DURATION, 0.6, 0);

  // The timeline: a slow push in, tightening as the preview starts to hitch.
  const nleScale = t < 9.6
    ? lerp(0.97, 1.04, span(t, 0, 9.6, (p) => p))
    : lerp(1.04, 1.2, span(t, 9.6, 17.6, easeInOut));
  const hitch = t > 6.4 && t < CUT
    ? Math.sin(t * 61) * 3 * clamp01((t - 6.4) / 6)
    : 0;
  $('nle').style.opacity = nleOn * (1 - endOn);
  $('nle').style.transformOrigin = '50% 40%';
  $('nle').style.transform =
    `translate(${hitch}px, ${lerp(0, -70, span(t, 9.6, 17.6, easeInOut))}px) scale(${nleScale})`;

  // The editor slab. A percentage transform-origin is guesswork here — the
  // canvas is a rectangle inside an iframe inside a scaled shell — so the
  // camera is placed explicitly: work out where the canvas centre sits at rest,
  // then translate so it lands where it should at whatever scale.
  const appScale = t < 22.6
    ? lerp(0.94, 1.0, span(t, CUT, 20.8, back))
    : lerp(1.0, 1.75, span(t, 22.6, 28.4, easeInOut))
      * (1 - 0.30 * span(t, 33.0, FINISH + 0.6, easeInOut));
  const [tx, ty] = placeApp(appScale, t);
  $('app').style.opacity = appOn * (1 - endOn);
  $('app').style.transformOrigin = '0 0';
  $('app').style.transform =
    `translate(${tx}px, ${ty + lerp(50, 0, span(t, CUT, 20.6, easeOut))}px) scale(${appScale})`;

  const topOn = say(TOP, $('line-top'), $('line-top-text'), t);
  const bottomOn = say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);
  $('line-top').style.opacity = topOn * (1 - endOn);
  $('line-bottom').style.opacity = bottomOn * (1 - endOn);

  const stampOn = window_(t, 16.4, 19.0, 0.2, 0.3);
  $('stamp').style.opacity = stampOn;
  $('stamp').style.transform = `scale(${lerp(1.35, 1, span(t, 16.4, 16.9, back))})`;

  // Both cuts are instant, so the frame flashes rather than dissolves.
  const flashAt = (a) => (t >= a - 0.12 && t < a + 0.22 ? 1 - clamp01((t - (a - 0.12)) / 0.34) : 0);
  $('flash').style.opacity = Math.max(flashAt(CUT), flashAt(FINISH + 0.5));

  $('end').style.opacity = endOn;
  $('end-mark').style.transform = `scale(${lerp(0.8, 1, span(t, 40.6, 41.6, back))})`;
  $('end-engine').style.opacity = span(t, 41.6, 42.8, easeOut);

  const film = $('film');
  if (film.scrollLeft || film.scrollTop) { film.scrollLeft = 0; film.scrollTop = 0; }

  for (const spinner of sqDoc()?.querySelectorAll('.spinner') || []) {
    spinner.style.animation = 'none';
    spinner.style.transform = `rotate(${(t * 400) % 360}deg)`;
  }
}

let lastT = -1;

window.AD = {
  duration: DURATION,

  async ready() {
    for (let i = 0; i < PLATE_COUNT; i += 1) {
      plates.push(carFrame({ width: W, height: H, t: i / (PLATE_COUNT - 1) }));
    }
    // The same footage twice over: the timeline previews it, and the bridge
    // hands it back as the clip. Placeholder in both places — see the top.
    clipUrls = plates.map((c) => c.toDataURL('image/jpeg', 0.86));
    // Handed to the bridge, which runs in the editor's window.
    plateUrl = clipUrls[10];

    const track = $('nle-track');
    keys = [0.05, 0.13, 0.22, 0.3, 0.39, 0.47, 0.58, 0.66, 0.75, 0.84, 0.93].map((p) => {
      const key = document.createElement('i');
      key.className = 'nle__key';
      key.style.left = `${p * 100}%`;
      key.style.opacity = 0;
      track.append(key);
      return key;
    });
    playhead = document.createElement('i');
    playhead.className = 'nle__play';
    track.append(playhead);

    const frame = $('sq');
    if (frame.contentDocument?.readyState !== 'complete') {
      await new Promise((r) => frame.addEventListener('load', r, { once: true }));
    }
    await new Promise((r) => setTimeout(r, 1600));
    sqWin().__AD_PLATE = plateUrl;
    const stage = sqDoc()?.getElementById('stage');
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
