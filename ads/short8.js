// The eighth Short: Hazelnut makes the picture.
//
// What is real here and what is not.
//
//   real  every picture. All eight of them are generated during the recording
//         by the shipped planner and the shipped painter, from the prompts
//         printed on screen. This is the first Hazelnut film with no stand-in
//         in it, and the reason is the feature itself: the generator runs on
//         the machine, so the machine doing the recording can run it. Nothing
//         here is a re-drawn scene standing in for an answer we cannot fetch.
//   real  the worksheet, and the wrong answer the film points at. The sheet is
//         planned at seed 4 on the trial, which is where `11 ÷ 0 = 10` comes
//         from, and the ring is positioned from `documentRows` — the same
//         function the painter lays the sheet out with — rather than from a
//         measurement typed in here.
//   real  every number. The prices come out of models.js through `priceLabel`,
//         the credit grant out of pricing.js, the tool counts out of the
//         registry. Nothing in this film quotes a figure the app would not.
//   not   the chrome. The plates, the type and the rings are the film's own.
//         There is deliberately no mock of the Hazelnut window in here: a
//         drawn-up toolbar would be the one thing on screen pretending to be
//         something it is not.

import { planImage } from '/core/imagine-plan.js';
import { paint, documentRows, layerOrigin } from '/core/imagine-paint.js';
import { IMAGE_MODELS, priceLabel, modelMaxEdge } from '/core/models.js';
import { TRIAL_CREDIT_GRANT } from '/core/pricing.js';
import { LOCAL_TOOLS, TOOL_ORDER } from '/core/tools.js';

const $ = (id) => document.getElementById(id);

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a, b, p) => a + (b - a) * p;
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

function window_(t, a, b, fadeIn = 0.35, fadeOut = 0.35) {
  if (t < a - fadeIn || t > b + fadeOut) return 0;
  if (t < a) return easeOut(clamp01((t - (a - fadeIn)) / fadeIn));
  if (t > b) return 1 - easeOut(clamp01((t - b) / fadeOut));
  return 1;
}
const span = (t, a, b, ease = easeInOut) => ease(clamp01((t - a) / (b - a)));

const DURATION = 66;

/* ── the shots ───────────────────────────────────────────────────────────── */

const ACTS = {
  open:       [0.0, 4.0],
  lake25:     [4.4, 10.2],
  city25:     [10.6, 15.4],
  sign25:     [15.8, 20.6],
  hand25:     [21.0, 25.4],
  pairLake:   [25.8, 30.4],
  pairSign:   [30.8, 34.2],
  pairHand:   [34.6, 38.0],
  ask:        [38.4, 41.6],
  sheetTrial: [42.0, 50.6],
  sheetPro:   [51.0, 56.4],
  prices:     [56.8, 62.0],
  end:        [62.4, 66.0],
};

/** Everything the film draws. Rendered once, in `ready`, then composited. */
const SHOTS = {
  lake25:  { prompt: 'a mountain lake at sunset', model: 'hazelnut-2.5', seed: 7 },
  lake5:   { prompt: 'a mountain lake at sunset', model: 'hazelnut-5-pro', seed: 7 },
  city25:  { prompt: 'a city skyline at night', model: 'hazelnut-2.5', seed: 11 },
  sign25:  { prompt: 'a sign that says "OPEN"', model: 'hazelnut-2.5', seed: 21 },
  sign5:   { prompt: 'a sign that says "OPEN"', model: 'hazelnut-5-pro', seed: 21 },
  hand25:  { prompt: 'a person waving with hands', model: 'hazelnut-2.5', seed: 33, hands: true },
  hand5:   { prompt: 'a person waving with hands', model: 'hazelnut-5-pro', seed: 33, hands: true },
};

const SHEETS = {
  sheetTrial: { prompt: 'a maths homework sheet', model: 'hazelnut-5-pro', edition: 'trial', seed: 4 },
  sheetPro:   { prompt: 'a maths homework sheet', model: 'hazelnut-5-pro', edition: 'pro', seed: 4 },
};

const rendered = {};   // key -> { canvas, plan, crop }
let badRow = null;     // the row the ring goes around

/* ── copy ────────────────────────────────────────────────────────────────── */

const TOP = [
  [4.8, 9.8, 'This one is <em>ours</em>.'],
  [11.0, 15.0, 'It runs on your<br>own processor.'],
  [16.2, 20.2, 'It cannot write.'],
  [21.4, 25.0, 'And it cannot count.'],
  [26.2, 30.0, 'Then there is <em>5 Pro</em>.'],
  [31.2, 33.8, 'It writes.'],
  [35.0, 37.6, 'It counts to five.'],
  [42.4, 46.4, 'On the trial it draws,<br>but it does not think.'],
  [46.8, 50.2, 'Look at the first one.'],
  [51.4, 56.0, 'On Hazelnut,<br>it thinks first.'],
];

