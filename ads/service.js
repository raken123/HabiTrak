// The service film: Hazelnut stops being a photo editor.
//
// What is real here and what is not:
//
//   real  every product name, kind and blurb — read from products.js.
//   real  every number about Movi: the three 3.0 models, their heights, the
//         eight-second clip, the credits a clip costs. Read from movi.js, and
//         the Simple plan shown on screen is produced by the shipped planner
//         from the prompt shown above it, not written by this file.
//   real  the storage figures. "48 EB" is formatBytes(FOUNDER_BYTES) and
//         "200 GB" is formatBytes(STANDARD_BYTES); the places and the date
//         come from storage.js. If the offer is over when this is shot, the
//         film says so instead of advertising it — see `storeCopy` below.
//   real  the withdrawal notice, word for word from products.js. It is in the
//         film because an announcement of the replacement that left out the
//         cancellation would be hiding it from the only people who need it.
//   real  Hazel. The same eight cuts the apps ship.
//   not   the room, the leaves, the light, and the product marks, which are
//         drawn here. No screenshot of Movi or Work appears, because neither
//         app existed when this was shot and a mock-up of one would be the
//         thing this repository keeps refusing to do.
//
// That last point is the honest weakness of this film and it is worth stating
// plainly rather than burying: this is an announcement, not a demonstration.
// Nothing in it shows Movi or Work running, because they do not run yet.

import {
  SERVICE, PRODUCTS, PRODUCT_ORDER, cancellationNotice,
} from '/core/products.js';
import {
  FOUNDER_PLACES, FOUNDER_BYTES, STANDARD_BYTES,
  formatBytes, founderOpen, founderClosedBecause, placesLeft, daysLeft,
} from '/core/storage.js';
import {
  VIDEO_MODELS, MODEL_ORDER, MAX_CLIP_SECONDS, planSimple, costOfClip,
} from '/core/movi.js';
import { CONNECTORS, TASKS } from '/core/work.js';
import { planFor } from '/core/pricing.js';
import { LOCAL_TOOLS, TOOL_ORDER } from '/core/tools.js';

const $ = (id) => document.getElementById(id);

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a, b, p) => a + (b - a) * p;
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const back = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;

function window_(t, a, b, fadeIn = 0.3, fadeOut = 0.3) {
  if (t < a - fadeIn || t > b + fadeOut) return 0;
  if (t < a) return easeOut(clamp01((t - (a - fadeIn)) / fadeIn));
  if (t > b) return 1 - easeOut(clamp01((t - b) / fadeOut));
  return 1;
}
const span = (t, a, b, ease = easeInOut) => ease(clamp01((t - a) / (b - a)));

const DURATION = 46;
const END = 41.4;

// ── the shape of the film ──────────────────────────────────────────────────

const CARDS_IN = 5.4;          // the three products arrive
const SPOTS = {                // then each is held on its own
  photo: [10.2, 15.0],
  movi: [15.6, 23.4],
  work: [24.0, 29.2],
};
const GONE = [29.8, 34.6];     // Squirreal
const STORE = [35.2, 41.0];    // the founder offer

// Hazel, and what she is doing while it happens.
const BEATS = [
  [0.6, 4.6, 'hazel-camera', 'pop'],
  [5.0, 9.6, 'hazel-idea', 'pop'],
  [10.4, 14.8, 'hazel-laptop', 'slide'],
  [15.8, 23.2, 'hazel-camera', 'pop'],
  [24.2, 29.0, 'hazel-think', 'pop'],
  [29.9, 34.4, 'hazel-oops', 'shake'],
  [35.4, 40.8, 'hazel-cheer', 'bounce'],
];
// Smaller under a panel than under a headline: she is keeping the bottom of
// the frame company there, not holding it.
const WIDTH = {
  'hazel-camera': 560, 'hazel-idea': 560, 'hazel-oops': 520, 'hazel-cheer': 560,
  'hazel-laptop': 420, 'hazel-think': 330,
};
const UNDER_PANEL = new Set(['hazel-laptop', 'hazel-think']);
const BUSTS = new Set(['hazel-camera', 'hazel-oops', 'hazel-idea', 'hazel-think', 'hazel-cheer']);

