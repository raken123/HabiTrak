// The ad's timeline.
//
// The recorder steps virtual time and screenshots each frame, so nothing here
// may rely on wall-clock time: every value that moves is computed from `t`, and
// every interaction with the apps is dispatched from a cue at a known second.
//
// The apps in shot are the real ones. The only thing standing in for reality is
// the model: the recording bridges leave every AI call pending, so what you see
// is the genuine progress UI and never an invented result.

const $ = (id) => document.getElementById(id);

// ── easing ─────────────────────────────────────────────────────────────────

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a, b, p) => a + (b - a) * p;
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

/** Opacity for an element that lives between `a` and `b`, with soft edges. */
function window_(t, a, b, fadeIn = 0.45, fadeOut = 0.45) {
  if (t < a - fadeIn || t > b + fadeOut) return 0;
  if (t < a) return easeOut(clamp01((t - (a - fadeIn)) / fadeIn));
  if (t > b) return 1 - easeOut(clamp01((t - b) / fadeOut));
  return 1;
}

/** Progress through a span, eased. */
const span = (t, a, b, ease = easeInOut) => ease(clamp01((t - a) / (b - a)));

// ── reaching into the apps ─────────────────────────────────────────────────

const hzDoc = () => $('hz').contentDocument;
const hzWin = () => $('hz').contentWindow;
const miniDoc = () => $('mini').contentDocument;

const IMAGE_W = 1600;
const IMAGE_H = 1000;

/**
 * Image pixel -> a point inside the Hazelnut stage, mirroring Viewport.fit()
 * exactly so a cue can aim at something in the photograph.
 */
function docToStage(px, py) {
  const stage = hzDoc().getElementById('stage');
  const r = stage.getBoundingClientRect();
  const scale = Math.min(1, Math.min((r.width - 48) / IMAGE_W, (r.height - 48) / IMAGE_H));
  return {
    x: (r.width - IMAGE_W * scale) / 2 + px * scale,
    y: (r.height - IMAGE_H * scale) / 2 + py * scale,
    scale,
  };
}

function pointer(type, stageX, stageY, buttons = 1) {
  const doc = hzDoc();
  const stage = doc.getElementById('stage');
  const r = stage.getBoundingClientRect();
  stage.dispatchEvent(new doc.defaultView.PointerEvent(type, {
    clientX: r.left + stageX,
    clientY: r.top + stageY,
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    isPrimary: true,
    pointerType: 'mouse',
    button: 0,
    buttons: type === 'pointerup' ? 0 : buttons,
  }));
}

const clickIn = (doc, selector) => doc.querySelector(selector)?.click();

function setField(doc, selector, value) {
  const input = doc.querySelector(selector);
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
}

const selectTool = (id) => clickIn(hzDoc(), `.tool[data-tool="${id}"]`);

// ── the copy ───────────────────────────────────────────────────────────────

function third({ eyebrow, name, line, chip, free = false }) {
  $('third-eyebrow').textContent = eyebrow;
  $('third-name').textContent = name;
  $('third-line').textContent = line;
  $('third-chip').textContent = chip;
  $('third-chip').className = `third__chip${free ? ' is-free' : ''}`;
}

