// The Week Recap — ten minutes on everything that changed in Hazelnut this
// week, told through the people it changed something for.
//
// What is real here and what is not:
//
//   real  the three apps. Hazelnut, Hazelnut for the Web and Hazelnut Mini run
//         in this page as themselves, and every click, drag, slider, price,
//         dialog and error in the film is the application's own. The prices
//         are read off the buttons rather than written here.
//   real  the photographs, in the sense that they are drawn by this repository
//         rather than taken from anyone: a street, an old print, a café front,
//         a ridge line. The people in the chapter cards are illustrations of
//         invented people, for the same reason.
//   not   any result that would have come back from the model. No model runs
//         during a recording, so where a tool would answer, the film hands the
//         app a stand-in it drew itself — and marks it on screen, every time,
//         with the chip in the top right.
//
// Nothing in this film is a model output. That is a claim the film makes about
// itself out loud, at 9:46, and this file is where it is kept true.

import { streetScene, binRegion } from './street-scene.js';
import { printPhoto } from './print-scene.js';
import { cafePhoto, SIGN } from './cafe-scene.js';
import { demoPhoto } from './demo-image.js';
import { portrait, CAST } from './people.js';

const $ = (id) => document.getElementById(id);

// ── easing ─────────────────────────────────────────────────────────────────

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a, b, p) => a + (b - a) * p;
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

function window_(t, a, b, fadeIn = 0.5, fadeOut = 0.5) {
  if (t < a - fadeIn || t > b + fadeOut) return 0;
  if (t < a) return easeOut(clamp01((t - (a - fadeIn)) / fadeIn));
  if (t > b) return 1 - easeOut(clamp01((t - b) / fadeOut));
  return 1;
}
const span = (t, a, b, ease = easeInOut) => ease(clamp01((t - a) / (b - a)));

const DURATION = 600;

const ACTS = {
  open:    [0, 14],
  what:    [14, 40],
  ben:     [40, 52],
  ch1:     [52, 196],
  priya:   [196, 208],
  ch2:     [208, 284],
  half:    [284, 298],
  maya:    [298, 310],
  ch3:     [310, 368],
  tom:     [368, 380],
  ch4:     [380, 446],
  ecoCard: [446, 458],
  ch5:     [458, 530],
  ana:     [530, 542],
  ch6:     [542, 586],
  honest:  [586, 593],
  end:     [593, 600],
};

// ── reaching into the apps ─────────────────────────────────────────────────

const hzDoc = () => $('hz').contentDocument;
const hzWin = () => $('hz').contentWindow;
const webDoc = () => $('web').contentDocument;
const webWin = () => $('web').contentWindow;
const miniDoc = () => $('mini').contentDocument;

/** Image pixel → a point inside that app's stage, mirroring Viewport.fit(). */
function docToStage(doc, W, H, px, py) {
  const stage = doc?.getElementById('stage');
  if (!stage) return { x: 0, y: 0 };
  const r = stage.getBoundingClientRect();
  const scale = Math.min(1, Math.min((r.width - 48) / W, (r.height - 48) / H));
  return {
    x: (r.width - W * scale) / 2 + px * scale,
    y: (r.height - H * scale) / 2 + py * scale,
  };
}

function pointer(doc, type, sx, sy, buttons = 1) {
  const stage = doc?.getElementById('stage');
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  stage.dispatchEvent(new doc.defaultView.PointerEvent(type, {
    clientX: r.left + sx, clientY: r.top + sy,
    bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
    pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : buttons,
  }));
}

const clickIn = (doc, sel) => doc?.querySelector(sel)?.click();
const pickTool = (doc, id) => clickIn(doc, `.tool[data-tool="${id}"]`);

const byLabel = (doc, sel, label) => [...(doc?.querySelectorAll(sel) || [])]
  .find((n) => n.textContent.trim().startsWith(label));

const optBtn = (doc, label) => byLabel(doc, '.optionsbar .btn', label);
const modalBtn = (doc, label) => byLabel(doc, '.modal__foot .btn', label);

/** The control inside the options-bar field with this label. */
function fieldEl(doc, label, sel = 'input') {
  for (const f of doc?.querySelectorAll('.optionsbar .field') || []) {
    if (f.querySelector('label')?.textContent === label) return f.querySelector(sel);
  }
  return null;
}

function setInput(doc, input, value) {
  const view = doc?.defaultView;
  if (!input || !view) return;
  input.value = value;
  input.dispatchEvent(new view.Event('input', { bubbles: true }));
}

const setRange = (doc, label, value) => setInput(doc, fieldEl(doc, label, 'input[type="range"]'), String(value));
const setNumber = (doc, label, value) => setInput(doc, fieldEl(doc, label, 'input[type="number"]'), String(value));

/** Hand a photograph to the recording bridge and open it, the app's own way. */
function openHz(dataUrl, name) {
  const w = hzWin();
  if (!w) return;
  w.__AD_PLATE = dataUrl;
  w.__AD_PLATE_NAME = name;
  clickIn(hzDoc(), '[data-command="file:open"]');
}

/**
 * The browser build has no recording bridge — it is the shipped page, served
 * as it would be hosted — so a photograph gets in the way a person would put
 * one in: dropped onto the window.
 */
