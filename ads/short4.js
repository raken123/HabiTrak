// The fourth Short: one thing removed from a whole clip.
//
// What is real here and what is not:
//
//   real  the patch that swims. `patchFrame` performs an actual clone-stamp
//         fill, per frame, with no knowledge of any other frame — repeating
//         the band beside the hole across it, dragging the pavement up over
//         the bottom, blurring the seam. The wrong-pitch brickwork and the
//         floating kerb are what that operation does, not a drawing of what
//         it does. No product is named or shown doing it, because depicting a
//         named editor failing would be a claim about that editor.
//   real  the editor. That is Hazelnut Squirreal running its own code: the
//         clip is a real video file, decoded by the app's own Clip.fromVideo;
//         the mask is the Realtouch brush; the price on Remove is quoted from
//         the length of the clip that is open; the confirm dialog, the two
//         progress passes and the transport bar are all the app's.
//   not   the clip that comes back. It is the same pan rendered without the
//         van — the ad's stand-in for a generation this machine cannot make.
//         Replace it with a real Realtouch result before this is used
//         anywhere, along with the "found 3 references" line, which describes
//         a lookup that did not happen here.

import { shopFrame, patchFrame, vanRect } from './shop-scene.js';

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
const W = 880;            // the plate the first half is drawn at
const H = 1100;
const PLATE_FRAMES = 12;
const PLATE_FPS = 12;

// The clip in the editor: 780×976, 30 frames at 12 fps.
const DOC_W = 780;
const DOC_H = 976;
const CLIP_FPS = 24;   // what Clip.fromVideo re-samples the file at

const CUT = 19.4;         // the footage gives way to the editor
const FREEZE = 4.4;       // the patch lands on one frame, and we sit on it
const SWIM = 8.2;         // and then it is played back
const FINISH = 34.8;      // the rebuilt clip lands
const PLAY = 36.2;        // and the film starts driving the playhead

const filmed = [];
const patched = [];
let cleanClipUrl = null;

// ── the footage ────────────────────────────────────────────────────────────

/** Which frame of the loop is showing, and whether it is the patched one. */
function plateFrame(t) {
  if (t < FREEZE) return { i: Math.floor(t * PLATE_FPS) % PLATE_FRAMES, patch: false };
  // The patch is made on one frame and held there — the moment it looks fine.
  if (t < SWIM) return { i: 4, patch: true };
  return { i: Math.floor((t - SWIM) * PLATE_FPS) % PLATE_FRAMES, patch: true };
}

function paintPlate(t) {
  const { i, patch } = plateFrame(t);
  const ctx = $('photo').getContext('2d');
  ctx.drawImage((patch ? patched : filmed)[i], 0, 0);
}

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.5, 3.4, 'You got the shot.'],
  [4.6, 7.8, 'So you paint the van out.'],
  [8.6, 12.0, 'Then you play it back.'],
  [12.4, 15.2, 'Every frame guessed<br>on its own.'],
  [19.8, 22.2, 'Or paint it out <em>once</em>.'],
  [22.8, 26.4, 'Scrub over the thing<br>you want gone.'],
  [27.0, 29.2, 'Say what is behind it,<br>if you know.'],
  [29.8, 34.2, 'Press Remove.'],
  [35.8, 39.6, 'Same pan.<br><em>No van.</em>'],
];