function card({ title, sub, foot = '', tiles = null, prices = null }) {
  $('card-title').textContent = title;
  $('card-sub').textContent = sub;
  $('card-foot').textContent = foot;
  const grid = $('card-grid');
  grid.innerHTML = '';
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

// ── the timeline ───────────────────────────────────────────────────────────

const cues = [];
const tracks = [];
const at = (t, fn) => cues.push({ t, fn, done: false });
const over = (a, b, fn) => tracks.push({ a, b, fn });

const ACTS = {
  open:      [0, 9],
  tools:     [9, 16],
  draw:      [16, 41],
  expand:    [41, 66],
  scope:     [66, 90],
  realtouch: [90, 126],
  more:      [126, 144],
  mini:      [144, 165],
  editions:  [165, 174],
  end:       [174, 180],
};
const DURATION = 180;

// -- act: cold open ---------------------------------------------------------

at(0, () => card({ title: 'Hazelnut', sub: 'An advanced AI photo generator.' }));

// -- act: the six tools -----------------------------------------------------

at(ACTS.tools[0] - 0.4, () => card({
  title: 'Six tools.',
  sub: 'Two of them never touch a model.',
  tiles: [
    { name: 'Draw', line: 'A brush, a colour, a size. Runs on your machine.', cost: 'Free', free: true },
    { name: 'Magic Draw', line: 'Sketch in 2D. Submit. The real thing comes back.', cost: '5–20 credits' },
    { name: 'Realtouch', line: 'Removes an object and rebuilds what was behind it.', cost: '20 credits' },
    { name: 'GIF Animate', line: 'Up to five seconds of movement, as a real GIF.', cost: '600 credits' },
    { name: 'Expand', line: 'Grows the canvas, mirroring the edge.', cost: 'Never costs a credit', free: true },
    { name: 'AIScope', line: '80× to 60,000×, then it tells you what it is.', cost: 'Free · Learn 15' },
  ],
}));

// -- act: Draw --------------------------------------------------------------

at(ACTS.draw[0] - 0.6, () => {
  third({
    eyebrow: 'Tool 01',
    name: 'Draw',
    line: 'A brush, a colour and a size. It runs on your machine, on every edition, and it never costs a credit.',
    chip: 'Free',
    free: true,
  });
  selectTool('draw');
});
at(ACTS.draw[0] + 0.6, () => clickIn(hzDoc(), '[data-command="layer:new"]'));

/** Paint a stroke along a path in image coordinates, between two times. */
function stroke(a, b, points, colour) {
  at(a - 0.25, () => {
    if (colour) clickIn(hzDoc(), `.swatch[title="${colour}"]`);
  });
  at(a, () => {
    const p = docToStage(points[0][0], points[0][1]);
    pointer('pointerdown', p.x, p.y);
  });
  over(a, b, (p) => {
    // Sample the path at the eased position so the stroke accelerates and
    // settles the way a hand does.
    const eased = easeInOut(p) * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(eased));
    const f = eased - i;
    const x = lerp(points[i][0], points[i + 1][0], f);
    const y = lerp(points[i][1], points[i + 1][1], f);
    const s = docToStage(x, y);
    pointer('pointermove', s.x, s.y);
  });
  at(b, () => {
    const p = docToStage(points.at(-1)[0], points.at(-1)[1]);
    pointer('pointerup', p.x, p.y, 0);
  });
}

const arc = (cx, cy, r, from, to, n = 24) =>
  Array.from({ length: n }, (_, i) => {
    const a = lerp(from, to, i / (n - 1));
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62];
  });

at(ACTS.draw[0] + 1.0, () => setField(hzDoc(), '#brush-size', 46));
stroke(19.0, 23.5, arc(560, 300, 210, Math.PI * 1.15, Math.PI * 1.95), '#f2c14e');
stroke(25.0, 29.5, arc(980, 230, 160, Math.PI * 0.12, Math.PI * 0.88), '#e8622c');
at(30.2, () => setField(hzDoc(), '#brush-size', 96));
stroke(31.0, 36.5, [[240, 780], [520, 720], [820, 762], [1120, 706], [1400, 744]], '#1f3a5f');

// -- act: Expand ------------------------------------------------------------

at(ACTS.expand[0] - 0.6, () => {
  third({
    eyebrow: 'Tool 05',
    name: 'Expand',
    line: 'Pull the canvas out and the new margin is filled by mirroring the edge, so it reads as more picture rather than a border.',
    chip: '0 credits',
    free: true,
  });
  selectTool('expand');
});

over(43.0, 49.0, (p) => {
  const doc = hzDoc();
  setField(doc, '.optionsbar .field:nth-of-type(2) input[type="number"]', Math.round(easeInOut(p) * 430));
});
over(49.5, 55.0, (p) => {
  const doc = hzDoc();
  setField(doc, '.optionsbar .field:nth-of-type(3) input[type="number"]', Math.round(easeInOut(p) * 300));
});
at(56.5, () => {
  const apply = [...hzDoc().querySelectorAll('.optionsbar .btn')].find((b) => b.textContent.startsWith('Apply'));
  apply?.click();
});

