// Hazelnut Movi.
//
// Two modes over one model (core/movi.js), and the whole of the difference
// between them is who decides and when the money moves:
//
//   Simple    you type, it decides length and quality, it charges, then it
//             renders. There is no confirmation step — that is the product —
//             so the warning is permanent and the restore is real.
//   Advanced  eight seconds at a time, quoted on the button before you press
//             it, extended in the strip below.
//
// The bridge behind this exposes the same surface in the browser and in
// Electron, so nothing here knows which it is talking to.

import {
  MODES, MODE_ORDER, MODEL_ORDER, VIDEO_MODELS, MAX_CLIP_SECONDS,
  planSimple, costOfClip, costOfExtension, restorable, restoreRefusal,
  RESTORE_WINDOW_MS, modelFor,
} from '../vendor/core/movi.js';
import { formatBytes, storageLine, usedFraction } from '../vendor/core/storage.js';

const bridge = window.hazelnutMovi;

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const app = {
  state: null,
  mode: 'simple',
  /** The last Simple render, and the only thing that can be restored. */
  last: null,
  clips: [],
};

// ── chrome ─────────────────────────────────────────────────────────────────

function renderPills() {
  const { storage, credits } = app.state;
  $('storage-pill').textContent = storageLine(storage.usedBytes, storage.tier);
  $('storage-pill').title = storage.tier === 'founder'
    ? `Founder storage: ${formatBytes(storage.quotaBytes)}`
    : `${formatBytes(storage.quotaBytes)} of storage`;
  $('credits-pill').textContent = `${credits} credits`;
}

function status(text) { $('status-text').textContent = text; }

function toast(text, ms = 3200) {
  const node = el('div', { class: 'toast', text });
  $('toasts').append(node);
  setTimeout(() => node.remove(), ms);
}

function sheet({ title, body, actions }) {
  return new Promise((resolve) => {
    const close = (value) => { $('sheets').replaceChildren(); resolve(value); };
    $('sheets').replaceChildren(el('div', { class: 'sheet' }, [
      el('h2', { text: title }),
      ...[].concat(body).map((line) => el('p', { html: line })),
      el('div', { class: 'sheet__actions' }, actions.map((action) => el('button', {
        class: action.primary ? 'btn btn--primary' : 'btn',
        text: action.label,
        onClick: () => close(action.value),
      }))),
    ]));
  });
}

function buildModes() {
  $('modes').replaceChildren(...MODE_ORDER.map((id) => el('button', {
    class: 'mode',
    role: 'tab',
    'aria-selected': String(id === app.mode),
    html: `${MODES[id].name}<small>${MODES[id].blurb}</small>`,
    onClick: () => setMode(id),
  })));
}

function setMode(id) {
  app.mode = id;
  buildModes();
  $('pane-simple').hidden = id !== 'simple';
  $('pane-advanced').hidden = id !== 'advanced';
  status(MODES[id].blurb);
}

// ── Simple ─────────────────────────────────────────────────────────────────

/** Show what Simple would do, so the spend is at least visible beforehand. */
function previewSimple() {
  const prompt = $('prompt-simple').value.trim();
  const box = $('simple-quote');
  if (!prompt) { box.hidden = true; return null; }
  const plan = planSimple(prompt, { budget: app.state.credits });
  box.hidden = false;
  if (!plan.affordable) {
    box.innerHTML = `Not enough credits. The shortest clip Movi makes is `
      + `<b>${costOfClip('hazelnut-3.0-lite')}</b> credits and you have `
      + `<b>${app.state.credits}</b>.`;
    $('simple-go').disabled = true;
    return plan;
  }
  const model = modelFor(plan.model);
  box.innerHTML = `<b>${plan.seconds}s</b> at ${model.height}p on <b>${model.name}</b>`
    + ` · <b>${plan.cost}</b> credits`
    + (plan.trimmed === 'shortened' ? ' · shortened to fit your balance' : '')
    + (plan.trimmed === 'downgraded' ? ' · stepped down to fit your balance' : '');
  $('simple-go').disabled = false;
  return plan;
}