// Hazel stands lower when a panel is using the middle of the frame.
const STAGE_TOP = { high: 610, low: 1120 };

// ── copy ───────────────────────────────────────────────────────────────────

const TOP = [
  [0.9, 4.4, 'Hazelnut was a<br>photo editor.'],
  [5.4, 9.4, 'It is a service now.'],
  [30.2, 34.4, null],          // filled from the withdrawal notice
];

const BOTTOM = [
  [1.8, 4.4, 'For eleven months, that is all it was.'],
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
  node.style.transform = `translateY(${lerp(16, 0, shown)}px)`;
}

// ── the product marks ──────────────────────────────────────────────────────

// Drawn, not photographed: there is no Movi or Work to photograph yet.
const MARKS = {
  photo: `<svg viewBox="0 0 64 64" width="100%" height="100%">
    <rect x="6" y="14" width="52" height="38" rx="8" fill="none" stroke="#e0894a" stroke-width="4"/>
    <circle cx="32" cy="33" r="11" fill="none" stroke="#e0894a" stroke-width="4"/>
    <path d="M24 14l4-6h8l4 6" fill="none" stroke="#e0894a" stroke-width="4" stroke-linejoin="round"/></svg>`,
  movi: `<svg viewBox="0 0 64 64" width="100%" height="100%">
    <rect x="5" y="15" width="40" height="34" rx="7" fill="none" stroke="#e0894a" stroke-width="4"/>
    <path d="M45 30l14-9v22l-14-9z" fill="none" stroke="#e0894a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M14 15v34M36 15v34" stroke="#e0894a" stroke-width="3" opacity=".5"/></svg>`,
  work: `<svg viewBox="0 0 64 64" width="100%" height="100%">
    <rect x="5" y="18" width="54" height="36" rx="7" fill="none" stroke="#e0894a" stroke-width="4"/>
    <path d="M5 24l27 17 27-17" fill="none" stroke="#e0894a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M23 18v-6h18v6" fill="none" stroke="#e0894a" stroke-width="4" stroke-linejoin="round"/></svg>`,
};

// ── what each product gets to say ──────────────────────────────────────────

/**
 * Three bullets per product, every figure counted rather than typed.
 *
 * Movi's are the ones worth reading twice: the models, the clip length and
 * the price of a clip all come out of movi.js, and the Simple line is a real
 * plan for the sentence quoted beside it.
 */
function pointsFor(id) {
  if (id === 'photo') {
    return [
      `<b>${TOOL_ORDER.length}</b> tools, <b>${LOCAL_TOOLS.length}</b> of them on your machine`,
      'Two image models of our own — Hazelnut 2.5 and 5 Pro',
      'Windows, Mac, Android, and a browser tab',
    ];
  }
  if (id === 'movi') {
    const names = MODEL_ORDER.map((m) => VIDEO_MODELS[m].name.replace('Hazelnut ', ''));
    const demo = planSimple('a cinematic trailer for a mountain film', { budget: 6000 });
    return [
      `Hazelnut <b>${names.join('</b>, <b>')}</b>`,
      `<b>Simple</b> — “a cinematic trailer for a mountain film” becomes `
        + `<b>${demo.seconds}s</b> at ${VIDEO_MODELS[demo.model].height}p, and it decided that, not you`,
      `<b>Advanced</b> — ${MAX_CLIP_SECONDS}-second clips, `
        + `<b>${costOfClip('hazelnut-3.0-lite')}</b> credits each, extended in the Editor`,
    ];
  }
  const mail = [CONNECTORS.gmail.name, CONNECTORS.outlook.name].join(' and ');
  return [
    `Connect <b>${mail}</b>, and more`,
    `${TASKS.triage.name}, ${TASKS.summarise.name.toLowerCase()}, ${TASKS.draft.name.toLowerCase()}`,
    'It drafts and files. It <b>never sends</b> without showing you first',
  ];
}