// -- act: AIScope -----------------------------------------------------------

// A clean document, so the coordinates below mean what they say.
at(ACTS.scope[0] - 2.2, () => clickIn(hzDoc(), '[data-command="file:open"]'));
at(ACTS.scope[0] - 0.6, () => {
  third({
    eyebrow: 'Tool 06',
    name: 'AIScope',
    line: 'Magnify from 80× to 60,000×. The badge stops saying "optical" the moment there is no real detail left — it will not pretend.',
    chip: 'Free · Learn 15',
  });
  selectTool('aiscope');
});
at(ACTS.scope[0] + 0.5, () => {
  const p = docToStage(1074, 880);   // the litter bin
  pointer('pointerdown', p.x, p.y);
  pointer('pointerup', p.x, p.y, 0);
});
// Logarithmic, because that is how magnification is read.
over(69.0, 86.0, (p) => {
  // Weighted so most of the act is spent below the optical limit, where the
  // badge still reads "optical", and the leap past it lands as a point.
  const zoom = Math.round(80 * (60000 / 80) ** (p ** 2.1));
  setField(hzDoc(), '#scope-zoom-slider', zoom);
});

// -- act: Realtouch ---------------------------------------------------------

at(ACTS.realtouch[0] - 2.2, () => clickIn(hzDoc(), '[data-command="file:open"]'));
at(ACTS.realtouch[0] - 0.6, () => {
  third({
    eyebrow: 'Tool 03',
    name: 'Realtouch',
    line: 'Paint over what you want gone. It works out where the photo was taken, looks the place up, and reasons about what the object is hiding before it fills the gap.',
    chip: '20 credits',
  });
  selectTool('realtouch');
});
at(ACTS.realtouch[0] + 0.4, () => setField(hzDoc(), '.optionsbar input[type="range"]', 70));

const BIN = [[1050, 850], [1074, 872], [1074, 905], [1050, 928], [1074, 890], [1098, 866], [1098, 910]];
at(92.0, () => { const p = docToStage(BIN[0][0], BIN[0][1]); pointer('pointerdown', p.x, p.y); });
over(92.0, 97.5, (p) => {
  const eased = easeInOut(p) * (BIN.length - 1);
  const i = Math.min(BIN.length - 2, Math.floor(eased));
  const f = eased - i;
  const s = docToStage(lerp(BIN[i][0], BIN[i + 1][0], f), lerp(BIN[i][1], BIN[i + 1][1], f));
  pointer('pointermove', s.x, s.y);
});
at(97.5, () => { const p = docToStage(BIN.at(-1)[0], BIN.at(-1)[1]); pointer('pointerup', p.x, p.y, 0); });

at(99.5, () => {
  const remove = [...hzDoc().querySelectorAll('.optionsbar .btn')].find((b) => b.textContent.startsWith('Remove'));
  remove?.click();
});
// The confirm dialog is the real one: it quotes the price before spending it.
at(103.5, () => {
  const use = [...hzDoc().querySelectorAll('.modal__foot .btn')].find((b) => b.textContent.startsWith('Use'));
  use?.click();
});
// End the beat by cancelling, so the overlay comes down through the app's own
// path and the next act starts on a clean editor.
at(ACTS.realtouch[1] - 2.0, () => hzDoc().getElementById('status-job-cancel')?.click());

// -- act: the two that need the most from the model -------------------------

at(ACTS.more[0] - 0.6, () => {
  third({
    eyebrow: 'Tool 02',
    name: 'Magic Draw',
    line: 'Draw it roughly, describe it in a line, and press Submit. The price is quoted from how much you actually painted — never a flat guess.',
    chip: '5–20 credits',
  });
  selectTool('magic-draw');
});
at(ACTS.more[0] + 1.2, () => setField(hzDoc(), '.optionsbar input[type="text"]', 'a red barn at golden hour, wet grass'));