async function dropOnWeb(dataUrl, name) {
  const w = webWin();
  if (!w) return;
  const blob = await (await fetch(dataUrl)).blob();
  const file = new w.File([blob], name, { type: blob.type });
  const dt = new w.DataTransfer();
  dt.items.add(file);
  w.dispatchEvent(new w.DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
}

// ── the film's own copy ────────────────────────────────────────────────────

function chip(n, title) {
  $('chip-n').textContent = n;
  $('chip-t').textContent = title;
}

function third({ eyebrow = '', name = '', line = '', tag = '', kind = '' }) {
  $('third-eyebrow').textContent = eyebrow;
  $('third-name').textContent = name;
  $('third-line').textContent = line;
  $('third-chip').textContent = tag;
  $('third-chip').className = `third__chip${kind ? ` is-${kind}` : ''}`;
  $('third-chip').style.display = tag ? 'inline-block' : 'none';
}

function card({ num = '', title, sub = '', foot = '', tiles = null, prices = null, mark = false }) {
  $('card-num').textContent = num;
  $('card-title').textContent = title;
  $('card-sub').textContent = sub;
  $('card-foot').textContent = foot;
  $('mark').style.display = mark ? 'block' : 'none';

  const grid = $('card-grid');
  grid.replaceChildren();
  grid.className = prices ? 'prices' : 'card__grid';
  for (const tile of tiles || []) {
    const node = document.createElement('div');
    node.className = 'tile';
    node.innerHTML = `<h3></h3><p></p><span class="cost${tile.free ? ' is-free' : ''}"></span>`;
    node.querySelector('h3').textContent = tile.name;
    node.querySelector('p').textContent = tile.line;
    node.querySelector('.cost').textContent = tile.cost;
    grid.append(node);
  }
  for (const price of prices || []) {
    const node = document.createElement('div');
    node.className = 'price';
    node.innerHTML = '<div class="amt"></div><div class="who"></div><div class="plat"></div>';
    node.querySelector('.amt').textContent = price.amt;
    node.querySelector('.who').textContent = price.who;
    node.querySelector('.plat').textContent = price.plat;
    grid.append(node);
  }
}

function who(key, { eyebrow, need }) {
  const person = CAST[key];
  $('who-portrait').replaceChildren(portrait({ ...person.look, size: 420 }));
  $('who-eyebrow').textContent = eyebrow;
  $('who-name').textContent = person.name;
  $('who-line').textContent = person.line;
  $('who-need').textContent = need;
}

// ── the timeline ───────────────────────────────────────────────────────────

const cues = [];
const tracks = [];
const at = (t, fn) => cues.push({ t, fn, done: false });
const over = (a, b, fn) => tracks.push({ a, b, fn });

/** Windows during which the stand-in chip is on screen. */
const STANDINS = [];
const standin = (a, b) => STANDINS.push([a, b]);

/** A stroke through points in image coordinates, in whichever app. */
function stroke(doc, a, b, points, size) {
  at(a - 0.2, () => { if (size) setRange(doc(), 'Size', size); });
  at(a, () => { const p = points[0]; const s = docToStage(doc(), ...p.doc, p.x, p.y); pointer(doc(), 'pointerdown', s.x, s.y); });
  over(a, b, (p) => {
    const eased = easeInOut(p) * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(eased));
    const f = eased - i;
    const A = points[i]; const B = points[i + 1];
    const s = docToStage(doc(), ...A.doc, lerp(A.x, B.x, f), lerp(A.y, B.y, f));
    pointer(doc(), 'pointermove', s.x, s.y);
  });
  at(b, () => {
    const p = points.at(-1);
    const s = docToStage(doc(), ...p.doc, p.x, p.y);
    pointer(doc(), 'pointerup', s.x, s.y, 0);
  });
}

/** Type into an options-bar text field, a character at a time. */
function typeInto(doc, a, b, label, text) {
  over(a, b, (p) => setInput(
    doc(), fieldEl(doc(), label, 'input[type="text"]'),
    text.slice(0, Math.round(easeInOut(p) * text.length)),
  ));
  at(b + 0.05, () => setInput(doc(), fieldEl(doc(), label, 'input[type="text"]'), text));
}

// The photographs, built in ready().
const PHOTO = {};

// ═══════════════════════════════════════════════════════════════════════════
// 0:00 — the open
// ═══════════════════════════════════════════════════════════════════════════

at(0, () => card({
  title: 'The Week Recap',
  sub: 'Everything new in Hazelnut — and who it is for.',
  mark: true,
}));

at(ACTS.what[0] - 0.4, () => card({
  num: 'This week',
  title: 'Five things changed.',
  sub: '',
  tiles: [
    { name: 'Fifteen new tools', line: 'The toolbox went from six to twenty-one — and Magic Text later made twenty-two. Eight of the fifteen run on your machine; seven call the model and cost three to eight credits.', cost: 'Free — 8 credits' },
    { name: 'Hazelnut for the Web', line: 'The same editor in a browser tab, fixed to the half that needs no model. No download, no account, no key.', cost: 'Free', free: true },
    { name: 'Tools in Mini', line: 'Mini was a chat bar. It now has a strip of twelve tools above it — six of them local.', cost: 'Free — 20 credits' },
    { name: 'Eco Mode', line: 'Ask the model for less: a smaller picture, no location lookup, fewer frames. Worse results, fewer credits.', cost: '40% off' },
    { name: 'Magic Text', line: 'Paint over the lettering in a photograph, type what it should say instead, press Generate.', cost: '12 credits · 4 in Eco' },
    { name: 'And the rule stayed', line: 'Credits are only taken when a result comes back. A failed generation costs nothing, on every edition.', cost: 'Unchanged', free: true },
  ],
}));

// ═══════════════════════════════════════════════════════════════════════════
// 0:40 — Ben, and the fifteen new tools
// ═══════════════════════════════════════════════════════════════════════════

at(ACTS.ben[0] - 0.4, () => who('ben', {
  eyebrow: 'Chapter one · Fifteen new tools',
  need: 'He needs the bin gone, the picture straight, and none of it to cost him an afternoon.',
}));

at(ACTS.ch1[0] - 1.2, () => {
  chip('01', 'Fifteen new tools');
  openHz(PHOTO.street, 'sofa-for-sale.jpg');
  third({
    eyebrow: 'The photograph',
    name: 'One shot, taken in a hurry',
    line: 'Ben’s sofa, on the pavement — and next door’s wheelie bin, which is not for sale.',
  });
});

// -- Erase: the cheap model tool, on the bin --------------------------------

const BIN = binRegion(1200, 1500);
const streetDoc = [1200, 1500];

