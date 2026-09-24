// The Hazel film: thirty-four seconds of the mascot, and the seven true things
// she is used to say.
//
// What is real here and what is not:
//
//   real  Hazel. Every pose is one of the eight cut from the character sheet by
//         scripts/build-mascot.mjs and shipped in the app — the same files the
//         editor's empty stage, the welcome dialog and Mini's transcript load.
//         Nothing is redrawn for the film.
//   real  the picture she draws at 17s. It comes out of the shipped planner and
//         the shipped painter — imagine-plan.js and imagine-paint.js, imported
//         here, not copied — drawn at Hazelnut 5 Pro on the Hazelnut edition,
//         which is the one that thinks before it draws. The frame around it is
//         the film's; the pixels inside it are the product's.
//   real  every number and date on the end card. The discount, both prices, the
//         deadline and the plan name are read from packages/core/offers.js and
//         packages/core/pricing.js at render time. If the deal changes, this
//         card changes with it, and if the deal has ended the card says so
//         rather than advertising it.
//   not   the room she stands in, the leaves, and the light. Those are this
//         file's, and they are not claiming to be anything.
//
// The claims, and where each one is checked:
//
//   "twelve tools run on your machine"   LOCAL_TOOLS.length, counted here.
//   "and never stop"                     they are not gated by credits; the
//                                        trial has no deadline. license.js.
//   "700 credits, once"                  TRIAL_CREDIT_GRANT, read here.
//   "she thinks before she draws"        modelThinks('hazelnut-5-pro', 'pro')
//                                        is true and the trial's is false, so
//                                        the line names the edition. models.js.

import { planImage } from '/core/imagine-plan.js';
import { paint } from '/core/imagine-paint.js';
import { LOCAL_TOOLS } from '/core/tools.js';
import { TRIAL_CREDIT_GRANT, planFor } from '/core/pricing.js';
import { activeOffer, offerPrice, endsOn } from '/core/offers.js';

const $ = (id) => document.getElementById(id);

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a, b, p) => a + (b - a) * p;
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
/** Overshoots and settles — the difference between appearing and arriving. */
const back = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;

function window_(t, a, b, fadeIn = 0.3, fadeOut = 0.3) {
  if (t < a - fadeIn || t > b + fadeOut) return 0;
  if (t < a) return easeOut(clamp01((t - (a - fadeIn)) / fadeIn));
  if (t > b) return 1 - easeOut(clamp01((t - b) / fadeOut));
  return 1;
}
const span = (t, a, b, ease = easeInOut) => ease(clamp01((t - a) / (b - a)));

const DURATION = 34;
const END = 29.6;          // the card takes the frame

// ── the cast ───────────────────────────────────────────────────────────────

// [in, out, pose, entrance] — `entrance` is how she arrives, which is most of
// the character: a sleeping squirrel should not spring into frame.
const BEATS = [
  [0.6,  4.4,  'hazel-sleep',  'breathe'],
  [4.8,  8.2,  'hazel-camera', 'pop'],
  [8.6,  12.2, 'hazel-oops',   'shake'],
  [12.6, 16.4, 'hazel-idea',   'pop'],
  [16.8, 21.8, 'hazel-laptop', 'slide'],
  [22.2, 25.6, 'hazel-think',  'pop'],
  [26.0, 29.4, 'hazel-cheer',  'bounce'],
];

// How wide each pose is drawn. The cuts are all about 200px across but not the
// same shape, so a single width would make the tall ones tower over the wide
// ones; these are set so she reads the same size throughout.
const WIDTH = {
  'hazel-sleep': 680,
  'hazel-camera': 610,
  'hazel-oops': 620,
  'hazel-idea': 620,
  'hazel-laptop': 740,
  'hazel-think': 590,
  'hazel-cheer': 690,
};

// The five cuts that stop at the belly rather than at the ground. They get a
// faded bottom edge and no contact shadow; see hazel.css.
const BUSTS = new Set(['hazel-camera', 'hazel-oops', 'hazel-idea', 'hazel-think', 'hazel-cheer']);

