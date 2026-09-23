// Hazelnut Mini — the whole app.
//
// One transcript, one composer, and a strip of tools above it. Attach a photo,
// say what should go — or tap a tool — and the picture that comes back becomes
// the new working photo, so edits stack up naturally without a layers panel or
// an undo stack.
//
// Six of the tools run on the phone and are free on every edition. The rest
// call the model at exactly the prices Hazelnut charges.

import { createWebBridge } from './web-bridge.js';
import { TOOLS, byId } from './tools.js';
import { HAZEL } from './hazel.js';
import { local } from './local-tools.js';
import { ECO_NOTES } from '../vendor/core/eco.js';
import { planImage } from '../vendor/core/imagine-plan.js';
import { paint } from '../vendor/core/imagine-paint.js';
import { IMAGE_MODELS, DEFAULT_MODEL } from '../vendor/core/models.js';

const bridge = window.hazelnutMini || createWebBridge();

const ui = {
  chat: document.getElementById('chat'),
  tools: document.getElementById('tools'),
  eco: document.getElementById('eco-chip'),
  input: document.getElementById('composer-input'),
  send: document.getElementById('send'),
  attach: document.getElementById('attach'),
  chip: document.getElementById('status-chip'),
  sheets: document.getElementById('sheet-root'),
};

const app = {
  state: null,
  photo: null,        // the working photo, as a data URL
  original: null,     // what was first attached, for "start over"
  busy: false,
  prices: {},         // tool id -> credits, quoted by the bridge
  ecoWarned: false,   // Eco Mode's caveat is said once a session, not per run
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

(async function boot() {
  app.state = await bridge.getState();
  renderChip();
  renderEco();
  buildTools();
  showEmptyState();

  ui.eco.addEventListener('click', toggleEco);
  ui.attach.addEventListener('click', attachPhoto);
  ui.send.addEventListener('click', submit);
  ui.chip.addEventListener('click', showPlan);
  ui.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); submit(); }
  });

  if (!app.state.trialStarted) showWelcome();
  // Only nag about a key if there is something that needs one. Imagine does
  // not, and on the trial it is the only model-backed tool available.
  else if (!app.state.apiKeyConfigured && app.state.partnerModels) showApiKeySheet();
})();

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    // Styles go through the CSSOM: the CSP blocks the style attribute.
    else if (key === 'style') node.style.cssText = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null && value !== false) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function push(node) {
  ui.chat.querySelector('.empty')?.remove();
  ui.chat.append(node);
  ui.chat.scrollTop = ui.chat.scrollHeight;
  return node;
}

const say = (text, { me = false, error = false } = {}) => push(el('div', {
  class: `msg msg--${me ? 'me' : 'app'}`,
}, [el('div', { class: `bubble${error ? ' bubble--error' : ''}`, text })]));

function thinking(text) {
  const label = el('span', { text });
  const node = push(el('div', { class: 'msg msg--app' }, [
    el('div', { class: 'bubble bubble--thinking' }, [el('span', { class: 'spinner' }), label]),
  ]));
  return {
    update: (next) => { label.textContent = next; },
    done: () => node.remove(),
  };
}

function showPhoto(dataUrl, { caption, actions = [] } = {}) {
  return push(el('div', { class: 'msg msg--app' }, [
    el('img', { class: 'photo', src: dataUrl, alt: caption || 'Photo' }),
    caption ? el('div', { class: 'meta', text: caption }) : null,
    actions.length ? el('div', { class: 'photo-actions' }, actions.map((action) => el('button', {
      class: action.primary ? 'btn btn--primary' : 'btn',
      text: action.label,
      onClick: action.onClick,
    }))) : null,
  ]));
}

