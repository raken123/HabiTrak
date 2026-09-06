// The Short: a sofa on a pavement, the old way of removing it, and Mini.
//
// Two things in here are real and one is not, and the difference matters.
//
//   Real: the mess. `naiveFill` is an actual patch fill of the kind a clone
//         stamp performs, run on the actual photograph. Nothing about that
//         frame is drawn to look bad — it is what that algorithm does to
//         railings.
//   Real: the phone. That is Hazelnut Mini, running its own code, showing its
//         own progress as it looks the place up.
//   Not:  the final clean frame. It is the same drawing rendered without the
//         sofa — the ground truth of a synthetic scene, standing in for a
//         generation this machine cannot make. It must be replaced with a real
//         result before this is published anywhere.

import { streetScene, naiveFill, sofaRegion, SOFA_RECT } from './street-scene.js';

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

// ── the three states of the photograph ─────────────────────────────────────

let dirty = null;      // with the sofa
let clean = null;      // the same drawing without it
let cursed = null;     // what a patch fill actually does
let region = null;

function buildPlates() {
  dirty = streetScene({ width: W, height: H, sofa: true });
  clean = streetScene({ width: W, height: H, sofa: false });
  region = sofaRegion(W, H);
  cursed = naiveFill(dirty, region);
}

const photo = () => $('photo').getContext('2d');