const POSES = [...new Set(BEATS.map((b) => b[2]))];
const images = new Map();

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.9,  4.2,  'This is Hazel.'],
  [5.1,  8.0,  'She takes the picture.'],
  [8.9,  12.0, 'Something is always in it.'],
  [12.9, 16.2, 'So tell her what to remove.'],
  [17.1, 21.6, 'No photograph at all?'],
  [22.5, 25.4, 'And she thinks<br>before she draws.'],
  [26.3, 29.2, 'No deadline.<br>No card.'],
];

// Filled in at render time from the shipped modules — see the header.
const BOTTOM = [
  [1.6,  4.2,  'She lives in Hazelnut.'],
  [5.9,  8.0,  'You only have to hold still.'],
  [9.7,  12.0, 'The bin. The stranger. The sign.'],
  [13.7, 16.2, 'In words. Out it goes.'],
  [18.2, 21.6, 'She draws one — here, on your machine.'],
  [23.3, 25.4, 'On Hazelnut, with <em>Hazelnut 5 Pro</em>.'],
  [27.1, 29.2, null],   // written from the real grant and the real tool count
];

function say(list, node, textNode, t) {
  let shown = 0;
  let text = '';
  for (const [a, b, copy] of list) {
    if (copy == null) continue;
    const o = window_(t, a, b, 0.34, 0.3);
    if (o > shown) { shown = o; text = copy; }
  }
  if (text && textNode.dataset.copy !== text) {
    textNode.innerHTML = text;
    textNode.dataset.copy = text;
  }
  node.style.opacity = shown;
  // Copy rises a little as it arrives, which keeps a cut from feeling like a
  // slide change.
  node.style.transform = `translateY(${lerp(16, 0, shown)}px)`;
}

// ── the leaves ─────────────────────────────────────────────────────────────

// Deterministic: the recorder may render the same frame twice, and a leaf that
// moved in between would flicker.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const LEAF = '<svg width="46" height="46" viewBox="0 0 46 46">'
  + '<path d="M40 6C20 6 6 18 6 32c0 4 2 8 2 8s4-2 8-2c14 0 24-14 24-32Z" fill="#c2662c"/>'
  + '<path d="M8 40C16 32 26 20 38 8" stroke="#8c4a1c" stroke-width="2.4" fill="none"/></svg>';
const ACORN = '<svg width="38" height="42" viewBox="0 0 38 42">'
  + '<path d="M19 42c8 0 13-7 13-15 0-6-5-11-13-11S6 21 6 27c0 8 5 15 13 15Z" fill="#c98a4b"/>'
  + '<path d="M5 15c0-4 6-7 14-7s14 3 14 7-6 6-14 6-14-2-14-6Z" fill="#6b3a17"/>'
  + '<path d="M19 8V2" stroke="#6b3a17" stroke-width="3" stroke-linecap="round"/></svg>';

const bits = [];

function makeFlora() {
  const rand = mulberry32(0x42e1);
  const flora = $('flora');
  for (let i = 0; i < 18; i += 1) {
    const el = document.createElement('div');
    el.className = 'bit';
    el.innerHTML = rand() < 0.68 ? LEAF : ACORN;
    flora.appendChild(el);
    bits.push({
      el,
      x: rand() * 1080,
      // Spread down the whole fall so they are not a single falling rank.
      phase: rand(),
      speed: 0.030 + rand() * 0.030,
      sway: 40 + rand() * 90,
      swayRate: 0.5 + rand() * 0.9,
      spin: (rand() - 0.5) * 150,
      scale: 0.6 + rand() * 0.9,
      alpha: 0.24 + rand() * 0.34,
    });
  }
}

function moveFlora(t, on) {
  for (const bit of bits) {
    const p = (bit.phase + t * bit.speed) % 1;
    const y = -140 + p * 2200;
    const x = bit.x + Math.sin((t * bit.swayRate) + bit.phase * 8) * bit.sway;
    bit.el.style.transform =
      `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(bit.spin * (t + bit.phase * 10)).toFixed(1)}deg) scale(${bit.scale.toFixed(2)})`;
    // Fade in at the top and out at the bottom, so none of them pops.
    const edge = Math.min(clamp01(p / 0.08), clamp01((1 - p) / 0.12));
    bit.el.style.opacity = bit.alpha * edge * on;
  }
}