at(135.0, () => {
  third({
    eyebrow: 'Tool 04',
    name: 'GIF Animate',
    line: 'Describe the motion and get up to five seconds back, encoded into a looping GIF by an encoder built into the app.',
    chip: '600 credits',
  });
  selectTool('gif-animate');
});
at(136.4, () => setField(hzDoc(), '.optionsbar input[type="text"]', 'the grass ripples in a light breeze'));
at(139.0, () => {
  const go = [...hzDoc().querySelectorAll('.optionsbar .btn')].find((b) => b.textContent.startsWith('Generate'));
  go?.click();
});
// The dialog quoting 600 credits is the point of the beat; close it after.
at(ACTS.more[1] - 1.2, () => {
  const cancel = [...hzDoc().querySelectorAll('.modal__foot .btn')].find((b) => b.textContent === 'Cancel');
  cancel?.click();
});

// -- act: Mini --------------------------------------------------------------

at(ACTS.mini[0] - 0.6, () => third({
  eyebrow: 'Hazelnut Mini',
  name: 'One chat bar.',
  line: 'The remover on its own, for Windows, Mac and Android. Say what should go. Half the price of Hazelnut.',
  chip: '$9.99 a month',
}));
at(ACTS.mini[0] + 0.8, () => clickIn(miniDoc(), '#attach'));

const MESSAGE = 'remove the litter bin by the path';
over(148.0, 152.5, (p) => {
  const n = Math.round(easeInOut(p) * MESSAGE.length);
  setField(miniDoc(), '#composer-input', MESSAGE.slice(0, n));
});
at(153.5, () => clickIn(miniDoc(), '#send'));

// -- act: editions ----------------------------------------------------------

at(ACTS.editions[0] - 0.4, () => card({
  title: 'Seven days free.',
  sub: 'Then it does not lock. It becomes Hazelnut Free.',
  tiles: [
    { name: 'Trial', line: 'Every tool unlocked for seven days, with 1,200 credits. No card.', cost: '$0', free: true },
    { name: 'Free', line: 'The same editor for ever, minus anything that needs a model. Draw, Expand and the AIScope zoom stay.', cost: 'No AI, no expiry', free: true },
    { name: 'Hazelnut', line: 'The full app, 5,000 credits a month, Windows and Mac.', cost: '$19.99 / month' },
  ],
}));

// -- act: end card ----------------------------------------------------------

at(ACTS.end[0] - 0.4, () => card({
  title: 'Hazelnut',
  sub: 'Credits are only taken when a result comes back.',
  foot: 'A failed generation costs you nothing.',
  prices: [
    { amt: '$19.99', who: 'Hazelnut', plat: 'Windows · Mac' },
    { amt: '$9.99', who: 'Hazelnut Mini', plat: 'Windows · Mac · Android' },
    { amt: 'Free', who: 'Hazelnut Free', plat: 'After the trial, for ever' },
  ],
}));

// ── per-frame rendering ────────────────────────────────────────────────────

const inAct = (t, act) => t >= ACTS[act][0] && t <= ACTS[act][1];