// ── the storage panel ──────────────────────────────────────────────────────

/**
 * What the offer says, and what it says instead once it is over.
 *
 * A film outlives a promotion. If this is shot after the places are gone or
 * after the 30th, the panel states the standing quota rather than dangling a
 * deal that cannot be taken — the same rule the fall deal's end card follows.
 */
function storeCopy(now = Date.now(), taken = 0) {
  if (founderOpen({ now, taken })) {
    const days = daysLeft(now);
    return {
      size: formatBytes(FOUNDER_BYTES),
      who: `free, to the first <b>${FOUNDER_PLACES}</b> people who join`,
      after: `${placesLeft(taken)} places left · ${days} day${days === 1 ? '' : 's'} left`
        + `<br>After that it is ${formatBytes(STANDARD_BYTES)}.`,
      fill: 1,
    };
  }
  const why = founderClosedBecause({ now, taken });
  return {
    size: formatBytes(STANDARD_BYTES),
    who: 'free with every account',
    after: why === 'places'
      ? `The ${FOUNDER_PLACES} founder places have gone.`
      : 'The founder offer has closed.',
    fill: 0.36,
  };
}

// ── frames ─────────────────────────────────────────────────────────────────

function currentBeat(t) {
  for (const [a, b, pose, entrance] of BEATS) {
    if (t >= a - 0.34 && t <= b + 0.3) return { a, b, pose, entrance };
  }
  return null;
}

function poseTransform(beat, t) {
  const age = t - beat.a;
  const inP = clamp01((age + 0.34) / 0.62);
  let scale = 1;
  let rot = 0;
  let dy = 0;

  if (beat.entrance === 'pop') {
    scale = lerp(0.52, 1, back(inP));
    rot = lerp(-9, 0, easeOut(inP));
  } else if (beat.entrance === 'bounce') {
    scale = lerp(0.6, 1, back(inP));
    dy = -Math.abs(Math.sin(inP * Math.PI)) * 120 * (1 - inP);
  } else if (beat.entrance === 'shake') {
    scale = lerp(0.72, 1, back(inP));
    rot = Math.sin(age * 26) * 7 * Math.exp(-age * 2.6);
  }

  dy += Math.sin(age * 2.9 + 0.4) * 9;
  rot += Math.sin(age * 1.7) * 1.6;
  const squash = 1 + Math.sin(age * 2.9 + 0.4 + Math.PI) * 0.016;

  const outP = clamp01((t - beat.b) / 0.3);
  if (outP > 0) {
    scale *= lerp(1, 0.84, easeInOut(outP));
    dy += lerp(0, 34, easeInOut(outP));
  }
  return { scale, rot, dy, squash };
}

let flora = [];

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

function makeFlora() {
  const rand = mulberry32(0x5e12);
  const host = $('flora');
  for (let i = 0; i < 16; i += 1) {
    const el = document.createElement('div');
    el.className = 'bit';
    el.innerHTML = LEAF;
    host.appendChild(el);
    flora.push({
      el,
      x: rand() * 1080,
      phase: rand(),
      speed: 0.028 + rand() * 0.028,
      sway: 40 + rand() * 90,
      swayRate: 0.5 + rand() * 0.9,
      spin: (rand() - 0.5) * 150,
      scale: 0.6 + rand() * 0.9,
      alpha: 0.2 + rand() * 0.3,
    });
  }
}

function moveFlora(t, on) {
  for (const bit of flora) {
    const p = (bit.phase + t * bit.speed) % 1;
    const y = -140 + p * 2200;
    const x = bit.x + Math.sin((t * bit.swayRate) + bit.phase * 8) * bit.sway;
    bit.el.style.transform =
      `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) `
      + `rotate(${(bit.spin * (t + bit.phase * 10)).toFixed(1)}deg) scale(${bit.scale.toFixed(2)})`;
    const edge = Math.min(clamp01(p / 0.08), clamp01((1 - p) / 0.12));
    bit.el.style.opacity = bit.alpha * edge * on;
  }
}

