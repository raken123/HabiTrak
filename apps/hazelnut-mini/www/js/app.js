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
import { TOOLS } from './tools.js';
import { local } from './local-tools.js';

const bridge = window.hazelnutMini || createWebBridge();

const ui = {
  chat: document.getElementById('chat'),
  tools: document.getElementById('tools'),
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
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

(async function boot() {
  app.state = await bridge.getState();
  renderChip();
  buildTools();
  showEmptyState();

  ui.attach.addEventListener('click', attachPhoto);
  ui.send.addEventListener('click', submit);
  ui.chip.addEventListener('click', showPlan);
  ui.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); submit(); }
  });

  if (!app.state.trialStarted) showWelcome();
  else if (!app.state.apiKeyConfigured && app.state.ai) showApiKeySheet();
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
    el('h1', { text: 'Remove anything' }),
    el('p', { text: 'Add a photo, then say what should go — “the car behind her”, “the sign”, “that guy in the background”. Or use the tools: six of them run on this device and cost nothing.' }),
    el('button', { class: 'btn btn--primary', text: 'Choose a photo', onClick: attachPhoto }),
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
  if (!app.state.ai) return showPlan('Your trial has finished. Hazelnut Mini needs a licence to keep removing things.');
  if (!app.state.apiKeyConfigured) return showApiKeySheet();
  if (app.state.credits < app.state.removalCost) {
    return showPlan(`A removal costs ${app.state.removalCost} credits and you have ${app.state.credits}.`);
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

function renderChip() {
  const { edition, plan, credits, trialDaysLeft, ai } = app.state;
  ui.chip.dataset.edition = edition;
  ui.chip.textContent = edition === 'trial'
    ? `Trial · ${trialDaysLeft}d · ${credits}`
    : ai ? `${plan.name} · ${credits}` : 'Trial ended';
}

// ---------------------------------------------------------------------------
// The toolbar
// ---------------------------------------------------------------------------

const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
  paths.split('|').map((d) => `<path d="${d}"/>`).join('')}</svg>`;

const priceOf = (tool) => (tool.local ? 0 : app.state.costs?.[tool.tool] ?? 0);

function buildTools() {
  ui.tools.replaceChildren(...TOOLS.map((tool) => {
    const cost = priceOf(tool);
    const locked = !tool.local && !app.state.ai;
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

/** The strip is dead until there is a photograph to point it at. */
function syncTools() {
  const ready = Boolean(app.photo) && !app.busy;
  for (const chip of ui.tools.children) chip.disabled = !ready;
}

async function pickTool(tool) {
  if (!app.photo || app.busy) return;
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
  if (!app.state.ai) {
    showPlan(`Your trial has finished. ${tool.name} needs a licence — the six tools that run on this device keep working.`);
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
  const body = el('div', {}, [
    el('div', { class: 'note', text: tool.blurb }),
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
      el('p', { text: `A chat bar that removes things, and twelve tools above it. Free for ${app.state.trialDays} days, no card.` }),
      el('p', { text: 'Six of the tools run on this device and stay free for ever, trial or no trial. The rest cost what they cost in Hazelnut — and Mini is half the price.' }),
    ]),
    actions: (close) => [
      el('button', { class: 'btn', text: 'Later', onClick: () => close(false) }),
      el('button', { class: 'btn btn--primary', text: `Start ${app.state.trialDays}-day trial`, onClick: () => close(true) }),
    ],
  });
  if (start !== true) return;
  await bridge.startTrial();
  app.state = await bridge.getState();
  renderChip();
  say(`Trial started — ${app.state.credits} credits, ${app.state.trialDaysLeft} days.`);
  if (!app.state.apiKeyConfigured) showApiKeySheet();
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