const BOTTOM = [
  [1.2, 3.4, 'Nobody moved the van.'],
  [5.0, 7.8, 'On one frame, it looks fine.'],
  [16.2, 18.8, 'Thirty frames. Thirty answers.'],
  [23.2, 26.4, 'Once. Not once a frame.'],
  [30.2, 34.2, 'Priced on the length of the clip.'],
  [36.6, 39.6, 'It looked the place up, once.'],
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
const sqWin = () => $('sq').contentWindow;

/** Image pixel -> a point in the editor's stage, mirroring Viewport.fit(). */
function docToStage(px, py) {
  const stage = sqDoc()?.getElementById('stage');
  if (!stage) return { x: 0, y: 0 };
  const r = stage.getBoundingClientRect();
  const scale = Math.min(1, Math.min((r.width - 48) / DOC_W, (r.height - 48) / DOC_H));
  return {
    x: (r.width - DOC_W * scale) / 2 + px * scale,
    y: (r.height - DOC_H * scale) / 2 + py * scale,
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
const buttonIn = (sel, label) => [...sqDoc().querySelectorAll(sel)]
  .find((b) => b.textContent.startsWith(label));

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

// The van, on the frame the playhead is parked on — which is frame 0, so the
// mask is painted where the van actually is when Realtouch reads it.
const VAN = vanRect(DOC_W, DOC_H, 0);
const band = (y) => [
  [VAN.x + 20, y], [VAN.x + VAN.w * 0.32, y - 6], [VAN.x + VAN.w * 0.68, y + 5], [VAN.x + VAN.w - 18, y],
];

at(20.0, () => selectTool('realtouch'));

// Back to the first frame before the mask goes on: the playhead has been
// running, and the van is only where the strokes below expect it at frame 0.
at(22.35, () => setInput(sqDoc()?.getElementById('transport-scrub'), '0'));

// Four passes over the van, top to bottom, with the mask brush wide open.
stroke(22.8, 23.7, band(VAN.y + 55), 150);
stroke(23.8, 24.6, band(VAN.y + 145), 150);
stroke(24.7, 25.5, band(VAN.y + 235), 150);
stroke(25.6, 26.4, band(VAN.y + 300), 120);

type(27.2, 29.0, 'Hint', 'there is a green door behind it');

let charged = 88;
at(30.6, () => {
  charged = Number(sqDoc().getElementById('realtouch-cost')?.textContent) || charged;
  buttonIn('.optionsbar .btn', 'Remove')?.click();
});
at(31.6, () => buttonIn('.modal__foot .btn', 'Use')?.click());

// The two passes are driven from here, not from a timer inside the bridge: the
// recorder steps film time, and a wall-clock delay would land anywhere.
at(32.2, () => sqWin().__AD_JOB?.progress('Looking up where this was filmed…', 'examining'));
at(33.2, () => sqWin().__AD_JOB?.progress('Found 3 references. Rebuilding it across every frame…'));
at(FINISH, () => sqWin().__AD_JOB?.finish({
  clip: cleanClipUrl,
  seconds: 2.5,
  scene: 'A brick terrace of shopfronts at dusk; the van is parked across a green shop door.',
  sources: [],
}, { charged }));

// ── placing the editor ─────────────────────────────────────────────────────

const APP_TOP = 620;        // .app top, from short2.css
const SHELL_INSET = 30;     // 20px auto margin + 10px shell padding
const IFRAME_SCALE = 0.803; // .app iframe transform
const STAGE = { x: 52, y: 78, w: 940, h: 616 };

const CANVAS_LX = SHELL_INSET + IFRAME_SCALE * (STAGE.x + STAGE.w / 2);
const CANVAS_LY = 10 + IFRAME_SCALE * (STAGE.y + STAGE.h / 2);
const SLAB_LX = 540;

function placeApp(scale, t) {
  // The whole editor while it is being taken in, then the stage — which sits
  // left of the slab's centre, so anchoring there throughout would push the
  // panels off the right of a portrait frame.
  const anchorX = lerp(SLAB_LX, CANVAS_LX, span(t, 22.0, 25.0, easeInOut));
  const targetY = lerp(1010, 890, span(t, 20.6, 23.0, easeInOut))
    + lerp(0, 110, span(t, 33.4, 35.8, easeInOut));
  return [540 - scale * anchorX, targetY - APP_TOP - scale * CANVAS_LY];
}

// ── the playhead ───────────────────────────────────────────────────────────

/**
 * Runs the transport from film time. The transport advances on the wall clock,
 * which has nothing to do with the time the recorder is stepping through, so
 * scrubbing it frame by frame is the only way to record steady playback.
 */
function drivePlayback(t, from) {
  const scrub = sqDoc()?.getElementById('transport-scrub');
  if (!scrub) return;
  const length = Number(scrub.max) + 1;
  if (!length) return;
  const index = Math.floor((t - from) * CLIP_FPS) % length;
  if (Number(scrub.value) !== index) setInput(scrub, String(index));
}

// ── per-frame ──────────────────────────────────────────────────────────────

function paint(t) {
  if (t < CUT + 0.6) paintPlate(t);
  // A moment of the clip playing in the editor before the mask goes on, then
  // parked back on the first frame to paint.
  if (t >= 20.4 && t < 22.2) drivePlayback(t, 20.4);
  if (t >= PLAY) drivePlayback(t, PLAY);

  const plateOn = window_(t, 0.2, CUT - 0.1, 0.5, 0.16);
  const appOn = window_(t, CUT + 0.1, 39.9, 0.45, 0.3);
  const endOn = window_(t, 40.4, DURATION, 0.6, 0);

  // The footage: a slow push in, tightening onto the van as the patch fails.
  const vanX = (vanRect(W, H, plateFrame(t).i / (PLATE_FRAMES - 1)).x + vanRect(W, H, 0).w / 2) / W * 100;
  const scale = t < 8.0
    ? lerp(0.98, 1.06, span(t, 0, 8.0, (p) => p))
    : lerp(1.06, 1.42, span(t, 8.0, 17.4, easeInOut));
  const origin = t < 8.0 ? '50% 46%' : `${vanX}% 62%`;
  const jolt = t > SWIM && t < CUT ? Math.sin(t * 57) * 2.5 * span(t, SWIM, 12.0, (p) => p) : 0;

  $('plate').style.opacity = plateOn * (1 - endOn);
  $('plate').style.transformOrigin = origin;
  $('plate').style.transform =
    `translate(${jolt}px, ${lerp(0, -46, span(t, 8.0, 17.4, easeInOut))}px) scale(${scale})`;

  const appScale = t < 22.0
    ? lerp(0.94, 1.0, span(t, CUT, 20.8, back))
    : lerp(1.0, 1.72, span(t, 22.0, 27.0, easeInOut))
      * (1 - 0.30 * span(t, 33.4, FINISH + 0.6, easeInOut));
  const [tx, ty] = placeApp(appScale, t);
  $('app').style.opacity = appOn * (1 - endOn);
  $('app').style.transformOrigin = '0 0';
  $('app').style.transform =
    `translate(${tx}px, ${ty + lerp(50, 0, span(t, CUT, 20.6, easeOut))}px) scale(${appScale})`;

  const topOn = say(TOP, $('line-top'), $('line-top-text'), t);
  const bottomOn = say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);
  $('line-top').style.opacity = topOn * (1 - endOn);
  $('line-bottom').style.opacity = bottomOn * (1 - endOn);

  const stampOn = window_(t, 15.6, 18.6, 0.2, 0.3);
  $('stamp').style.opacity = stampOn;
  $('stamp').style.transform = `scale(${lerp(1.35, 1, span(t, 15.6, 16.1, back))})`;

  const flashAt = (a) => (t >= a - 0.12 && t < a + 0.22 ? 1 - clamp01((t - (a - 0.12)) / 0.34) : 0);
  $('flash').style.opacity = Math.max(flashAt(CUT), flashAt(FINISH + 0.7));

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

/** Fetch a file the ads build for themselves, as a data URL. */
async function asDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`could not read ${url}`));
    reader.readAsDataURL(blob);
  });
}

window.AD = {
  duration: DURATION,

  async ready() {
    for (let i = 0; i < PLATE_FRAMES; i += 1) {
      const t = i / (PLATE_FRAMES - 1);
      const frame = shopFrame({ width: W, height: H, t });
      filmed.push(frame);
      patched.push(patchFrame(frame, vanRect(W, H, t)));
    }

    const frame = $('sq');
    if (frame.contentDocument?.readyState !== 'complete') {
      await new Promise((r) => frame.addEventListener('load', r, { once: true }));
    }
    await new Promise((r) => setTimeout(r, 1600));

    // Both clips are real video files. The editor opens the filmed one through
    // its own File ▸ Open, and decodes it itself; the rebuilt one is what the
    // bridge hands back when the film says the job is done.
    cleanClipUrl = await asDataUrl('/assets/kerb-clean.webm');
    sqWin().__AD_OPEN = {
      name: 'kerb-pan.webm',
      path: 'kerb-pan.webm',
      clip: await asDataUrl('/assets/kerb.webm'),
    };
    clickIn('[data-command="file:open"]');
    for (let i = 0; i < 120 && !sqDoc()?.getElementById('transport-scrub'); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }

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