function paint(t) {
  // Cards own the frame during the open, the tool board, editions and the end.
  const cardOn = Math.max(
    window_(t, ACTS.open[0], ACTS.open[1] - 0.8, 0, 0.8),
    window_(t, ACTS.tools[0], ACTS.tools[1] - 0.6, 0.5, 0.6),
    window_(t, ACTS.editions[0], ACTS.editions[1] - 0.5, 0.5, 0.5),
    window_(t, ACTS.end[0], DURATION, 0.6, 0),
  );
  $('card').style.opacity = cardOn;

  // The mark lands first, then the words rise under it.
  const markIn = span(t, 0.15, 1.5);
  const scale = inAct(t, 'open') ? lerp(0.55, 1, easeOut(markIn)) : 1;
  $('mark').style.transform = `scale(${scale})`;
  $('mark').style.opacity = inAct(t, 'open') ? markIn : 1;
  $('mark').style.display = (inAct(t, 'open') || t >= ACTS.end[0]) ? 'block' : 'none';

  if (inAct(t, 'open')) {
    const title = span(t, 0.9, 2.0);
    $('card-title').style.opacity = title;
    $('card-title').style.transform = `translateY(${lerp(22, 0, title)}px)`;
    const sub = span(t, 1.7, 2.9);
    $('card-sub').style.opacity = sub;
    $('card-sub').style.transform = `translateY(${lerp(14, 0, sub)}px)`;
  } else {
    for (const id of ['card-title', 'card-sub']) {
      $(id).style.opacity = 1;
      $(id).style.transform = 'none';
    }
  }

  // Tiles stagger in behind the heading.
  const tiles = [...$('card-grid').children];
  const gridStart = inAct(t, 'tools') ? ACTS.tools[0] + 0.6
    : inAct(t, 'editions') ? ACTS.editions[0] + 0.5
    : t >= ACTS.end[0] ? ACTS.end[0] + 0.5 : null;
  tiles.forEach((tile, i) => {
    if (gridStart == null) { tile.style.opacity = 1; tile.style.transform = 'none'; return; }
    const p = span(t, gridStart + i * 0.16, gridStart + i * 0.16 + 0.7, easeOut);
    tile.style.opacity = p;
    tile.style.transform = `translateY(${lerp(18, 0, p)}px)`;
  });

  // Footage.
  const hzOn = Math.max(
    window_(t, ACTS.draw[0] - 0.4, ACTS.more[1] - 0.5, 0.5, 0.5),
  );
  const miniOn = window_(t, ACTS.mini[0] - 0.3, ACTS.mini[1] - 0.5, 0.5, 0.5);
  $('stage-hz').style.opacity = hzOn * (1 - miniOn);
  $('stage-mini').style.opacity = miniOn;
  $('grade').style.opacity = Math.max(hzOn * (1 - miniOn), miniOn) * 0.9;

  // No push-in on the footage: this is an interface, and scaling it crops the
  // menu bar and the panel rail. The motion in these acts comes from the app.

  // Lower third: present through every footage act, hidden under the cards.
  const thirdOn = Math.max(
    window_(t, ACTS.draw[0], ACTS.draw[1] - 1.5),
    window_(t, ACTS.expand[0], ACTS.expand[1] - 1.5),
    window_(t, ACTS.scope[0], ACTS.scope[1] - 1.2),
    window_(t, ACTS.realtouch[0], ACTS.realtouch[1] - 1.5),
    window_(t, ACTS.more[0], 134.2),
    window_(t, 135.0, ACTS.more[1] - 1.0),
    window_(t, ACTS.mini[0], ACTS.mini[1] - 1.2),
  );
  $('third').style.opacity = thirdOn * (1 - cardOn);
  $('third').style.transform = `translateX(${lerp(-26, 0, thirdOn)}px)`;

  $('device-note').style.opacity = miniOn;

  // Keep the apps' own spinners turning at video rate rather than wall-clock.
  for (const doc of [hzDoc(), miniDoc()]) {
    for (const spinner of doc?.querySelectorAll('.spinner') || []) {
      spinner.style.animation = 'none';
      spinner.style.transform = `rotate(${(t * 420) % 360}deg)`;
    }
  }

  $('wipe').style.opacity = 0;
}

// ── the recorder's entry point ─────────────────────────────────────────────

let lastT = -1;

window.AD = {
  duration: DURATION,

  /** Load both apps and open the photograph, before a single frame is taken. */
  async ready() {
    const loaded = (frame) => new Promise((resolve) => {
      if (frame.contentDocument?.readyState === 'complete') return resolve();
      frame.addEventListener('load', resolve, { once: true });
    });
    await Promise.all([loaded($('hz')), loaded($('mini'))]);
    // Give each app a moment to boot its own renderer.
    await new Promise((r) => setTimeout(r, 1500));

    // Pointer capture needs a real pointer; the synthetic ones here do not have
    // one, and the throw would abort the app's own handler.
    const stage = hzDoc().getElementById('stage');
    if (stage) stage.setPointerCapture = () => {};

    clickIn(hzDoc(), '[data-command="file:open"]');
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