at(55.0, () => {
  third({
    eyebrow: 'New tool · calls the model',
    name: 'Erase',
    line: 'Paint over something small and it goes. No location lookup — the gap is filled from the pixels around it, which is why it is a quarter of Realtouch’s price.',
    tag: '5 credits',
  });
  pickTool(hzDoc(), 'erase');
});

stroke(hzDoc, 57.4, 59.6, [
  { doc: streetDoc, x: BIN.x + 24, y: BIN.y + 30 },
  { doc: streetDoc, x: BIN.x + BIN.w - 26, y: BIN.y + 60 },
  { doc: streetDoc, x: BIN.x + 30, y: BIN.y + 150 },
], 150);
stroke(hzDoc, 60.2, 62.4, [
  { doc: streetDoc, x: BIN.x + BIN.w - 24, y: BIN.y + 190 },
  { doc: streetDoc, x: BIN.x + 26, y: BIN.y + 270 },
  { doc: streetDoc, x: BIN.x + BIN.w - 30, y: BIN.y + 350 },
], 150);

at(64.4, () => optBtn(hzDoc(), 'Erase')?.click());
at(65.8, () => modalBtn(hzDoc(), 'Use')?.click());
at(66.3, () => hzWin().__AD_JOB?.progress('Sending the picture…'));
at(69.0, () => hzWin().__AD_JOB?.finish(PHOTO.streetClean));
standin(69.0, 74.5);
at(70.0, () => third({
  eyebrow: 'What came back',
  name: 'Railings, mortar, kerb',
  line: 'Erase is asked to continue what surrounds the mask — and to fill plainly rather than guess at something specific when it cannot tell.',
  tag: '5 credits',
}));

// -- the eight that never call a model --------------------------------------

at(76.0, () => third({
  eyebrow: 'New tools · local',
  name: 'Eight that never call a model',
  line: 'Crop, Straighten, Levels, Colour, Sharpen, Denoise, Vignette and Text. No key, no upload, no credit — on every edition, including the free one.',
  tag: 'Free', kind: 'free',
}));