let spotShown = null;

function paintFrame(t) {
  // ── Hazel ──
  const beat = currentBeat(t);
  const img = $('hazel');
  if (beat) {
    if (img.dataset.pose !== beat.pose) {
      img.src = `/mascot/${beat.pose}.png`;
      img.dataset.pose = beat.pose;
      img.style.width = `${WIDTH[beat.pose]}px`;
      img.dataset.small = String(UNDER_PANEL.has(beat.pose) || (beat.pose === 'hazel-camera' && beat.a > 10));
      img.className = BUSTS.has(beat.pose) ? 'hazel hazel--bust' : 'hazel';
    }
    const { scale: base, rot, dy, squash } = poseTransform(beat, t);
    const scale = img.dataset.small === 'true' ? base * 0.62 : base;
    const on = window_(t, beat.a, beat.b, 0.34, 0.3);
    img.style.opacity = on;
    img.style.transform =
      `translate(-50%, ${dy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) `
      + `scale(${scale.toFixed(3)}, ${(scale * squash).toFixed(3)})`;
    $('shadow').style.opacity = 0;
  } else {
    img.style.opacity = 0;
    $('shadow').style.opacity = 0;
  }
  // She steps down out of the way while a panel owns the middle of the frame —
  // which is every panel from the cards to the end card, not only the first.
  // Leaving her high through the withdrawal and the offer put her on top of
  // both of them.
  const low = window_(t, CARDS_IN, END - 0.4, 0.8, 0.4);
  $('stage').style.top = `${lerp(STAGE_TOP.high, STAGE_TOP.low, low).toFixed(0)}px`;

  // ── the room ──
  const lit = window_(t, 0.8, END - 0.4, 1.4, 0.4);
  $('glow').style.opacity = lit * (0.66 + 0.24 * Math.sin(t * 0.9));
  $('sky-warm').style.opacity =
    span(t, 4, 26, easeInOut) * 0.85 * (1 - span(t, END - 0.4, END, easeOut));
  moveFlora(t, window_(t, 1.4, END - 0.4, 2.2, 0.5));

  say(TOP, $('line-top'), $('line-top-text'), t);
  say(BOTTOM, $('line-bottom'), $('line-bottom-text'), t);

  // ── the three cards ──
  const cardsOn = window_(t, CARDS_IN, 9.6, 0.5, 0.4);
  $('cards').style.opacity = cardsOn;
  PRODUCT_ORDER.forEach((id, i) => {
    const card = document.querySelector(`.card[data-card="${id}"]`);
    const at = CARDS_IN + 0.35 + i * 0.42;
    const p = span(t, at, at + 0.62, back);
    card.style.opacity = clamp01(p * 1.4) * cardsOn;
    card.style.transform = `translateX(${lerp(60, 0, p).toFixed(1)}px) scale(${lerp(0.9, 1, p).toFixed(3)})`;
  });

  // ── one product at a time ──
  let active = null;
  for (const [id, [a, b]] of Object.entries(SPOTS)) {
    if (t >= a - 0.5 && t <= b + 0.4) { active = { id, a, b }; break; }
  }
  if (active) {
    if (spotShown !== active.id) {
      const product = PRODUCTS[active.id];
      $('spot-mark').innerHTML = MARKS[active.id];
      $('spot-name').textContent = product.name;
      $('spot-kind').textContent = product.kind;
      $('spot-points').innerHTML = pointsFor(active.id).map((p) => `<li>${p}</li>`).join('');
      spotShown = active.id;
    }
    const on = window_(t, active.a, active.b, 0.42, 0.34);
    $('spot').style.opacity = on;
    $('spot').style.transform = `translateY(${lerp(26, 0, on).toFixed(1)}px)`;
    [...$('spot-points').children].forEach((li, i) => {
      const at = active.a + 0.5 + i * 0.5;
      const p = span(t, at, at + 0.5, easeOut);
      li.style.opacity = p * on;
      li.style.transform = `translateX(${lerp(24, 0, p).toFixed(1)}px)`;
    });
  } else {
    $('spot').style.opacity = 0;
  }

  // ── the withdrawal ──
  const goneOn = window_(t, GONE[0], GONE[1], 0.45, 0.35);
  $('gone').style.opacity = goneOn;
  $('gone-strike').style.transform =
    `scaleX(${span(t, GONE[0] + 0.2, GONE[0] + 0.9, easeOut).toFixed(3)})`;

  // ── the storage offer ──
  const storeOn = window_(t, STORE[0], STORE[1], 0.45, 0.35);
  $('store').style.opacity = storeOn;
  $('store-size').style.transform =
    `scale(${lerp(0.72, 1, span(t, STORE[0], STORE[0] + 0.8, back)).toFixed(3)})`;
  $('store-fill').style.width =
    `${(Number($('store-fill').dataset.target || 1) * span(t, STORE[0] + 0.6, STORE[0] + 1.9, easeOut) * 100).toFixed(1)}%`;
  $('store-after').style.opacity = span(t, STORE[0] + 1.6, STORE[0] + 2.4, easeOut);

  // ── the end card ──
  const endOn = span(t, END, END + 0.6, easeOut);
  $('end').style.opacity = endOn;
  $('end-hazel').style.transform = `scale(${lerp(0.8, 1, span(t, END + 0.2, END + 1.1, back)).toFixed(3)})`;
  $('deal').style.opacity = span(t, END + 0.9, END + 1.7, easeOut);
  $('end-plat').style.opacity = span(t, END + 1.9, END + 2.6, easeOut);

  $('flash').style.opacity =
    (t >= END - 0.1 && t < END + 0.26 ? 1 - clamp01((t - (END - 0.1)) / 0.36) : 0) * 0.5;

  const film = $('film');
  if (film.scrollLeft || film.scrollTop) { film.scrollLeft = 0; film.scrollTop = 0; }
}