async function runSimple() {
  const prompt = $('prompt-simple').value.trim();
  if (!prompt) return;
  const plan = planSimple(prompt, { budget: app.state.credits });
  if (!plan.affordable) { toast('Not enough credits for a clip.'); return; }

  $('simple-go').disabled = true;
  status(`Making ${plan.seconds}s on ${modelFor(plan.model).name}…`);
  try {
    // The charge happens inside the bridge, before the render, because that is
    // what Simple is: no confirmation step. The restore is what makes it fair.
    const render = await bridge.renderSimple(plan);
    app.state = await bridge.getState();
    app.last = render;
    showResult(render);
    renderPills();
    status('Done.');
  } catch (err) {
    toast(err.message || 'That did not work.');
    status('Nothing was charged.');
  } finally {
    $('simple-go').disabled = false;
  }
}

function showResult(render) {
  $('simple-result').hidden = false;
  drawPoster($('simple-canvas'), render);
  const model = modelFor(render.model);
  $('simple-meta').textContent =
    `${render.seconds}s · ${model.height}p · ${model.name} · ${render.charged} credits`;
  tickRestore();
}

/** The restore button, and the window closing under it. */
function tickRestore() {
  const check = restorable(app.last);
  const button = $('simple-restore');
  button.disabled = !check.ok;
  if (check.ok) {
    const mins = Math.ceil(check.msLeft / 60000);
    $('simple-left').textContent = `${mins} minute${mins === 1 ? '' : 's'} left to change your mind`;
  } else {
    $('simple-left').textContent = app.last ? restoreRefusal(check.reason) : '';
  }
}

async function restore() {
  const check = restorable(app.last);
  if (!check.ok) { toast(restoreRefusal(check.reason)); return; }
  const yes = await sheet({
    title: 'Put the credits back?',
    body: [
      `This returns <b>${check.amount}</b> credits and throws the video away.`,
      'It cannot be undone, and a render can only be returned once.',
    ],
    actions: [
      { label: 'Keep it', value: false },
      { label: 'Put them back', value: true, primary: true },
    ],
  });
  if (!yes) return;
  await bridge.restore(app.last.id);
  app.state = await bridge.getState();
  app.last = { ...app.last, restoredAt: Date.now() };
  $('simple-result').hidden = true;
  renderPills();
  tickRestore();
  toast(`${check.amount} credits are back.`);
}

// ── Advanced ───────────────────────────────────────────────────────────────

function buildModels() {
  $('model-advanced').replaceChildren(...MODEL_ORDER.map((id) => el('option', {
    value: id,
    text: `${VIDEO_MODELS[id].name} — ${VIDEO_MODELS[id].height}p, ${costOfClip(id)} credits`,
  })));
  quoteAdvanced();
}

function quoteAdvanced() {
  const id = $('model-advanced').value || MODEL_ORDER[0];
  $('advanced-go').textContent = `Make ${MAX_CLIP_SECONDS}s — ${costOfClip(id)} credits`;
}

async function runAdvanced(extendOf = null) {
  const prompt = extendOf ? extendOf.prompt : $('prompt-advanced').value.trim();
  if (!prompt) { toast('Describe the clip first.'); return; }
  const model = extendOf ? extendOf.model : ($('model-advanced').value || MODEL_ORDER[0]);
  const cost = extendOf ? costOfExtension(model) : costOfClip(model);
  if (app.state.credits < cost) { toast(`That costs ${cost} credits; you have ${app.state.credits}.`); return; }

  $('advanced-go').disabled = true;
  status(extendOf ? 'Extending…' : 'Making eight seconds…');
  try {
    const clip = await bridge.renderClip({ prompt, model, extendOf: extendOf?.id || null });
    app.state = await bridge.getState();
    app.clips = await bridge.listClips();
    renderClips();
    renderPills();
    status('Done.');
  } catch (err) {
    toast(err.message || 'That did not work.');
    status('Nothing was charged.');
  } finally {
    $('advanced-go').disabled = false;
  }
}