const BOTTOM = [
  [5.4, 9.8, 'No key, no account, nothing uploaded.'],
  [11.6, 15.0, 'Soft, round, and unmistakably generated.'],
  [16.8, 20.2, 'Letter-shaped marks. Not letters.'],
  [22.0, 25.0, 'Six or seven of them, fused into a mitten.'],
  [26.8, 30.0, 'Same prompt, same seed. Only the renderer changed.'],
  [31.6, 33.8, 'With a real typeface.'],
  [35.4, 37.6, 'Five, because it counts them.'],
  [43.0, 46.4, 'Beautifully set, and never checked.'],
  [52.0, 56.0, 'Every answer solved before it is drawn.'],
];

/* ── rendering the pictures ──────────────────────────────────────────────── */

function render(key, spec, size, edition = 'pro') {
  const canvas = document.createElement('canvas');
  const plan = planImage({
    prompt: spec.prompt,
    model: spec.model,
    edition: spec.edition || edition,
    width: size.w,
    height: size.h,
    seed: spec.seed,
  });
  canvas.width = plan.width;
  canvas.height = plan.height;
  paint(canvas.getContext('2d'), plan);

  // For the hand shots, work out where the hands actually landed so the film
  // can frame them, using the painter's own unit rather than a guess.
  let crop = null;
  if (spec.hands) {
    const layer = plan.layers.find((l) => l.kind === 'person');
    if (layer) {
      const o = layerOrigin(plan, layer);
      const cx = o.x;
      const cy = o.y - 0.1 * o.scale;
      const half = 1.15 * o.scale;
      crop = { x: cx - half, y: cy - half, w: half * 2, h: half * 2 };
    }
  }
  rendered[key] = { canvas, plan, crop };
}

/** Draw a pre-rendered shot into a visible canvas, cropped if it has one. */
function show(target, key) {
  const shot = rendered[key];
  if (!shot) return;
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  if (shot.crop) {
    ctx.drawImage(shot.canvas, shot.crop.x, shot.crop.y, shot.crop.w, shot.crop.h,
      0, 0, target.width, target.height);
  } else {
    ctx.drawImage(shot.canvas, 0, 0, target.width, target.height);
  }
}

/* ── the film ────────────────────────────────────────────────────────────── */

function fillCopy(t) {
  for (const [id, table] of [['line-top', TOP], ['line-bottom', BOTTOM]]) {
    const host = $(id);
    const textEl = $(`${id}-text`);
    let shown = 0;
    let html = '';
    for (const [a, b, copy] of table) {
      const v = window_(t, a, b, 0.3, 0.3);
      if (v > shown) { shown = v; html = copy; }
    }
    if (html && textEl.innerHTML !== html) textEl.innerHTML = html;
    host.style.opacity = shown;
    host.style.transform = `translateY(${lerp(16, 0, shown)}px)`;
  }
}

function setChip(name, price, where) {
  $('chip-name').textContent = name;
  $('chip-price').textContent = price;
  $('chip-where').textContent = where;
}