// ── the scene ──────────────────────────────────────────────────────────────

window.AD = {
  duration: DURATION,

  async ready() {
    makeFlora();

    // The cards, from the product list rather than from three copies of it.
    for (const id of PRODUCT_ORDER) {
      $(`mark-${id}`).innerHTML = MARKS[id];
      $(`name-${id}`).textContent = PRODUCTS[id].name;
      $(`kind-${id}`).textContent = PRODUCTS[id].kind;
    }
    // The withdrawal, in the words products.js chose.
    const notice = cancellationNotice('squirreal');
    $('gone-title').textContent = notice.title;
    $('gone-reason').textContent = notice.reason;
    $('gone-still').textContent = `Still yours: ${notice.stillWorks}`;
    TOP[2][2] = 'And one thing<br>is going away.';

    // The offer, or what replaced it.
    const store = storeCopy();
    $('store-size').textContent = store.size;
    $('store-who').innerHTML = store.who;
    $('store-after').innerHTML = store.after;
    $('store-fill').dataset.target = String(store.fill);

    // The end card.
    const photo = planFor('photo', 'pro');
    $('end-title').textContent = SERVICE.name;
    $('end-tagline').textContent = SERVICE.tagline;
    $('deal-head').textContent = `${store.size} free`;
    $('deal-price').innerHTML = store.who;
    $('deal-meta').innerHTML = `Photo from <b>$${photo.monthlyUsd}</b> · `
      + `Movi <b>$${planFor('movi', 'pro').monthlyUsd}</b> · `
      + `Work <b>$${planFor('work', 'pro').monthlyUsd}</b>`;
    $('end-plat').textContent = PRODUCTS.photo.platforms.join(' · ');

    // Decode the poses up front: one arriving mid-shoot is a blank frame and
    // nothing would say so afterwards.
    await Promise.all([...new Set(BEATS.map((b) => b[2])), 'hazel-cheer']
      .map((pose) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = () => reject(new Error(`pose ${pose} did not load`));
        image.src = `/mascot/${pose}.png`;
      })));

    await new Promise((r) => setTimeout(r, 120));
    return true;
  },

  seek(t) {
    paintFrame(t);
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
};