function renderClips() {
  const list = $('clips');
  $('strip-empty').hidden = app.clips.length > 0;
  $('strip-length').textContent = app.clips.length
    ? `${app.clips.reduce((n, c) => n + c.seconds, 0)}s over ${app.clips.length} clip${app.clips.length === 1 ? '' : 's'}`
    : '';
  list.replaceChildren(...app.clips.map((clip) => {
    const thumb = el('canvas', { class: 'clip__thumb', width: 96, height: 54 });
    drawPoster(thumb, clip);
    return el('li', { class: 'clip' }, [
      thumb,
      el('div', { class: 'clip__text' }, [
        el('b', { text: clip.prompt }),
        el('span', {
          text: `${clip.seconds}s · ${modelFor(clip.model).name}`
            + (clip.extendOf ? ' · extension' : ''),
        }),
      ]),
      el('button', {
        class: 'btn',
        text: `Extend +${MAX_CLIP_SECONDS}s (${costOfExtension(clip.model)})`,
        onClick: () => runAdvanced(clip),
      }),
    ]);
  }));
}

// ── the poster ─────────────────────────────────────────────────────────────

/**
 * What a clip looks like before there is a clip.
 *
 * There are no Hazelnut 3.0 servers in this repository, so nothing here has
 * ever produced a frame of video. Rather than show a black rectangle and let
 * it be mistaken for output, every clip draws a placard that says what it
 * would have been. `render.pending` is set by the bridge and is the flag the
 * whole of this honesty rests on: if a real renderer ever fills `render.frame`,
 * this function draws that instead and the placard disappears on its own.
 */
function drawPoster(canvas, render) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);

  if (render.frame) {
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, w, h);
    image.src = render.frame;
    return;
  }

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2a2420');
  grad.addColorStop(1, '#171412');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(224,137,74,.45)';
  ctx.lineWidth = Math.max(1, w / 320);
  ctx.setLineDash([w / 40, w / 40]);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
  ctx.setLineDash([]);

  ctx.fillStyle = '#e0894a';
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.round(h / 7)}px system-ui, sans-serif`;
  ctx.fillText('NOT RENDERED', w / 2, h / 2 - h / 24);
  ctx.fillStyle = '#9a8c7e';
  ctx.font = `${Math.round(h / 11)}px system-ui, sans-serif`;
  ctx.fillText(`${render.seconds}s · ${modelFor(render.model).name}`, w / 2, h / 2 + h / 6);
}

// ── boot ───────────────────────────────────────────────────────────────────

(async function boot() {
  app.state = await bridge.getState();
  app.clips = await bridge.listClips();

  buildModes();
  buildModels();
  renderPills();
  renderClips();
  setMode('simple');

  $('simple-warn').textContent = MODES.simple.warning;
  $('prompt-simple').addEventListener('input', previewSimple);
  $('simple-go').addEventListener('click', runSimple);
  $('simple-restore').addEventListener('click', restore);
  $('model-advanced').addEventListener('change', quoteAdvanced);
  $('advanced-go').addEventListener('click', () => runAdvanced(null));

  // The restore window closes whether or not anything is clicked, and the
  // label has to stop saying "14 minutes left" when it is over.
  setInterval(tickRestore, 15_000);

  if (!app.state.welcomed) await showWelcome();
})();

async function showWelcome() {
  const grant = app.state.credits;
  await sheet({
    title: 'Hazelnut Movi',
    body: [
      `All three Hazelnut 3.0 models, both modes, no deadline and no card. You `
        + `start with <b>${grant}</b> credits and they are not topped up until you subscribe.`,
      `<b>Simple</b> spends before it asks — that is what makes it simple — and `
        + `gives you ${RESTORE_WINDOW_MS / 60000} minutes to put the credits back.`,
      `<b>Advanced</b> quotes every ${MAX_CLIP_SECONDS}-second clip on the button before you press it.`,
    ],
    actions: [{ label: 'Start', value: true, primary: true }],
  });
  await bridge.markWelcomed();
  app.state = await bridge.getState();
}