function showEmptyState() {
  ui.chat.replaceChildren(el('div', { class: 'empty' }, [
    // Hazel. Decoration — she is described for anyone who cannot see her, and
    // nothing here is said only by the picture.
    el('img', { class: 'hazel', src: HAZEL['hazel-camera'], alt: 'Hazel the Squirrel, holding a camera' }),
    el('h1', { text: 'Remove anything' }),
    el('p', { text: 'Add a photo, then say what should go — “the car behind her”, “the sign”, “that guy in the background”. Six of the tools run on this device and cost nothing.' }),
    el('p', { text: 'No photograph? Imagine draws one, here on the phone.' }),
    el('button', { class: 'btn btn--primary', text: 'Choose a photo', onClick: attachPhoto }),
    el('button', { class: 'btn', text: 'Imagine one', onClick: () => runImagine(byId('imagine')) }),
  ]));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function attachPhoto() {
  try {
    const file = await bridge.openImage();
    if (!file) return;
    app.photo = file.dataUrl;
    app.original = file.dataUrl;
    syncTools();
    showPhoto(file.dataUrl, { caption: file.name });
    say('Got it. Tap a tool, or tell me what to remove.');
    ui.input.focus();
  } catch (err) {
    say(err.message || 'That photo could not be opened.', { error: true });
  }
}

async function submit() {
  const message = ui.input.value.trim();
  if (!message || app.busy) return;

  if (!app.photo) {
    say(message, { me: true });
    say('Add a photo first — tap the picture button on the left.', { error: true });
    return;
  }
  if (!app.state.partnerModels) {
    return showPlan('Removing sends your photo to a partner model, and that comes with Mini. The tools that run on this device — Imagine among them — keep working.');
  }
  if (!app.state.apiKeyConfigured) return showApiKeySheet();
  if (app.state.credits < app.state.removalCost) {
    return showPlan(`A removal costs ${app.state.removalCost} credits and you have ${app.state.credits}.`);
  }
  if (app.state.eco && !app.ecoWarned) {
    // Once per session, not once per removal: it is a warning, not a nag.
    app.ecoWarned = true;
    say('Eco Mode: no location lookup on this one — it fills from what is around the thing. Cheaper, and worse where the place matters.');
  }

  say(message, { me: true });
  ui.input.value = '';
  setBusy(true);

  const progress = thinking('Reading your message…');
  try {
    const call = bridge.remove({ image: app.photo, message }, (p) => progress.update(p.message));
    const { result, charged, balance } = await call;
    progress.done();

    app.state.credits = balance;
    renderChip();

    if (!result.handled) {
      say(result.reply);
      return;
    }

    const previous = app.photo;
    app.photo = result.image;
    say(result.reply);
    showPhoto(result.image, {
      caption: `${charged} credits used · ${app.state.credits} left`,
      actions: photoActions(result.image, previous),
    });
  } catch (err) {
    progress.done();
    reportError(err);
  } finally {
    setBusy(false);
  }
}

async function save(dataUrl) {
  try {
    const saved = await bridge.saveImage(dataUrl);
    if (saved) say(`Saved to ${saved.path}.`);
  } catch (err) {
    say(err.message || 'That could not be saved.', { error: true });
  }
}

function reportError(err) {
  if (err?.code === 'INSUFFICIENT_CREDITS') return showPlan(err.message);
  if (err?.code === 'TOOL_LOCKED') return showPlan(err.message);
  if (err?.code === 'NO_API_KEY') return showApiKeySheet();
  if (err?.name === 'AbortError') return say('Cancelled. Nothing was charged.');
  say(err?.message || 'Something went wrong. Nothing was charged.', { error: true });
}

function setBusy(busy) {
  app.busy = busy;
  ui.send.disabled = busy;
  ui.attach.disabled = busy;
  ui.input.disabled = busy;
  syncTools();
}

/**
 * Eco Mode. The switch lives here rather than in a settings screen because it
 * changes what the next tap will cost and how good the result will be, and
 * both of those belong where the tapping happens.
 */
async function toggleEco() {
  if (app.busy) return;
  const next = !app.state.eco;
  app.state = await bridge.setEco(next);
  renderEco();
  renderChip();
  buildTools();
  say(next
    ? app.state.ecoSummary
    : 'Eco Mode off. Full size, the location lookup back on, full price.');
}

function renderEco() {
  // Eco Mode buys less work from somebody else's datacentre. Without the
  // partner models there is no datacentre in the picture: the local tools cost
  // nothing to run and Imagine is exempt because it runs on this phone. So the
  // switch is hidden rather than offering a saving it cannot make.
  ui.eco.hidden = !app.state.partnerModels;
  ui.eco.setAttribute('aria-pressed', String(Boolean(app.state.eco)));
}

function renderChip() {
  const { edition, plan, credits } = app.state;
  ui.chip.dataset.edition = edition;
  // No countdown: the trial has no end. The credits are the only number that
  // moves, so they are the only one shown.
  ui.chip.textContent = edition === 'trial'
    ? `Trial · ${credits}`
    : `${plan.name} · ${credits}`;
}

// ---------------------------------------------------------------------------
// The toolbar
// ---------------------------------------------------------------------------

const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
  paths.split('|').map((d) => `<path d="${d}"/>`).join('')}</svg>`;

const priceOf = (tool) => {
  if (tool.local) return 0;
  // Imagine costs what the chosen model costs on this edition, not what the
  // tool costs — there is no single number to put on the chip, so the chip
  // shows the model the sheet opens on.
  if (tool.imagine) return modelFor(imagineState.model)?.price ?? 0;
  return app.state.costs?.[tool.tool] ?? 0;
};

/** Shapes Imagine will draw. The plan clamps these to the edition's ceiling. */
const SHAPES = [
  { id: 'square', label: 'Square', width: 1024, height: 1024 },
  { id: 'portrait', label: 'Portrait', width: 832, height: 1216 },
  { id: 'landscape', label: 'Landscape', width: 1216, height: 832 },
];

const imagineState = { prompt: '', model: DEFAULT_MODEL, shape: 'square' };
const modelFor = (id) => (app.state?.models || []).find((m) => m.id === id);

function buildTools() {
  ui.tools.replaceChildren(...TOOLS.map((tool) => {
    const cost = priceOf(tool);
    // Imagine is never locked by edition: it is ours and it runs here. What can
    // stop it is running out of credits, which is a different message.
    const locked = !tool.local && !tool.imagine && !app.state.partnerModels;
    const chip = el('button', {
      class: `tool${locked ? ' tool--locked' : ''}`,
      type: 'button',
      title: tool.blurb,
      'aria-label': `${tool.name} — ${cost ? `${cost} credits` : 'free'}`,
      onClick: () => pickTool(tool),
    }, [
      el('span', { class: 'icon', html: svg(tool.icon) }),
      el('span', { text: tool.name }),
      el('span', { class: `price${cost ? '' : ' price--free'}`, text: cost ? String(cost) : 'free' }),
    ]);
    return chip;
  }));
  syncTools();
}

/**
 * The strip is dead until there is a photograph to point it at — except for
 * Imagine, which is how you get one when you have not brought your own.
 */
function syncTools() {
  const ready = Boolean(app.photo) && !app.busy;
  TOOLS.forEach((tool, i) => {
    const chip = ui.tools.children[i];
    if (chip) chip.disabled = tool.generates ? app.busy : !ready;
  });
}

async function pickTool(tool) {
  if (app.busy) return;
  if (tool.imagine) return runImagine(tool);
  if (!app.photo) return;
  if (!tool.local && !(await canAfford(tool))) return;

  // Anything a tool needs to know is asked for once, up front, with the price
  // on the button — so a run is one tap and one sheet, never two.
  const params = { ...(tool.params || {}) };
  let asked = false;
  if (tool.sliders || tool.field) {
    if (await askFor(tool, params) !== true) return;
    asked = true;
  }

  if (tool.local) return runLocal(tool, params);
  return runModel(tool, params, { confirmed: asked });
}

/** The three reasons a paid tool cannot run, said plainly rather than tried. */
async function canAfford(tool) {
  if (!app.state.partnerModels) {
    showPlan(`${tool.name} needs a licence — the six tools that run on this device keep working.`);
    return false;
  }
  if (!app.state.apiKeyConfigured) { showApiKeySheet(); return false; }
  const cost = priceOf(tool);
  if (app.state.credits < cost) {
    showPlan(`${tool.name} costs ${cost} credits and you have ${app.state.credits}.`);
    return false;
  }
  return true;
}

function askFor(tool, params) {
  const inputs = [];
  const ecoNote = app.state.eco && tool.tool ? ECO_NOTES[tool.tool] : null;
  const body = el('div', {}, [
    el('div', { class: 'note', text: tool.blurb }),
    ecoNote ? el('div', { class: 'note note--eco', text: `Eco Mode: ${ecoNote}` }) : null,
    ...(tool.sliders || []).map((slider) => {
      params[slider.key] = slider.value;
      const output = el('output', { text: `${slider.value}${slider.suffix || ''}` });
      const input = el('input', {
        type: 'range', min: slider.min, max: slider.max, value: slider.value,
        oninput: (e) => {
          params[slider.key] = +e.target.value;
          output.textContent = `${e.target.value}${slider.suffix || ''}`;
        },
      });
      inputs.push(input);
      return el('label', { class: 'slider' }, [el('span', { text: slider.label }), input, output]);
    }),
    tool.field ? el('label', {}, [
      el('span', { text: tool.field.label }),
      el('input', {
        type: 'text', autocomplete: 'off', placeholder: tool.field.placeholder || '',
        oninput: (e) => { params[tool.field.key] = e.target.value.trim(); },
      }),
    ]) : null,
  ]);

  const cost = priceOf(tool);
  return sheet({
    title: tool.name,
    body,
    actions: (close) => [
      el('button', { class: 'btn', text: 'Cancel', onClick: () => close(false) }),
      el('button', {
        class: 'btn btn--primary',
        text: cost ? `Run · ${cost} credits` : 'Apply',
        onClick: () => close(true),
      }),
    ],
  });
}

/**
 * Imagine, on the phone.
 *
 * The odd one in this file: it needs no photograph, reaches no network, and
 * does its work right here rather than through the engine. Only the charge
 * goes through the bridge, and it goes after the picture exists — so a
 * generation that is cancelled or that throws costs nothing.
 */
async function runImagine(tool) {
  const models = app.state.models || [];
  if (!models.length) { say('This build has no image models.', { error: true }); return; }
  if (!modelFor(imagineState.model)) imagineState.model = models[0].id;

  let runButton = null;
  const note = el('div', { class: 'note', text: '' });
  const buttonLabel = () => {
    const model = modelFor(imagineState.model);
    return model?.unlimited ? 'Draw it' : `Draw it · ${model?.price ?? 0} credits`;
  };
  const sync = () => {
    const model = modelFor(imagineState.model);
    note.textContent = model?.thinks
      ? 'Thinks the picture through before drawing it, and checks anything it claims.'
      : (model?.limits?.[0] || '');
    if (runButton) runButton.textContent = buttonLabel();
  };

  const body = el('div', {}, [
    el('div', { class: 'note', text: tool.blurb }),
    el('label', {}, [
      el('span', { text: 'Describe it' }),
      el('input', {
        type: 'text', autocomplete: 'off', placeholder: 'a cottage in the snow',
        value: imagineState.prompt,
        oninput: (e) => { imagineState.prompt = e.target.value; },
      }),
    ]),
    el('label', {}, [
      el('span', { text: 'Model' }),
      el('select', { onchange: (e) => { imagineState.model = e.target.value; sync(); } },
        models.map((m) => el('option', {
          value: m.id,
          selected: m.id === imagineState.model,
          text: `${m.name} — ${m.priceLabel}`,
        }))),
    ]),
    el('label', {}, [
      el('span', { text: 'Shape' }),
      el('select', { onchange: (e) => { imagineState.shape = e.target.value; } },
        SHAPES.map((sh) => el('option', {
          value: sh.id, selected: sh.id === imagineState.shape, text: sh.label,
        }))),
    ]),
    note,
  ]);
  sync();

  const go = await sheet({
    title: 'Imagine',
    body,
    actions: (close) => {
      runButton = el('button', { class: 'btn btn--primary', text: buttonLabel(), onClick: () => close(true) });
      return [el('button', { class: 'btn', text: 'Cancel', onClick: () => close(false) }), runButton];
    },
  });
  if (go !== true) return;

  const prompt = imagineState.prompt.trim();
  if (!prompt) { say('Describe the picture you want and I will draw it.'); return; }

  const quote = await bridge.imagineQuote(imagineState.model);
  if (!quote.allowed) { showPlan(quote.message || 'That model is not available on this edition.'); return; }
  if (!quote.affordable) {
    showPlan(`${IMAGE_MODELS[quote.model].name} costs ${quote.cost} credits and you have ${quote.balance}.`);
    return;
  }

  setBusy(true);
  const progress = thinking(`${IMAGE_MODELS[quote.model].name} is drawing…`);
  try {
    const shape = SHAPES.find((sh) => sh.id === imagineState.shape) || SHAPES[0];
    const plan = planImage({
      prompt,
      model: quote.model,
      edition: quote.edition,
      width: shape.width,
      height: shape.height,
    });

    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    paint(canvas.getContext('2d'), plan);
    const image = canvas.toDataURL('image/png');

    // Drawn. Only now is anything charged.
    const { charged, balance } = await bridge.imagineCharge(quote.model);
    progress.done();
    app.state.credits = balance;
    renderChip();

    const previous = app.photo;
    app.photo = image;
    if (!app.original) app.original = image;
    syncTools();

    showPhoto(image, {
      caption: `${IMAGE_MODELS[quote.model].name} · ${charged ? `${charged} credits used · ${balance} left` : 'unlimited on this edition'}`,
      actions: photoActions(image, previous || image),
    });

    if (plan.clamped) say(`Drawn at ${plan.width}×${plan.height} — this edition caps the longest edge at ${quote.maxEdge}px.`);
    if (plan.parsed.ignored.length) say(`I did not understand: ${plan.parsed.ignored.join(', ')}.`);
    for (const warning of plan.warnings) say(warning, { error: true });
    say('It is a photo now — the tools above work on it.');
  } catch (err) {
    progress.done();
    reportError(err);
  } finally {
    setBusy(false);
  }
}

async function runLocal(tool, params) {
  setBusy(true);
  const progress = thinking(`${tool.name}…`);
  try {
    const previous = app.photo;
    const image = await local[tool.local](app.photo, params);
    progress.done();
    app.photo = image;
    showPhoto(image, {
      caption: `${tool.name} · on this device, no credits`,
      actions: photoActions(image, previous),
    });
  } catch (err) {
    progress.done();
    reportError(err);
  } finally {
    setBusy(false);
  }
}

async function runModel(tool, params, { confirmed = false } = {}) {
  const cost = priceOf(tool);
  const go = confirmed ? true : await sheet({
    title: `Run ${tool.name}?`,
    body: el('div', {}, [
      el('div', { class: 'note', text: tool.blurb }),
      app.state.eco && ECO_NOTES[tool.tool]
        ? el('div', { class: 'note note--eco', text: `Eco Mode: ${ECO_NOTES[tool.tool]}` })
        : null,
      el('p', { text: `This will use ${cost} credits. You have ${app.state.credits}.` }),
      el('div', { class: 'note', text: 'Credits are only taken if the result comes back. A failed run costs nothing.' }),
    ]),
    actions: (close) => [
      el('button', { class: 'btn', text: 'Cancel', onClick: () => close(false) }),
      el('button', { class: 'btn btn--primary', text: `Use ${cost}`, onClick: () => close(true) }),
    ],
  });
  if (go !== true) return;

  setBusy(true);
  const progress = thinking(`${tool.name}…`);
  try {
    if (tool.reads) {
      // Caption generates nothing: the answer is words, so it lands as a message.
      const { result, charged, balance } = await bridge.describe({ image: app.photo }, (p) => progress.update(p.message));
      progress.done();
      app.state.credits = balance;
      renderChip();
      say(result.caption);
      if (result.alt) say(`Alt text: ${result.alt}`);
      if (result.keywords?.length) say(result.keywords.join(' · '));
      if (result.note) say(result.note);
      say(`${charged} credits used · ${balance} left`);
      return;
    }

    const previous = app.photo;
    const { result, charged, balance } = await bridge.transform(tool.tool, {
      image: app.photo,
      params,
    }, (p) => progress.update(p.message));
    progress.done();

    app.state.credits = balance;
    renderChip();
    app.photo = result.image;
    showPhoto(result.image, {
      caption: `${tool.name} · ${charged} credits used · ${balance} left`,
      actions: photoActions(result.image, previous),
    });
  } catch (err) {
    progress.done();
    reportError(err);
  } finally {
    setBusy(false);
  }
}

/** Save, step back one, or go all the way back to what was attached. */
function photoActions(image, previous) {
  return [
    { label: 'Save', primary: true, onClick: () => save(image) },
    { label: 'Undo', onClick: () => { app.photo = previous; say('Back to the previous version.'); showPhoto(previous, { caption: 'Restored' }); } },
    { label: 'Start over', onClick: () => { app.photo = app.original; say('Back to the original photo.'); showPhoto(app.original, { caption: 'Original' }); } },
  ];
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function sheet({ title, body, actions }) {
  return new Promise((resolve) => {
    const close = (value) => { backdrop.remove(); resolve(value); };
    const panel = el('div', { class: 'sheet' }, [
      el('h2', { text: title }),
      body,
      el('div', { class: 'actions' }, actions(close)),
    ]);
    const backdrop = el('div', {
      class: 'sheet-backdrop',
      onClick: (event) => { if (event.target === backdrop) close(undefined); },
    }, [panel]);
    ui.sheets.append(backdrop);
  });
}

async function showWelcome() {
  const start = await sheet({
    title: 'Hazelnut Mini',
    body: el('div', {}, [
      el('p', { text: `A chat bar that removes things, and thirteen tools above it. Free, with no deadline and no card — it opens with ${app.state.trialCreditGrant || 700} credits and they are never topped up.` }),
      el('p', { text: 'Six of the tools run on this device and stay free for ever. Imagine runs here too — it is our own image model, so it needs no key and nothing leaves the phone — and it is charged by the picture.' }),
      el('p', { text: 'The remover, and the tools that send your photo to a partner model, come with Mini itself.' }),
    ]),
    actions: (close) => [
      el('button', { class: 'btn', text: 'Later', onClick: () => close(false) }),
      el('button', { class: 'btn btn--primary', text: 'Claim the credits', onClick: () => close(true) }),
    ],
  });
  if (start !== true) return;
  await bridge.startTrial();
  app.state = await bridge.getState();
  renderChip();
  say(`Trial started — ${app.state.credits} credits, and no deadline.`);
  say('Tap Imagine to draw something — it runs on this phone and needs no key.');
  // Only ask for a key when something here actually needs one.
  if (!app.state.apiKeyConfigured && app.state.partnerModels) showApiKeySheet();
}

function showApiKeySheet() {
  const input = el('input', { type: 'password', autocomplete: 'off', placeholder: 'Paste your Gemini API key' });
  sheet({
    title: 'Add your API key',
    body: el('div', {}, [
      el('div', { class: 'note', text: 'Mini uses your own Gemini key. It is stored on this device and sent nowhere but Google.' }),
      el('label', {}, [el('span', { text: 'Gemini API key' }), input]),
      el('p', {}, [
        'Get one at ',
        el('a', { href: '#', text: 'aistudio.google.com/apikey', onClick: (e) => { e.preventDefault(); bridge.openExternal('https://aistudio.google.com/apikey'); } }),
        '.',
      ]),
      el('div', { class: 'note note--warn', text: 'Treat it like a password. A key that has been pasted into a chat or a commit should be revoked and replaced.' }),
    ]),
    actions: (close) => [
      el('button', { class: 'btn', text: 'Not now', onClick: () => close() }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Save',
        onClick: async () => {
          const key = input.value.trim();
          if (!key) return close();
          await bridge.saveApiKey(key);
          app.state = await bridge.getState();
          renderChip();
          close();
          say('Key saved. Add a photo and tell me what to remove.');
        },
      }),
    ],
  });
}

function showPlan(reason) {
  const mini = app.state.plans.mini;
  const full = app.state.plans.full;
  sheet({
    title: 'Hazelnut Mini',
    body: el('div', {}, [
      typeof reason === 'string' ? el('div', { class: 'note', text: reason }) : null,
      el('div', { class: 'price-row' }, [
        el('span', { class: 'amount', text: `$${mini.monthlyUsd.toFixed(2)}` }),
        el('span', { text: '/ month' }),
        el('span', { class: 'was', text: `$${full.monthlyUsd.toFixed(2)}` }),
      ]),
      el('p', { text: `Half the price of Hazelnut. ${mini.credits.toLocaleString('en-US')} credits a month — about ${Math.floor(mini.credits / app.state.removalCost)} removals. Windows, Mac and Android.` }),
      el('p', { text: `You are on ${app.state.plan.name}, with ${app.state.credits} credits.` }),
    ]),
    actions: (close) => [
      el('button', { class: 'btn', text: 'Close', onClick: () => close() }),
      el('button', { class: 'btn btn--primary', text: 'Enter licence key', onClick: () => { close(); showActivate(); } }),
    ],
  });
}

function showActivate() {
  const input = el('input', { type: 'text', autocomplete: 'off', placeholder: 'HZL-XXXXX-XXXXX-XXXXX-XXXXX' });
  sheet({
    title: 'Activate',
    body: el('label', {}, [el('span', { text: 'Licence key' }), input]),
    actions: (close) => [
      el('button', { class: 'btn', text: 'Cancel', onClick: () => close() }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Activate',
        onClick: async () => {
          const result = await bridge.activate(input.value);
          if (!result.ok) { say(result.error, { error: true }); return close(); }
          app.state = await bridge.getState();
          renderChip();
          close();
          say(`Activated — ${app.state.plan.name}, ${app.state.credits} credits.`);
        },
      }),
    ],
  });
}