/** Draw one of the plates, optionally with a mask being painted over the sofa. */
function paintPlate(t) {
  const ctx = photo();
  ctx.clearRect(0, 0, W, H);

  // 6.0–10.5 the mask goes on; 10.5–14.0 the fill takes over.
  const masking = span(t, 6.2, 10.2, (p) => p);
  const filling = span(t, 10.6, 13.6, (p) => p);
  const revealing = span(t, 34.0, 36.6, easeInOut);

  if (revealing > 0) {
    ctx.drawImage(dirty, 0, 0);
    // Wipe the clean plate in from the left, so the sofa leaves rather than
    // blinks out.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W * revealing, H);
    ctx.clip();
    ctx.drawImage(clean, 0, 0);
    ctx.restore();
    if (revealing < 1) {
      ctx.fillStyle = 'rgba(224,137,74,.9)';
      ctx.fillRect(W * revealing - 4, 0, 8, H);
    }
    return;
  }

  if (filling > 0) {
    ctx.drawImage(dirty, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(region.x - 30, region.y - 30, (region.w + 60) * filling, region.h + 60);
    ctx.clip();
    ctx.drawImage(cursed, 0, 0);
    ctx.restore();
    return;
  }

  ctx.drawImage(dirty, 0, 0);

  if (masking > 0) {
    // A brush scrubbing over the sofa, left to right and back.
    ctx.save();
    ctx.fillStyle = 'rgba(255,0,212,.5)';
    const strokes = Math.floor(masking * 26);
    for (let i = 0; i <= strokes; i += 1) {
      const p = i / 26;
      const row = Math.floor(p * 4);
      const along = (p * 4) % 1;
      const x = region.x + (row % 2 ? 1 - along : along) * region.w;
      const y = region.y + (row + 0.5) * (region.h / 4);
      ctx.beginPath();
      ctx.arc(x, y, 46, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.4, 3.4, 'Someone dumped a sofa<br>outside the flat.'],
  [3.7, 6.0, 'So you try to<br>paint it out.'],
  [6.4, 10.2, 'Mask it.'],
  [10.6, 13.6, 'Fill it.'],
  [14.2, 17.4, 'It has no idea what<br>was <em>behind</em> it.'],
  [18.0, 20.4, 'Try it on your phone<br>instead.'],
  [21.0, 24.0, 'Say what should go.'],
  [25.6, 28.4, 'It works out <em>where</em><br>the photo was taken.'],
  [28.8, 33.4, 'Then it looks the<br>place up.'],
  [34.4, 39.6, 'The railings come back.<br><em>The right ones.</em>'],
];

const BOTTOM = [
  [1.2, 3.4, 'It has to go.'],
  [7.0, 13.6, 'Clone. Patch. Undo. Repeat.'],
  [22.0, 24.0, '“remove the sofa outside”'],
  [30.0, 33.4, 'Twenty credits. One sentence.'],
];

function say(list, node, textNode, t) {
  let shown = 0;
  let text = '';
  for (const [a, b, copy] of list) {
    const o = window_(t, a, b, 0.34, 0.34);
    if (o > shown) { shown = o; text = copy; }
  }
  if (text && textNode.dataset.copy !== text) {
    textNode.innerHTML = text;
    textNode.dataset.copy = text;
  }
  node.style.opacity = shown;
  node.style.transform = `translateY(${lerp(26, 0, shown)}px)`;
  return shown;
}

// ── cues into the phone ────────────────────────────────────────────────────

const miniDoc = () => $('mini').contentDocument;
const cues = [];
const at = (t, fn) => cues.push({ t, fn, done: false });
const tracks = [];
const over = (a, b, fn) => tracks.push({ a, b, fn });

const clickIn = (sel) => miniDoc()?.querySelector(sel)?.click();
function setField(sel, value) {
  const doc = miniDoc();
  const input = doc?.querySelector(sel);
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
}

at(19.6, () => clickIn('#attach'));
const MESSAGE = 'remove the sofa outside';
over(21.4, 23.8, (p) => setField('#composer-input', MESSAGE.slice(0, Math.round(easeInOut(p) * MESSAGE.length))));
at(24.6, () => clickIn('#send'));

// ── per-frame ──────────────────────────────────────────────────────────────

function paint(t) {
  paintPlate(t);

  const plateOn = window_(t, 0.2, 17.6, 0.5, 0.6) || window_(t, 33.6, 40.0, 0.5, 0.6);
  const phoneOn = window_(t, 18.4, 33.4, 0.5, 0.5);
  const endOn = window_(t, 40.4, DURATION, 0.6, 0);

  // The mess is a small patch in a tall frame, so the camera goes to it. The
  // origin is the middle of where the sofa was, which is also where the
  // railings have to come back.
  const FOCUS_X = (SOFA_RECT.x + SOFA_RECT.w / 2) * 100;
  const FOCUS_Y = (SOFA_RECT.y + SOFA_RECT.h / 2) * 100;

  const jolt = t > 13.4 && t < 14.3 ? Math.sin((t - 13.4) * 48) * (1 - (t - 13.4) / 0.9) * 14 : 0;

  let scale;
  let origin;
  let dy;
  if (t < 13.2) {
    scale = lerp(0.98, 1.04, span(t, 0, 13.2, (p) => p));
    origin = '50% 45%';
    dy = lerp(0, -40, span(t, 0, 13.2, (p) => p));
  } else if (t < 18.0) {
    // In on the damage.
    scale = lerp(1.04, 1.95, span(t, 13.4, 16.6, easeInOut));
    origin = `${FOCUS_X}% ${FOCUS_Y}%`;
    dy = -40;
  } else {
    // Back out across the reveal, so the whole street is there at the end.
    scale = lerp(1.75, 1.06, span(t, 33.8, 39.4, easeInOut));
    origin = `${FOCUS_X}% ${FOCUS_Y}%`;
    dy = lerp(-30, -70, span(t, 33.8, 39.4, easeInOut));
  }

  $('plate').style.opacity = plateOn * (1 - endOn);
  $('plate').style.transformOrigin = origin;
  $('plate').style.transform = `translate(${jolt}px, ${dy}px) scale(${scale})`;

  $('ring').style.opacity = window_(t, 1.4, 3.3, 0.3, 0.4) * plateOn;

  $('phone').style.opacity = phoneOn * (1 - endOn);
  $('phone').style.transform = `translateY(${lerp(60, 0, span(t, 18.2, 19.4, easeOut))}px) scale(${lerp(0.94, 1, span(t, 18.2, 19.6, back))})`;

  const topOn = say(TOP, $('line-top'), $('line-top-text'), t);
  say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);
  $('line-top').style.opacity = topOn * (1 - endOn);
  $('line-bottom').style.opacity = Number($('line-bottom').style.opacity) * (1 - endOn);

  const stampOn = window_(t, 14.4, 17.4, 0.22, 0.35);
  $('stamp').style.opacity = stampOn;
  $('stamp').style.transform = `scale(${lerp(1.35, 1, span(t, 14.4, 14.9, back))})`;

  $('end').style.opacity = endOn;
  $('end-mark').style.transform = `scale(${lerp(0.8, 1, span(t, 40.6, 41.6, back))})`;

  // Keep Mini's own spinner turning at video rate, not wall-clock.
  for (const spinner of miniDoc()?.querySelectorAll('.spinner') || []) {
    spinner.style.animation = 'none';
    spinner.style.transform = `rotate(${(t * 400) % 360}deg)`;
  }
}

// ── entry point ────────────────────────────────────────────────────────────

let lastT = -1;

window.AD = {
  duration: DURATION,

  async ready() {
    buildPlates();
    const frame = $('mini');
    if (frame.contentDocument?.readyState !== 'complete') {
      await new Promise((r) => frame.addEventListener('load', r, { once: true }));
    }
    await new Promise((r) => setTimeout(r, 1400));
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