// Crop.
at(80.0, () => { third({ eyebrow: 'Local · 01', name: 'Crop', line: 'Drag the box or type the numbers. It trims the canvas and every layer in it.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'crop'); });
// Typed rather than dragged: the box the tool opens with is the whole
// picture, so a drag from inside it grabs an edge instead of starting a new
// one — and the numbers are the other half of what the tool offers anyway.
over(81.8, 83.6, (p) => {
  setNumber(hzDoc(), 'Width', Math.round(lerp(1200, 1030, easeInOut(p))));
  setNumber(hzDoc(), 'Height', Math.round(lerp(1500, 1168, easeInOut(p))));
});
over(83.8, 85.2, (p) => {
  setNumber(hzDoc(), 'X', Math.round(lerp(0, 86, easeInOut(p))));
  setNumber(hzDoc(), 'Y', Math.round(lerp(0, 250, easeInOut(p))));
});
at(86.2, () => optBtn(hzDoc(), 'Apply')?.click());

// Everything after the crop is measured in the cropped document.
const cropDoc = [1030, 1168];

// Straighten.
at(89.5, () => { third({ eyebrow: 'Local · 02', name: 'Straighten', line: 'Rotate by eye. The corners the rotation exposes are trimmed off, so you are left with a rectangle rather than a diamond.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'straighten'); });
over(91.0, 93.4, (p) => setRange(hzDoc(), 'Angle', Math.round(lerp(0, -190, easeInOut(p)) / 5) * 5));
at(94.6, () => optBtn(hzDoc(), 'Apply')?.click());

// Levels.
at(97.5, () => { third({ eyebrow: 'Local · 03', name: 'Levels', line: 'Black point, white point, gamma — the three controls that fix most flat photographs, with a histogram drawn from the picture as it is now.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'levels'); });
over(99.0, 100.6, (p) => setRange(hzDoc(), 'Black', Math.round(lerp(0, 16, p))));
over(100.8, 102.4, (p) => setRange(hzDoc(), 'White', Math.round(lerp(255, 238, p))));
over(102.6, 104.2, (p) => setRange(hzDoc(), 'Gamma', Math.round(lerp(100, 116, p))));
at(105.4, () => optBtn(hzDoc(), 'Apply')?.click());

// Colour.
at(108.5, () => { third({ eyebrow: 'Local · 04', name: 'Colour', line: 'Warmth, tint and saturation. Saturation moves around the Rec. 601 luma, so taking the colour up does not change how bright anything is.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'colour'); });
over(110.0, 111.8, (p) => setRange(hzDoc(), 'Warmth', Math.round(lerp(0, 15, p))));
over(112.0, 113.8, (p) => setRange(hzDoc(), 'Saturation', Math.round(lerp(0, 24, p))));
at(115.0, () => optBtn(hzDoc(), 'Apply')?.click());

// Sharpen.
at(118.0, () => { third({ eyebrow: 'Local · 05', name: 'Sharpen', line: 'A real unsharp mask: the picture, minus a blurred copy of itself, added back. The threshold leaves flat areas alone so grain is not sharpened with the detail.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'sharpen'); });
over(119.6, 121.6, (p) => setRange(hzDoc(), 'Amount', Math.round(lerp(60, 135, p))));
at(122.8, () => optBtn(hzDoc(), 'Apply')?.click());

// Denoise.
at(125.8, () => { third({ eyebrow: 'Local · 06', name: 'Denoise', line: 'A 3×3 median mixed back into the original. Keep detail trusts the original wherever a pixel is far from its median — which is what an edge looks like.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'denoise'); });
over(127.4, 129.4, (p) => setRange(hzDoc(), 'Strength', Math.round(lerp(55, 72, p))));
at(131.0, () => optBtn(hzDoc(), 'Apply')?.click());

// Vignette.
at(134.0, () => { third({ eyebrow: 'Local · 07', name: 'Vignette', line: 'A radial darkening with a feather, and grain if you want it. The grain is one value per pixel across all three channels, because film grain is monochrome.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'vignette'); });
over(135.6, 137.4, (p) => setRange(hzDoc(), 'Darken', Math.round(lerp(40, 54, p))));
over(137.6, 139.4, (p) => setRange(hzDoc(), 'Grain', Math.round(lerp(0, 9, p))));
at(140.6, () => optBtn(hzDoc(), 'Apply')?.click());

// Text.
at(143.6, () => { third({ eyebrow: 'Local · 08', name: 'Text', line: 'Click where the line starts, type, and Apply draws it onto the layer.', tag: 'Free', kind: 'free' }); pickTool(hzDoc(), 'text'); });
// Placed to the right of centre: the film's own copy lives down the left of
// the frame, and a caption under it would be read as part of the film.
at(145.4, () => { const s = docToStage(hzDoc(), ...cropDoc, 470, 1090); pointer(hzDoc(), 'pointerdown', s.x, s.y); pointer(hzDoc(), 'pointerup', s.x, s.y, 0); });
typeInto(hzDoc, 146.4, 149.4, 'Words', '£40 — collection only');
over(150.0, 151.4, (p) => setRange(hzDoc(), 'Size', Math.round(lerp(48, 96, p))));
at(152.6, () => optBtn(hzDoc(), 'Apply')?.click());

at(155.0, () => third({
  eyebrow: 'Eight tools, and the bill',
  name: 'Nothing',
  line: 'Every adjustment above ran on Ben’s own machine. No key was needed, nothing was uploaded, and the credit balance in the corner has not moved since Erase.',
  tag: 'Free', kind: 'free',
}));

// -- Caption: the cheapest thing the app does -------------------------------

at(162.0, () => {
  third({
    eyebrow: 'New tool · calls the model',
    name: 'Caption',
    line: 'Reads the picture and writes a caption, an alt text for the web, and a handful of keywords. Three credits, because nothing is generated.',
    tag: '3 credits',
  });
  pickTool(hzDoc(), 'caption');
});
at(165.0, () => optBtn(hzDoc(), 'Read it')?.click());
at(166.4, () => modalBtn(hzDoc(), 'Use')?.click());
at(166.9, () => hzWin().__AD_JOB?.progress('Reading the picture…'));
at(169.6, () => hzWin().__AD_JOB?.finish({
  // PLACEHOLDER — written by this file, not read off the picture by any model.
  caption: 'A green two-seater sofa on a terraced street’s pavement, photographed for sale on a bright afternoon.',
  alt: 'A green sofa on a pavement in front of iron railings and a brick terrace.',
  keywords: ['sofa', 'second-hand', 'pavement', 'terraced street', 'railings', 'for sale'],
  note: 'The price written on the picture is the seller’s, not read from anything in the scene.',
}));
standin(169.6, 180.0);
at(171.0, () => third({
  eyebrow: 'What comes back',
  name: 'A caption, an alt text, keywords',
  line: 'The alt text is written for a screen reader rather than for search — and anything it is unsure of goes in a note instead of into the caption.',
  tag: '3 credits',
}));
at(180.6, () => modalBtn(hzDoc(), 'Copy caption')?.click());

at(182.0, () => third({
  eyebrow: 'Chapter one',
  name: 'Fifteen, in one picture',
  line: 'Eight local tools, seven that call the model — Caption at three credits, Erase at five, Background at five, Sky and Colourise at six, Upscale and Restore at eight. None of them buys a search pass or a run of frames, which is why none of them costs twenty.',
}));

// ═══════════════════════════════════════════════════════════════════════════
// 3:16 — Priya, and the two that repair a photograph
// ═══════════════════════════════════════════════════════════════════════════

at(ACTS.priya[0] - 0.4, () => who('priya', {
  eyebrow: 'Chapter two · Restore and Colourise',
  need: 'She has one print, no negative, and a crease across the only photograph of the car.',
}));

const printDoc = [1200, 900];

at(ACTS.ch2[0] - 1.2, () => {
  chip('02', 'Restore · Colourise');
  openHz(PHOTO.print, 'grandmother-1962.jpg');
  third({
    eyebrow: 'The photograph',
    name: 'A scan of a damaged print',
    line: 'Sixty years of light, damp and one fold across the corner.',
  });
});

at(212.0, () => {
  third({
    eyebrow: 'New tool · calls the model',
    name: 'Restore',
    line: 'Scratches, dust, creases, fading and damp — repaired without redrawing faces, hands or lettering. Where damage crosses a face, the damage goes and the face stays.',
    tag: '8 credits',
  });
  pickTool(hzDoc(), 'restore');
});
typeInto(hzDoc, 214.4, 217.6, 'Note', 'the crease runs through the car');
at(219.0, () => optBtn(hzDoc(), 'Restore')?.click());
at(220.4, () => modalBtn(hzDoc(), 'Use')?.click());
at(220.9, () => hzWin().__AD_JOB?.progress('Sending the picture…'));
at(223.6, () => hzWin().__AD_JOB?.finish(PHOTO.printRestored));
standin(223.6, 229.0);
at(225.0, () => third({
  eyebrow: 'What it is asked not to do',
  name: 'Keep the print a print',
  line: 'The grain of the film and the character of the paper stay. It is a repair, not a re-photograph.',
  tag: '8 credits',
}));

at(234.0, () => {
  third({
    eyebrow: 'New tool · calls the model',
    name: 'Colourise',
    line: 'Colour on top of the luminance that is already there, chosen for the subject and the materials — skin, brick, painted metal, sky.',
    tag: '6 credits',
  });
  pickTool(hzDoc(), 'colourise');
});
typeInto(hzDoc, 236.4, 240.0, 'Era', 'an English suburb, about 1962');
at(241.4, () => optBtn(hzDoc(), 'Colourise')?.click());
at(242.8, () => modalBtn(hzDoc(), 'Use')?.click());
at(243.3, () => hzWin().__AD_JOB?.progress('Sending the picture…'));
at(246.0, () => hzWin().__AD_JOB?.finish(PHOTO.printColour));
standin(246.0, 252.0);
at(248.0, () => third({
  eyebrow: 'What it says about itself',
  name: 'An interpretation, not a recovery',
  line: 'The colour was never in the negative. Where the print gives no clue what colour a thing was, the tool is told to choose the most ordinary one rather than the most interesting — and the app says so before you spend.',
  tag: '6 credits',
}));

at(258.0, () => third({
  eyebrow: 'Fourteen credits, both passes',
  name: 'Cheaper than the old way',
  line: 'Restore and Colourise are each one edit to a photograph that exists. There is no search pass and no run of frames to pay for — and if either comes back empty, neither is charged.',
}));

at(270.0, () => third({
  eyebrow: 'Chapter two',
  name: 'Priya keeps the original',
  line: 'Every result lands as a new layer over the one it came from, and the history panel still has the scan at the bottom of it. Nothing in Hazelnut overwrites the photograph you opened.',
}));

at(ACTS.half[0] - 0.4, () => card({
  num: 'The split that runs through all of it',
  title: 'Eleven of the twenty-two never call a model.',
  sub: 'That half is what Hazelnut Free keeps for ever — and it is exactly what the browser build ships.',
  foot: 'Crop · Straighten · Levels · Colour · Sharpen · Denoise · Vignette · Text · Draw · Expand · AIScope’s zoom',
}));

// ═══════════════════════════════════════════════════════════════════════════
// 4:58 — Maya, and Hazelnut for the Web
// ═══════════════════════════════════════════════════════════════════════════

at(ACTS.maya[0] - 0.4, () => who('maya', {
  eyebrow: 'Chapter three · Hazelnut for the Web',
  need: 'She cannot install anything, has no API key, and has twenty minutes before the computer logs her out.',
}));

const ridgeDoc = [1600, 1000];

at(ACTS.ch3[0] - 1.2, () => {
  chip('03', 'Hazelnut for the Web');
  third({
    eyebrow: 'The same editor',
    name: 'In a browser tab',
    line: 'This is the shipped page, served as it would be hosted: the same renderer, the same layer stack, the same history. Nothing was installed and nothing is uploaded — the picture was dropped onto the window and never left it.',
    tag: 'Free', kind: 'free',
  });
});

at(316.0, () => { third({ eyebrow: 'Web · local tool', name: 'Levels', line: 'The browser build is fixed to the web edition. Every local tool behaves exactly as it does on the desktop, because it is the same code.', tag: 'Free', kind: 'free' }); pickTool(webDoc(), 'levels'); });
over(317.6, 319.4, (p) => setRange(webDoc(), 'Black', Math.round(lerp(0, 18, p))));
over(319.6, 321.4, (p) => setRange(webDoc(), 'Gamma', Math.round(lerp(100, 118, p))));
at(322.6, () => optBtn(webDoc(), 'Apply')?.click());

at(325.6, () => { third({ eyebrow: 'Web · local tool', name: 'Vignette', line: 'Drawn on the canvas in front of you, in your own browser. There is no account here and nothing to sign into.', tag: 'Free', kind: 'free' }); pickTool(webDoc(), 'vignette'); });
over(327.2, 329.0, (p) => setRange(webDoc(), 'Darken', Math.round(lerp(40, 58, p))));
over(329.2, 331.0, (p) => setRange(webDoc(), 'Grain', Math.round(lerp(0, 12, p))));
at(332.2, () => optBtn(webDoc(), 'Apply')?.click());

at(336.0, () => third({
  eyebrow: 'And the other half',
  name: 'Visible, and honest about it',
  line: 'The eleven tools that need the model are in the toolbar where they always are. Press one and the browser build tells you what it is and where the rest lives.',
}));
at(339.0, () => pickTool(webDoc(), 'erase'));
at(346.0, () => clickIn(webDoc(), '.modal__foot .btn'));
at(348.0, () => third({
  eyebrow: 'Chapter three',
  name: 'Eleven tools, no key',
  line: 'For Maya that is the whole job: crop it, level it, take the corners down, save it to the desktop and log out. The browser build is free, and it is the same editor.',
  tag: 'Free', kind: 'free',
}));

// ═══════════════════════════════════════════════════════════════════════════
// 6:08 — Tom, and Mini's twelve tools
// ═══════════════════════════════════════════════════════════════════════════

at(ACTS.tom[0] - 0.4, () => who('tom', {
  eyebrow: 'Chapter four · Tools in Mini',
  need: 'One hand, a moving bus, and no interest in writing “please make this brighter” to a computer.',
}));

at(ACTS.ch4[0] - 1.2, () => {
  chip('04', 'Tools in Mini');
  third({
    eyebrow: 'What Mini was',
    name: 'A chat bar',
    line: 'You attached a photograph and typed what you wanted. That is still there — but typing a sentence is a lot to ask of someone holding a rail.',
  });
});

at(384.0, () => clickIn(miniDoc(), '.btn--primary'));
at(388.0, () => third({
  eyebrow: 'What Mini has now',
  name: 'Twelve tools, above the bar',
  line: 'Six run on the phone itself and cost nothing: Enhance, Rotate, Sharpen, Denoise, Vignette, Black & white. Six call the model at Hazelnut’s own prices — and the price is on the chip before you touch it.',
  tag: 'Six free · six priced',
}));

at(396.0, () => third({
  eyebrow: 'Mini · local',
  name: 'Enhance',
  line: 'Auto levels, a little saturation and a light sharpen, computed on the device from the same core code the desktop app uses. It lands in the transcript in under a second.',
  tag: 'Free', kind: 'free',
}));
at(398.0, () => byLabel(miniDoc(), '.tool', 'Enhance')?.click());

at(405.0, () => {
  third({
    eyebrow: 'Mini · local',
    name: 'Black & white',
    line: 'Rec. 601 luma, one pass, no upload. The photograph never leaves the phone — which is also the answer to what happens on a bad connection.',
    tag: 'Free', kind: 'free',
  });
  byLabel(miniDoc(), '.tool', 'Black & white')?.click();
});
// A tool with a slider asks first, in one sheet, and applies on the button.
at(410.0, () => byLabel(miniDoc(), '.sheet .btn--primary', 'Apply')?.click());

at(416.0, () => third({
  eyebrow: 'Mini · calls the model',
  name: 'Sky',
  line: 'The priced half asks for what it needs in one sheet, quotes the price on the button, and charges nothing unless a result comes back.',
  tag: '6 credits',
}));
at(418.0, () => byLabel(miniDoc(), '.tool', 'Sky')?.click());
at(421.5, () => setInput(miniDoc(), miniDoc()?.querySelector('.sheet input[type="text"]'), 'a clear evening sky, low sun off to the left'));
// The ask sheet quotes the price on its own button — "Run · 6 credits" —
// and the confirm behind it asks again with "Use 6".
at(424.0, () => byLabel(miniDoc(), '.sheet .btn--primary', 'Run')?.click());
at(427.0, () => byLabel(miniDoc(), '.sheet .btn--primary', 'Use')?.click());

at(432.0, () => third({
  eyebrow: 'Chapter four',
  name: 'The same prices, the same rule',
  line: 'Mini charges what Hazelnut charges for the same work, because both read the price out of one registry. What the film cannot show you is the result: no model runs during a recording, so this is the genuine progress and then a cut.',
  tag: '6 credits',
}));

// ═══════════════════════════════════════════════════════════════════════════
// 7:26 — Eco Mode
// ═══════════════════════════════════════════════════════════════════════════

at(ACTS.ecoCard[0] - 0.4, () => card({
  num: 'Chapter five',
  title: 'Eco Mode',
  sub: 'It asks the model for less. The results are worse, and it says so before you spend.',
  foot: 'A generation is not free of the world: the datacentre that serves it burns electricity, and the machines doing it are cooled — in many places with water. Asking for less work means less of both.',
}));

at(ACTS.ch5[0] - 1.2, () => {
  chip('05', 'Eco Mode');
  openHz(PHOTO.ridge, 'ridgeline.jpg');
  third({
    eyebrow: 'Before the switch',
    name: 'The prices you know',
    line: 'Every AI tool in the toolbar carries its price. Erase five, Sky six, Upscale eight, Magic Text twelve.',
  });
});

at(464.0, () => pickTool(hzDoc(), 'erase'));
at(468.0, () => third({
  eyebrow: 'The switch',
  name: 'One pill, in the menu bar',
  line: 'It changes what is sent, not just what is charged: pictures go up at no more than 1,024px on the longest side, Realtouch’s location lookup is skipped entirely, GIF Animate generates half the keyframes, and Squirreal renders shorter clips at a lower rate.',
  tag: 'Eco Mode', kind: 'eco',
}));
at(470.5, () => clickIn(hzDoc(), '#eco-pill'));

at(476.0, () => third({
  eyebrow: 'What moved',
  name: 'Every badge in the toolbar',
  line: 'Erase five becomes three. Sky six becomes four. Upscale eight becomes five. The badge changes the moment the switch does, because the button underneath it will charge the Eco price.',
  tag: '40% off', kind: 'eco',
}));

at(486.0, () => third({
  eyebrow: 'Where it is said',
  name: 'At the point of use, every time',
  line: 'Not once in a settings screen. Every confirm dialog carries the line for that particular tool — what this tool, specifically, is giving up in exchange for the cheaper price.',
  tag: 'Eco Mode', kind: 'eco',
}));
at(489.0, () => { pickTool(hzDoc(), 'sky'); });
typeInto(hzDoc, 491.0, 494.0, 'Sky', 'a clear evening sky, low sun off to the left');
at(495.4, () => optBtn(hzDoc(), 'Replace sky')?.click());
at(504.0, () => modalBtn(hzDoc(), 'Cancel')?.click());

at(506.0, () => third({
  eyebrow: 'What it will not do',
  name: 'Print a number it cannot measure',
  line: 'How much water a request draws depends on the datacentre, the season and the grid behind it — none of which is visible from the machine Hazelnut is running on. So there is no figure in litres anywhere in the app, and there will not be one. The mechanism is the claim: fewer pixels, fewer passes, fewer frames.',
  tag: 'No figure', kind: 'eco',
}));

at(518.0, () => third({
  eyebrow: 'Chapter five',
  name: 'Worse, on purpose, with the receipt',
  line: 'Eco Mode is hidden where it would be meaningless — on Hazelnut Free and in the browser build nothing calls a model, so there is nothing to save.',
  tag: 'Eco Mode', kind: 'eco',
}));
at(524.0, () => clickIn(hzDoc(), '#eco-pill'));

// ═══════════════════════════════════════════════════════════════════════════
// 8:50 — Ana, and Magic Text
// ═══════════════════════════════════════════════════════════════════════════

at(ACTS.ana[0] - 0.4, () => who('ana', {
  eyebrow: 'Chapter six · Magic Text',
  need: 'The photograph of the café is the good one — evening light, nobody in the doorway. Only the name on it is wrong.',
}));

const cafeDoc = [1000, 1250];
const BOARD = { x: SIGN.x * 1000, y: SIGN.y * 1250, w: SIGN.w * 1000, h: SIGN.h * 1250 };

at(ACTS.ch6[0] - 1.2, () => {
  chip('06', 'Magic Text');
  openHz(PHOTO.cafe, 'hazel-and-fig.jpg');
  third({
    eyebrow: 'New tool · calls the model',
    name: 'Magic Text',
    line: 'Paint over the lettering with the mask brush Erase uses, type what it should say instead, and press Generate.',
    tag: '12 credits',
  });
});

at(546.0, () => pickTool(hzDoc(), 'magic-text'));
stroke(hzDoc, 548.0, 549.4, [
  { doc: cafeDoc, x: BOARD.x + 26, y: BOARD.y + 34 },
  { doc: cafeDoc, x: BOARD.x + BOARD.w * 0.5, y: BOARD.y + 28 },
  { doc: cafeDoc, x: BOARD.x + BOARD.w - 22, y: BOARD.y + 36 },
], 110);
stroke(hzDoc, 549.9, 551.3, [
  { doc: cafeDoc, x: BOARD.x + BOARD.w - 22, y: BOARD.y + 88 },
  { doc: cafeDoc, x: BOARD.x + BOARD.w * 0.5, y: BOARD.y + 92 },
  { doc: cafeDoc, x: BOARD.x + 26, y: BOARD.y + 88 },
], 110);
typeInto(hzDoc, 552.4, 554.8, 'Say instead', 'THE HAZEL TREE');

at(556.4, () => third({
  eyebrow: 'What it is asked for',
  name: 'Character for character',
  line: 'The same typeface, the same baseline, the same angle and the same light — and the wear, the dirt and the reflections the board has taken on. A longer name is tightened to fit rather than allowed to run off the sign.',
  tag: '12 credits',
}));
at(559.0, () => optBtn(hzDoc(), 'Generate')?.click());
at(560.6, () => modalBtn(hzDoc(), 'Use')?.click());
at(561.1, () => hzWin().__AD_JOB?.progress('Sending the picture…'));
at(563.6, () => hzWin().__AD_JOB?.finish(PHOTO.cafeNew));
standin(563.6, 569.0);

at(566.0, () => third({
  eyebrow: 'And nothing else',
  name: 'Outside the mask, nothing changes',
  line: 'Not the board, not its frame, not what is reflected in the glass, and not the rest of the photograph. It also refuses to run with an empty field — twelve credits to put the same sign back is not a service.',
  tag: '12 credits',
}));

at(572.0, () => third({
  eyebrow: 'In Eco Mode',
  name: 'Four, not eight',
  line: 'Magic Text has its own Eco price, because Eco Mode takes more from it than the usual 40%: it is sent a crop around the words instead of the whole photograph. A far smaller request — and a rougher match, because the model is matching a typeface it can only see a few centimetres of.',
  tag: '4 credits', kind: 'eco',
}));
at(574.5, () => clickIn(hzDoc(), '#eco-pill'));
at(582.0, () => clickIn(hzDoc(), '#eco-pill'));

// ═══════════════════════════════════════════════════════════════════════════
// 9:46 — what this film is, and the end
// ═══════════════════════════════════════════════════════════════════════════

at(ACTS.honest[0] - 0.4, () => card({
  num: 'About this film',
  title: 'Nothing here is a model output.',
  sub: 'Every app in it is the real one, and every price was read off its own buttons.',
  foot: 'No model runs during a recording. Where a tool would have answered — the erased bin, the repaired print, the colour, the caption, the new sign — the film handed the app a stand-in it drew itself, and marked it on screen while it was there.',
}));

at(ACTS.end[0] - 0.4, () => card({
  title: 'Hazelnut',
  sub: 'Twenty-two tools. Eleven of them never call a model.',
  mark: true,
  prices: [
    { amt: '$19.99', who: 'Hazelnut', plat: 'Windows · Mac' },
    { amt: '$9.99', who: 'Mini', plat: 'Windows · Mac · Android' },
    { amt: 'Free', who: 'Web & Free', plat: 'Any browser' },
  ],
  foot: 'Seven days with everything unlocked. When the trial ends the editor does not lock — it becomes Hazelnut Free.',
}));

// ── per-frame ──────────────────────────────────────────────────────────────

const inAct = (t, act) => t >= ACTS[act][0] && t <= ACTS[act][1];

function paint(t) {
  const cardOn = Math.max(
    window_(t, ACTS.open[0], ACTS.open[1] - 0.8, 0, 0.8),
    window_(t, ACTS.what[0], ACTS.what[1] - 0.8, 0.6, 0.8),
    window_(t, ACTS.half[0], ACTS.half[1] - 0.8, 0.6, 0.8),
    window_(t, ACTS.ecoCard[0], ACTS.ecoCard[1] - 0.8, 0.6, 0.8),
    window_(t, ACTS.honest[0], ACTS.honest[1] - 0.6, 0.6, 0.6),
    window_(t, ACTS.end[0], DURATION, 0.7, 0),
  );
  const whoOn = Math.max(
    window_(t, ACTS.ben[0], ACTS.ben[1] - 0.8, 0.6, 0.8),
    window_(t, ACTS.priya[0], ACTS.priya[1] - 0.8, 0.6, 0.8),
    window_(t, ACTS.maya[0], ACTS.maya[1] - 0.8, 0.6, 0.8),
    window_(t, ACTS.tom[0], ACTS.tom[1] - 0.8, 0.6, 0.8),
    window_(t, ACTS.ana[0], ACTS.ana[1] - 0.8, 0.6, 0.8),
  );
  $('card').style.opacity = cardOn;
  $('who').style.opacity = whoOn * (1 - cardOn);

  // The open builds itself: the mark, then the title, then the line.
  if (inAct(t, 'open')) {
    const markIn = span(t, 0.2, 1.8, easeOut);
    $('mark').style.opacity = markIn;
    $('mark').style.transform = `scale(${lerp(0.6, 1, markIn)})`;
    const title = span(t, 1.0, 2.4);
    $('card-title').style.opacity = title;
    $('card-title').style.transform = `translateY(${lerp(26, 0, title)}px)`;
    const sub = span(t, 2.0, 3.4);
    $('card-sub').style.opacity = sub;
    $('card-sub').style.transform = `translateY(${lerp(16, 0, sub)}px)`;
  } else {
    $('mark').style.opacity = 1;
    $('mark').style.transform = 'none';
    for (const id of ['card-title', 'card-sub']) {
      $(id).style.opacity = 1;
      $(id).style.transform = 'none';
    }
  }

  // Tiles and prices stagger in under the heading.
  const gridStart = inAct(t, 'what') ? ACTS.what[0] + 0.5
    : inAct(t, 'end') ? ACTS.end[0] + 0.4 : null;
  [...$('card-grid').children].forEach((tile, i) => {
    if (gridStart == null) { tile.style.opacity = 1; tile.style.transform = 'none'; return; }
    const p = span(t, gridStart + i * 0.28, gridStart + i * 0.28 + 0.9, easeOut);
    tile.style.opacity = p;
    tile.style.transform = `translateY(${lerp(22, 0, p)}px)`;
  });

  // The person cards: the portrait lands, the words follow.
  if (whoOn > 0) {
    const start = [ACTS.ben, ACTS.priya, ACTS.maya, ACTS.tom, ACTS.ana]
      .find(([a, b]) => t >= a - 0.6 && t <= b)?.[0] ?? 0;
    const p = span(t, start, start + 1.1, easeOut);
    $('who-portrait').style.transform = `scale(${lerp(0.88, 1, p)})`;
    $('who-portrait').style.opacity = p;
    const words = span(t, start + 0.4, start + 1.5, easeOut);
    $('who-name').style.transform = `translateY(${lerp(20, 0, words)}px)`;
    $('who-name').style.opacity = words;
    $('who-line').style.opacity = span(t, start + 0.8, start + 1.9, easeOut);
    $('who-need').style.opacity = span(t, start + 1.4, start + 2.6, easeOut);
  }

  // Footage.
  const hzOn = Math.max(
    window_(t, ACTS.ch1[0] - 1.5, ACTS.ch1[1] - 0.6, 0.7, 0.7),
    window_(t, ACTS.ch2[0] - 1.5, ACTS.ch2[1] - 0.6, 0.7, 0.7),
    window_(t, ACTS.ch5[0] - 1.5, ACTS.ch5[1] - 0.6, 0.7, 0.7),
    window_(t, ACTS.ch6[0] - 1.5, ACTS.ch6[1] - 0.6, 0.7, 0.7),
  );
  const webOn = window_(t, ACTS.ch3[0] - 1.5, ACTS.ch3[1] - 0.6, 0.7, 0.7);
  const miniOn = window_(t, ACTS.ch4[0] - 1.5, ACTS.ch4[1] - 0.6, 0.7, 0.7);
  $('stage-hz').style.opacity = hzOn;
  $('stage-web').style.opacity = webOn;
  $('stage-mini').style.opacity = miniOn;
  const footage = Math.max(hzOn, webOn, miniOn);
  $('grade').style.opacity = footage * 0.9;
  $('device-note').style.opacity = miniOn;

  // Chapter chip and lower third live over the footage only.
  const chipOn = footage * (1 - cardOn) * (1 - whoOn);
  $('chip').style.opacity = chipOn;
  $('chip').style.transform = `translateY(${lerp(-14, 0, chipOn)}px)`;

  const thirdOn = chipOn;
  $('third').style.opacity = thirdOn;
  $('third').style.transform = `translateX(${lerp(-30, 0, thirdOn)}px)`;
  $('scrim').style.opacity = chipOn;

  // Every stand-in is labelled for as long as it is on screen.
  const markOn = STANDINS.reduce((acc, [a, b]) => Math.max(acc, window_(t, a, b, 0.4, 0.5)), 0);
  $('standin').style.opacity = markOn * (1 - cardOn);

  // The apps' spinners turn at film rate rather than wall-clock.
  for (const doc of [hzDoc(), webDoc(), miniDoc()]) {
    for (const spinner of doc?.querySelectorAll('.spinner') || []) {
      spinner.style.animation = 'none';
      spinner.style.transform = `rotate(${(t * 420) % 360}deg)`;
    }
  }

  const film = $('film');
  if (film.scrollLeft || film.scrollTop) { film.scrollLeft = 0; film.scrollTop = 0; }
  $('wipe').style.opacity = 0;
}

// ── the recorder's entry point ─────────────────────────────────────────────

let lastT = -1;

window.AD = {
  duration: DURATION,

  async ready() {
    // The photographs, and the stand-ins for what the model would have sent
    // back. Each pair is the same scene drawn twice from one seed, so the only
    // difference between them is the thing the tool was asked to change.
    const png = (canvas) => canvas.toDataURL('image/png');
    const jpg = (canvas) => canvas.toDataURL('image/jpeg', 0.94);

    PHOTO.street = jpg(streetScene({ bin: true }));
    PHOTO.streetClean = png(streetScene({ bin: false }));
    PHOTO.print = jpg(printPhoto({ damage: true }));
    PHOTO.printRestored = png(printPhoto({ damage: false }));
    PHOTO.printColour = png(printPhoto({ damage: false, colour: true }));
    PHOTO.ridge = demoPhoto(1600, 1000);
    PHOTO.cafe = jpg(cafePhoto({ sign: 'HAZEL & FIG' }));
    PHOTO.cafeNew = png(cafePhoto({ sign: 'THE HAZEL TREE' }));

    const loaded = (frame) => new Promise((resolve) => {
      if (frame.contentDocument?.readyState === 'complete') return resolve();
      frame.addEventListener('load', resolve, { once: true });
    });
    await Promise.all([loaded($('hz')), loaded($('web')), loaded($('mini'))]);
    await new Promise((r) => setTimeout(r, 2200));

    // Synthetic pointers have no capture to take, and the throw would abort
    // the app's own handler.
    for (const doc of [hzDoc(), webDoc()]) {
      const stage = doc?.getElementById('stage');
      if (stage) stage.setPointerCapture = () => {};
    }

    // The film's own hooks: the recording bridge hands results back only when
    // the film says to, and only ones the film drew.
    const w = hzWin();
    w.__AD_TRANSFORM = true;
    w.__AD_DESCRIBE = true;

    // Maya's picture goes into the browser build the way she would put it
    // there: dropped onto the page. There is no bridge to ask.
    await dropOnWeb(PHOTO.ridge, 'ridgeline.jpg');
    await new Promise((r) => setTimeout(r, 900));
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