function seek(t) {
  // Full-frame statements.
  $('open').style.opacity = window_(t, ACTS.open[0], ACTS.open[1], 0.01, 0.5);
  $('ask').style.opacity = window_(t, ACTS.ask[0], ACTS.ask[1], 0.4, 0.4);
  $('prices').style.opacity = window_(t, ACTS.prices[0], ACTS.prices[1], 0.45, 0.4);
  $('end2').style.opacity = window_(t, ACTS.end[0], ACTS.end[1], 0.45, 0.01);

  // ── the single square plate ──
  const singles = [
    ['lake25', 'lake25', 'hazelnut-2.5', 'trial'],
    ['city25', 'city25', 'hazelnut-2.5', 'trial'],
    ['sign25', 'sign25', 'hazelnut-2.5', 'trial'],
    ['hand25', 'hand25', 'hazelnut-2.5', 'trial'],
  ];
  let sqOn = 0;
  let sqKey = null;
  let sqAct = null;
  let chipFor = null;
  for (const [act, key, model, edition] of singles) {
    const [a, b] = ACTS[act];
    const v = window_(t, a, b, 0.4, 0.4);
    if (v > sqOn) { sqOn = v; sqKey = key; sqAct = [a, b]; chipFor = [model, edition]; }
  }
  const sq = $('sq');
  sq.style.opacity = sqOn;
  if (sqKey) {
    show($('sqc'), sqKey);
    // A slow push, computed from film time so it is identical on every pass.
    const p = span(t, sqAct[0] - 0.4, sqAct[1] + 0.4, (x) => x);
    sq.style.transform = `scale(${lerp(1.0, 1.055, clamp01(p))})`;
  }

  // The badge belongs to the single plate.
  const chip = $('chip');
  chip.style.opacity = sqOn;
  if (chipFor) {
    const [model, edition] = chipFor;
    setChip(IMAGE_MODELS[model].name, priceLabel(model, edition), 'on the trial');
  }

  // ── the comparisons ──
  const pairs = [
    ['pairLake', 'lake25', 'lake5'],
    ['pairSign', 'sign25', 'sign5'],
    ['pairHand', 'hand25', 'hand5'],
  ];
  let pairOn = 0;
  let pairKeys = null;
  for (const [act, a, b] of pairs) {
    const [s, e] = ACTS[act];
    const v = window_(t, s, e, 0.4, 0.4);
    if (v > pairOn) { pairOn = v; pairKeys = [a, b]; }
  }
  $('pair').style.opacity = pairOn;
  if (pairKeys) {
    show($('pairA'), pairKeys[0]);
    show($('pairB'), pairKeys[1]);
  }

  // ── the worksheets ──
  const sheetTrial = window_(t, ACTS.sheetTrial[0], ACTS.sheetTrial[1], 0.4, 0.4);
  const sheetPro = window_(t, ACTS.sheetPro[0], ACTS.sheetPro[1], 0.4, 0.4);
  const sheetOn = Math.max(sheetTrial, sheetPro);
  $('sheet').style.opacity = sheetOn;
  if (sheetOn > 0) {
    const key = sheetPro > sheetTrial ? 'sheetPro' : 'sheetTrial';
    show($('sheetc'), key);
    const model = SHEETS[key].model;
    const edition = SHEETS[key].edition;
    setChip(IMAGE_MODELS[model].name, priceLabel(model, edition),
      edition === 'pro' ? 'on Hazelnut' : 'on the trial');
    $('chip').style.opacity = sheetOn;
  }

  // The ring lands on the impossible question, a beat after the sheet does.
  const ringOn = window_(t, 46.6, 50.2, 0.35, 0.3) * (sheetTrial > 0.5 ? 1 : 0);
  const callout = $('callout');
  callout.style.opacity = ringOn;
  if (ringOn > 0 && badRow) {
    callout.style.left = `${badRow.x - 14}px`;
    callout.style.top = `${badRow.y - 10}px`;
    callout.style.width = `${badRow.width + 28}px`;
    callout.style.height = `${badRow.height + 20}px`;
  }

  fillCopy(t);
}

/* ── setup ───────────────────────────────────────────────────────────────── */

function ready() {
  for (const [key, spec] of Object.entries(SHOTS)) render(key, spec, { w: 1024, h: 1024 });
  for (const [key, spec] of Object.entries(SHEETS)) render(key, spec, { w: 780, h: 1014 });

  // The ring is placed from the painter's own layout, and it has to find a
  // question that genuinely cannot be solved — if the planner ever stopped
  // producing one, this film should fail loudly rather than ring a good sum.
  const rows = documentRows(rendered.sheetTrial.plan);
  badRow = rows.find((r) => !r.question.solvable);
  if (!badRow) throw new Error('short8: no unsolvable question on the trial sheet — the film has nothing to point at');
  $('callout-tag').textContent = `${badRow.question.text} ${badRow.question.answer}`;

  // Every number on the price card, read from the registry.
  const models = ['hazelnut-2.5', 'hazelnut-5-pro'];
  models.forEach((id, i) => {
    const n = i + 1;
    $(`p${n}n`).textContent = IMAGE_MODELS[id].name;
    $(`p${n}t`).textContent = priceLabel(id, 'trial');
    const pro = $(`p${n}p`);
    pro.textContent = priceLabel(id, 'pro');
    if (priceLabel(id, 'pro') === 'Unlimited') pro.classList.add('free');
  });
  // The two models do not share a ceiling on Hazelnut — 2.5 stops at 1536 and
  // 5 Pro goes to 2048 — so the line names them rather than quoting one number
  // and letting it stand for both.
  const caps = models.map((id) => `${modelMaxEdge(id, 'pro')}px for ${IMAGE_MODELS[id].name.replace('Hazelnut ', '')}`).join(' and ');
  $('prices-note').innerHTML =
    `Per picture. The trial opens with ${TRIAL_CREDIT_GRANT} credits and is never topped up.<br>`
    + `Longest edge: ${modelMaxEdge('hazelnut-2.5', 'trial')}px on the trial. On Hazelnut, ${caps}.`;

  $('facts').innerHTML = [
    `<div><b>Hazelnut Free is gone.</b> The trial replaced it.</div>`,
    `<div>No deadline. ${LOCAL_TOOLS.length} of the ${TOOL_ORDER.length} tools, forever.</div>`,
    `<div>Both image models run on <b>your machine</b>.</div>`,
  ].join('');

  seek(0);
}

window.AD = { duration: DURATION, ready, seek };