// ── the drawn picture ──────────────────────────────────────────────────────

// Hazelnut 5 Pro on the Hazelnut edition: the combination that thinks. The
// prompt is the sort of thing the tool is for, and the seed is fixed so the
// film is the same film every time it is shot.
const PROMPT = 'a cat in a field of flowers';

function drawPicture() {
  const canvas = $('drawn');
  const plan = planImage({
    prompt: PROMPT,
    model: 'hazelnut-5-pro',
    edition: 'pro',
    width: 940,
    height: 940,
    seed: 9,
  });
  canvas.width = plan.width;
  canvas.height = plan.height;
  paint(canvas.getContext('2d'), plan);
  $('plate-tag').textContent = `Hazelnut 5 Pro · “${PROMPT}”`;
}

// ── the end card ───────────────────────────────────────────────────────────

function fillEndCard() {
  const plan = planFor('hazelnut', 'pro');
  const offer = activeOffer();
  const price = offer && offerPrice(plan, offer);

  // No offer, or one that has closed: the card sells the product at its own
  // price rather than a deal that is not there. A film outlives a promotion.
  if (!price) {
    $('deal-head').textContent = plan.name;
    $('deal-price').innerHTML = `<b>$${plan.monthlyUsd}</b> / month`;
    $('deal-meta').textContent = 'Windows · Mac';
    return;
  }

  $('deal-head').textContent = offer.headline;
  $('deal-price').innerHTML =
    `<s>$${price.wasMonthlyUsd}</s> &nbsp; <b>$${price.monthlyUsd.toFixed(2)}</b> / month`;
  $('deal-meta').textContent = `Ends ${endsOn(offer)} · enter your access code`;
}

/** The claim in the last line, counted rather than typed. */
function lastLine() {
  return `${TRIAL_CREDIT_GRANT} credits, once. `
    + `${LOCAL_TOOLS.length} tools run on your machine, and never stop.`;
}

// ── the frame ──────────────────────────────────────────────────────────────

function currentBeat(t) {
  for (const [a, b, pose, entrance] of BEATS) {
    if (t >= a - 0.34 && t <= b + 0.3) return { a, b, pose, entrance };
  }
  return null;
}

function poseTransform(beat, t) {
  const age = t - beat.a;
  const life = beat.b - beat.a;
  let scale = 1;
  let rot = 0;
  let dy = 0;
  let squash = 1;

  // Arrival.
  const inP = clamp01((age + 0.34) / 0.62);
  if (beat.entrance === 'pop') {
    scale = lerp(0.52, 1, back(inP));
    rot = lerp(-9, 0, easeOut(inP));
  } else if (beat.entrance === 'bounce') {
    scale = lerp(0.6, 1, back(inP));
    dy = -Math.abs(Math.sin(inP * Math.PI)) * 120 * (1 - inP);
  } else if (beat.entrance === 'slide') {
    scale = lerp(0.88, 1, easeOut(inP));
  } else if (beat.entrance === 'shake') {
    scale = lerp(0.72, 1, back(inP));
    // A flinch that dies away, rather than a wobble that runs all beat.
    rot = Math.sin(age * 26) * 7 * Math.exp(-age * 2.6);
  } else {
    scale = lerp(0.96, 1, easeOut(inP));
  }

  // Life, while she is on screen.
  if (beat.entrance === 'breathe') {
    // Asleep: a slow swell, no bob at all.
    squash = 1 + Math.sin(age * 1.5) * 0.022;
  } else {
    dy += Math.sin(age * 2.9 + 0.4) * 9;
    rot += Math.sin(age * 1.7) * 1.6;
    squash = 1 + Math.sin(age * 2.9 + 0.4 + Math.PI) * 0.016;
  }

  // She leans out of frame rather than blinking off it.
  const outP = clamp01((t - beat.b) / 0.3);
  if (outP > 0) {
    scale *= lerp(1, 0.84, easeInOut(outP));
    dy += lerp(0, 34, easeInOut(outP));
  }

  const slide = beat.entrance === 'slide' ? lerp(-90, 0, easeOut(inP)) : 0;
  return { scale, rot, dy, squash, slide, life };
}

function paintFrame(t) {
  const beat = currentBeat(t);
  const img = $('hazel');

  if (beat) {
    const src = `/mascot/${beat.pose}.png`;
    if (!img.dataset.pose || img.dataset.pose !== beat.pose) {
      img.src = src;
      img.dataset.pose = beat.pose;
      img.style.width = `${WIDTH[beat.pose]}px`;
      img.className = BUSTS.has(beat.pose) ? 'hazel hazel--bust' : 'hazel';
    }
    const { scale, rot, dy, squash, slide } = poseTransform(beat, t);
    const on = window_(t, beat.a, beat.b, 0.34, 0.3);
    img.style.opacity = on;
    img.style.transform =
      `translate(calc(-50% + ${slide.toFixed(1)}px), ${dy.toFixed(1)}px) `
      + `rotate(${rot.toFixed(2)}deg) scale(${(scale).toFixed(3)}, ${(scale * squash).toFixed(3)})`;

    // The shadow tracks her: smaller and darker when she is low, wider and
    // fainter when she is up. A bust has nothing to cast one onto.
    const lift = clamp01(-dy / 120);
    $('shadow').style.opacity = BUSTS.has(beat.pose) ? 0 : on * lerp(0.85, 0.3, lift);
    $('shadow').style.transform =
      `scale(${lerp(1, 1.22, lift).toFixed(3)}, ${lerp(1, 0.7, lift).toFixed(3)})`;
  } else {
    img.style.opacity = 0;
    $('shadow').style.opacity = 0;
  }

  const lit = window_(t, 0.8, END - 0.4, 1.4, 0.4);
  $('glow').style.opacity = lit * (0.72 + 0.28 * Math.sin(t * 0.9));
  // The room warms across the film.
  $('sky-warm').style.opacity = span(t, 3, 24, easeInOut) * 0.85 * (1 - span(t, END - 0.4, END, easeOut));
  moveFlora(t, window_(t, 1.4, END - 0.4, 2.2, 0.5));

  say(TOP, $('line-top'), $('line-top-text'), t);
  say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);

  // The picture, while she is at the laptop.
  const plateOn = window_(t, 17.6, 21.6, 0.5, 0.3);
  $('plate').style.opacity = plateOn;
  $('plate').style.transform =
    `translateY(${lerp(30, 0, plateOn).toFixed(1)}px) `
    + `scale(${lerp(0.86, 1, back(clamp01((t - 17.1) / 0.9))).toFixed(3)}) rotate(-2deg)`;

  // The end card.
  const endOn = span(t, END, END + 0.6, easeOut);
  $('end').style.opacity = endOn;
  $('end-hazel').style.transform = `scale(${lerp(0.8, 1, span(t, END + 0.2, END + 1.1, back)).toFixed(3)})`;
  $('deal').style.opacity = span(t, END + 0.9, END + 1.7, easeOut);
  $('deal').style.transform = `scale(${lerp(0.94, 1, span(t, END + 0.9, END + 1.7, back)).toFixed(3)})`;
  $('end-plat').style.opacity = span(t, END + 1.8, END + 2.5, easeOut);

  // One soft flash on the cut to the card.
  const flashAt = (a) => (t >= a - 0.1 && t < a + 0.26 ? 1 - clamp01((t - (a - 0.1)) / 0.36) : 0);
  $('flash').style.opacity = flashAt(END) * 0.5;

  const film = $('film');
  if (film.scrollLeft || film.scrollTop) { film.scrollLeft = 0; film.scrollTop = 0; }
}

// ── the scene ──────────────────────────────────────────────────────────────

window.AD = {
  duration: DURATION,

  async ready() {
    makeFlora();
    drawPicture();
    fillEndCard();

    BOTTOM[BOTTOM.length - 1][2] = lastLine();

    // Decode every pose up front. A pose that arrives mid-shoot would be a
    // blank frame in the film and nothing would say so afterwards.
    await Promise.all(POSES.concat(['hazel']).map((pose) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { images.set(pose, img); resolve(); };
      img.onerror = () => reject(new Error(`pose ${pose} did not load`));
      img.src = `/mascot/${pose}.png`;
    })));

    await new Promise((r) => setTimeout(r, 120));
    return true;
  },

  seek(t) {
    paintFrame(t);
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
};
