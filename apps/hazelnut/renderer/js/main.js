// Hazelnut — the editor.
//
// This file owns the application object every tool is handed: the document,
// the viewport, the history and the small set of services a tool needs
// (quoting a price, gating on edition, reporting an error). Tools stay
// self-contained; this is the only place that knows about all of them.

import { $, $$, el, on, clamp, loadImage } from './dom.js';
import { icon } from './icons.js';
import { Doc } from './doc.js';
import { History } from './history.js';
import { Viewport } from './viewport.js';
import { createTools } from './tools/index.js';
import { Clip, attachClip } from './clip.js';
import { installTransport } from './transport.js';
import {
  toast, toastError, modal, confirmDialog, openMenu, attachTooltip,
  toolGuide, costLabel, hideTooltip,
} from './ui.js';

const SWATCHES = [
  '#000000', '#ffffff', '#e8622c', '#e0894a', '#f2c14e', '#6bbf72',
  '#3d9dd6', '#3d6fd6', '#8b5cf6', '#e05a8f', '#8a5a3b', '#7a7a7a',
  '#b4642f', '#2f6f4f', '#1f3a5f', '#d94f4f',
];

/** Whichever product this build is. The dialogs read it rather than assume. */
const productName = () => (app.isVideo ? 'Hazelnut Squirreal' : 'Hazelnut');
const freeName = () => (app.server?.edition === 'web' ? 'Hazelnut for the Web'
  : app.isVideo ? 'Squirreal Free' : 'Hazelnut Free');

const app = {
  doc: null,
  history: null,
  viewport: null,
  tools: createTools(),
  currentToolId: 'draw',
  state: { color: '#e8622c', brushSize: 24 },
  server: null,          // the last state we got from the main process
  docListeners: [],
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  app.server = await window.hazelnut.getState();
  document.body.classList.toggle('is-mac', app.server.platform === 'darwin');

  app.viewport = new Viewport($('#viewport'), $('#stage'));

  // Squirreal is this same editor pointed at clips. The tools, their prices and
  // their help all arrive from the bridge, so the only thing the page adds is a
  // playhead — and its own name.
  app.isVideo = app.server.product === 'squirreal';
  if (app.isVideo) {
    document.body.classList.add('is-squirreal');
    $('.menubar__brand span').textContent = 'Squirreal';
    document.title = 'Hazelnut Squirreal';
    app.transport = installTransport(app);
  }

  buildToolbar();
  buildSwatches();
  wireMenus();
  wirePanels();
  wireStage();
  wireKeyboard();
  wireDragAndDrop();

  window.hazelnut.onMenuCommand(runCommand);

  refreshChrome();
  selectTool('draw');

  if (app.server.edition === 'web') {
    await showWebWelcome();
  } else if (!app.server.trialStarted) {
    await showWelcome();
  } else if (app.server.edition === 'free' && app.server.trialUsed) {
    toast(freeName(), `Your trial has finished. The ${localCount()} tools that run on your machine keep working — the ones that need a model need a licence.`,
      { timeout: 9000 });
  }
  if (app.server.ai && !app.server.apiKeyConfigured) {
    toast('No API key yet', 'The AI tools need a Gemini key. Open Settings to add one.', {
      timeout: 12000,
      actions: [{ label: 'Settings', primary: true, onClick: showSettings }],
    });
  }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function buildToolbar() {
  const host = $('#toolbar');
  host.replaceChildren();
  let group = null;
  for (const tool of app.server.tools) {
    // A hairline between groups: paint, repair, adjust, motion, canvas, inspect.
    if (group !== null && tool.group !== group) host.append(el('div', { class: 'toolbar__sep' }));
    group = tool.group;
    const locked = !editionAllows(tool);
    const button = el('button', {
      class: `tool${locked ? ' is-locked' : ''}`,
      dataset: { tool: tool.id },
      onClick: () => selectTool(tool.id),
      'aria-label': tool.name,
      html: icon(tool.icon),
    });
    const price = priceBadge(tool);
    if (price) button.append(el('span', { class: 'price', text: price }));
    attachTooltip(button, () => tooltipFor(tool));
    host.append(button);
  }
}

function priceBadge(tool) {
  if (tool.id === 'aiscope') return '15';
  if (!tool.ai) return null;
  return typeof tool.cost === 'number' ? String(tool.cost) : `${tool.cost.min}+`;
}

function tooltipFor(tool) {
  const locked = !editionAllows(tool);
  return `<strong>${tool.name} <em>${tool.shortcut}</em></strong>${tool.tagline}
    <p>${costLabel(tool)}${locked ? ` — locked on ${freeName()}` : ''}</p>`;
}

function editionAllows(tool) {
  // AIScope is never fully locked: the zoom works on every edition.
  if (!tool.ai || tool.id === 'aiscope') return true;
  return app.server.ai;
}

function selectTool(id) {
  const tool = app.tools[id];
  if (!tool) return;
  const meta = app.server.tools.find((t) => t.id === id);

  if (meta && !editionAllows(meta)) {
    showUpgrade(meta);
    return;
  }

  app.tools[app.currentToolId]?.onDeactivate?.(app);
  app.currentToolId = id;
  $('#app').dataset.tool = id;
  $$('.tool').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tool === id));
  $('#status-hint').textContent = tool.hint || '';

  const bar = $('#optionsbar');
  bar.replaceChildren(el('div', { class: 'optionsbar__title', html: `${icon(meta?.icon || 'brush')}<span>${meta?.name || id}</span>` }));
  if (app.doc) {
    for (const node of [].concat(tool.options?.(app) || [])) bar.append(node);
    tool.onActivate?.(app);
  } else {
    bar.append(el('span', { class: 'field', text: 'Open an image or start a new canvas to use this tool.' }));
  }
  // Tools draw their own overlays — Realtouch's mask, Expand's handles — and
  // the viewport keeps the last frame it painted. Without this, switching away
  // leaves the previous tool's overlay on screen until something else happens
  // to trigger a redraw.
  app.viewport?.render();
  hideTooltip();
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

const MENUS = {
  file: () => [
    { label: 'New Canvas…', shortcut: mod('N'), onClick: () => runCommand('file:new') },
    {
      label: app.isVideo ? 'Open Frame or Clip…' : 'Open Image…',
      shortcut: mod('O'),
      onClick: () => runCommand('file:open'),
    },
    '-',
    {
      label: app.isVideo ? 'Save Frame As…' : 'Save As…',
      shortcut: mod('S'),
      disabled: !app.doc,
      onClick: () => runCommand('file:save'),
    },
    ...(app.isVideo ? [{
      label: 'Export Clip as GIF…',
      disabled: !app.doc?.clip,
      onClick: () => runCommand('file:export-gif'),
    }] : []),
  ],
  edit: () => [
    { label: 'Undo', shortcut: mod('Z'), disabled: !app.history?.canUndo, onClick: () => runCommand('edit:undo') },
    { label: 'Redo', shortcut: mod('⇧Z'), disabled: !app.history?.canRedo, onClick: () => runCommand('edit:redo') },
  ],
  image: () => [
    { label: 'Expand Canvas…', shortcut: mod('E'), disabled: !app.doc, onClick: () => runCommand('tool:expand') },
    '-',
    { label: 'Fit on Screen', shortcut: mod('0'), disabled: !app.doc, onClick: () => runCommand('view:fit') },
    { label: 'Actual Pixels', shortcut: mod('1'), disabled: !app.doc, onClick: () => runCommand('view:100') },
  ],
  layer: () => [
    { label: 'New Layer', shortcut: mod('⇧N'), disabled: !app.doc, onClick: () => runCommand('layer:new') },
    { label: 'Duplicate Layer', shortcut: mod('J'), disabled: !app.doc, onClick: () => runCommand('layer:duplicate') },
    { label: 'Delete Layer', disabled: !app.doc, onClick: () => runCommand('layer:delete') },
    '-',
    { label: 'Flatten Image', disabled: !app.doc, onClick: () => runCommand('layer:flatten') },
  ],
  tools: () => app.server.tools.map((tool) => ({
    label: tool.name,
    shortcut: tool.shortcut,
    onClick: () => selectTool(tool.id),
  })),
  help: () => [
    { label: 'Tool Guide', onClick: showGuide },
    { label: 'Plans & Credits', onClick: showPlans },
    { label: 'Settings…', onClick: showSettings },
    '-',
    { label: app.isVideo ? 'About Squirreal' : 'About Hazelnut', onClick: showAbout },
  ],
};

const mod = (key) => (app.server?.platform === 'darwin' ? `⌘${key}` : `Ctrl+${key}`);

function wireMenus() {
  for (const button of $$('#app-menus .menu')) {
    on(button, 'click', () => openMenu(button, MENUS[button.dataset.menu]()));
  }
  on($('#edition-pill'), 'click', showPlans);
  on($('#credits-pill'), 'click', showPlans);
  for (const button of $$('[data-command]')) {
    on(button, 'click', () => runCommand(button.dataset.command));
  }
}

async function runCommand(id) {
  if (id.startsWith('select:')) return selectTool(id.slice(7));
  switch (id) {
    case 'file:new': return newCanvas();
    case 'file:open': return openFile();
    case 'file:save': return saveFile();
    case 'file:export-gif': return selectTool('gif-animate');
    case 'edit:undo': app.history?.undo(); return refreshAfterEdit();
    case 'edit:redo': app.history?.redo(); return refreshAfterEdit();
    case 'tool:expand': return selectTool('expand');
    case 'view:fit': app.viewport.fit(); return updateStatus();
    case 'view:100': app.viewport.setScale(1); return updateStatus();
    case 'layer:new': requireDoc(() => { app.doc.addLayer(`Layer ${app.doc.layers.length + 1}`); app.history.push('New layer', 'layers'); }); return;
    case 'layer:duplicate': requireDoc(() => { app.doc.duplicateLayer(); app.history.push('Duplicate layer', 'layers'); }); return;
    case 'layer:delete': return deleteLayer();
    case 'layer:flatten': requireDoc(() => { app.doc.flatten(); app.history.push('Flatten', 'layers'); }); return;
    case 'settings': return showSettings();
    case 'plans': return showPlans();
    case 'help': return showGuide();
    case 'about': return showAbout();
    default: return undefined;
  }
}

function requireDoc(fn) {
  if (!app.doc) {
    toast('Nothing open', 'Open an image or start a new canvas first.', { kind: 'error' });
    return;
  }
  fn();
}

// ---------------------------------------------------------------------------
// Document lifecycle
// ---------------------------------------------------------------------------

function setDocument(doc) {
  app.doc = doc;
  app.history = new History(doc);
  app.viewport.setDocument(doc);
  $('#app').classList.add('has-document');

  on(doc, 'change', () => {
    // The viewport must keep up with every stroke; the panels must not. Each
    // layer row re-encodes a PNG thumbnail, so rebuilding them on every pointer
    // move would make painting stutter.
    app.viewport.render();
    schedulePanelRefresh();
    for (const fn of app.docListeners) fn();
    app.tools[app.currentToolId]?.onDocChange?.(app);
  });
  on(app.history, 'change', () => { renderHistory(); renderLayers(); app.viewport.render(); });

  renderLayers();
  renderHistory();
  updateStatus();
  app.transport?.render();
  selectTool(app.currentToolId);
}

/**
 * Put a clip in the editor. The frames may arrive already decoded — which is
 * what the engine does when it has them — or as a video to be decoded here.
 */
app.openClip = async (result, { name = 'Clip' } = {}) => {
  const clip = result.frames
    ? await Clip.fromFrames(result.frames, { fps: result.fps || 24 })
    : await Clip.fromVideo(result.clip, { fps: result.fps || 24 });

  const first = clip.frame(0);
  const doc = new Doc(first.width, first.height, { name });
  doc.addLayer('Background');
  // Attached before the document goes live: a tool that re-quotes when the
  // document changes has to be able to see how long the clip is.
  attachClip(doc, clip);
  setDocument(doc);
  app.transport?.render();
  return clip;
};

async function newCanvas() {
  const result = await modal({
    title: 'New canvas',
    body: el('div', {}, [
      el('label', { class: 'stack' }, [el('span', { text: 'Width' }), el('input', { type: 'number', id: 'nw', value: 1280, min: 1, max: 12000 })]),
      el('label', { class: 'stack' }, [el('span', { text: 'Height' }), el('input', { type: 'number', id: 'nh', value: 800, min: 1, max: 12000 })]),
    ]),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(null), text: 'Cancel' }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Create',
        onClick: () => close({ width: +$('#nw').value || 1280, height: +$('#nh').value || 800 }),
      }),
    ],
  });
  if (!result) return;
  setDocument(Doc.blank(clamp(result.width, 1, 12000), clamp(result.height, 1, 12000)));
}

async function openFile() {
  try {
    const file = await window.hazelnut.openImage();
    if (!file) return;
    // Squirreal can be handed a clip rather than a frame; it arrives under its
    // own key and is decoded into frames before anything is drawn.
    if (file.clip) {
      const clip = await app.openClip({ clip: file.clip, fps: 24 }, { name: file.name });
      toast('Opened', `${file.name} — ${clip.length} frames · ${clip.seconds.toFixed(1)}s`, { timeout: 3000 });
      return;
    }
    await openDataUrl(file.dataUrl, file.name);
  } catch (err) {
    toastError(err, 'That file could not be opened.');
  }
}

async function openDataUrl(dataUrl, name = 'Image') {
  const img = await loadImage(dataUrl);
  setDocument(await Doc.fromImage(img, name));
  toast('Opened', `${name} — ${img.naturalWidth} × ${img.naturalHeight}`, { timeout: 3000 });
}

async function saveFile() {
  if (!app.doc) return;
  try {
    const saved = await window.hazelnut.saveImage(app.doc.toDataURL('image/png'), `${app.doc.name.replace(/\.[^.]+$/, '')}.png`);
    if (saved) toast('Saved', saved.path, { kind: 'good' });
  } catch (err) {
    toastError(err, 'That file could not be saved.');
  }
}

async function deleteLayer() {
  if (!app.doc) return;
  if (app.doc.layers.length <= 1) {
    toast('Layers', 'A document needs at least one layer.', { kind: 'error' });
    return;
  }
  if (!(await confirmDialog({
    title: 'Delete layer',
    message: `Delete “${app.doc.active.name}”? This can be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  }))) return;
  app.doc.removeLayer();
  app.history.push('Delete layer', 'layers');
}

function refreshAfterEdit() {
  app.viewport.render();
  renderLayers();
  updateStatus();
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function wirePanels() {
  on($('#layer-opacity'), 'input', (event) => {
    if (!app.doc?.active) return;
    app.doc.active.opacity = +event.target.value / 100;
    $('#layer-opacity-value').textContent = `${event.target.value}%`;
    app.doc.touch();
  });
  on($('#layer-opacity'), 'change', () => app.history?.push('Layer opacity', 'layers'));
  on($('#color-input'), 'input', (event) => setColor(event.target.value));
  on($('#status-zoom'), 'click', () => app.viewport?.fit());
  on(app.viewport, 'change', updateStatus);
}

function buildSwatches() {
  $('#swatches').replaceChildren(...SWATCHES.map((colour) => el('button', {
    class: 'swatch',
    style: `background:${colour}`,
    title: colour,
    onClick: () => { $('#color-input').value = colour; setColor(colour); },
  })));
}

function setColor(colour) {
  app.state.color = colour;
  app.tools[app.currentToolId]?.brush?.set({ color: colour });
}

// Panel refreshes are coalesced into the next frame, and thumbnails are only
// re-encoded when they have had time to go stale.
let panelRefreshQueued = false;
const THUMB_MAX_AGE_MS = 700;
const thumbCache = new Map();

function schedulePanelRefresh() {
  if (panelRefreshQueued) return;
  panelRefreshQueued = true;
  requestAnimationFrame(() => {
    panelRefreshQueued = false;
    renderLayers();
    updateStatus();
  });
}

function thumbnailFor(layer) {
  const cached = thumbCache.get(layer.id);
  if (cached && performance.now() - cached.at < THUMB_MAX_AGE_MS) return cached.url;
  const url = layer.thumbnail();
  thumbCache.set(layer.id, { url, at: performance.now() });
  return url;
}

function renderLayers() {
  const host = $('#layerlist');
  if (!app.doc) { host.replaceChildren(); thumbCache.clear(); return; }

  // Forget layers that no longer exist, so the cache cannot grow without bound.
  const live = new Set(app.doc.layers.map((l) => l.id));
  for (const id of thumbCache.keys()) if (!live.has(id)) thumbCache.delete(id);

  // Top of the stack reads top of the list, as it does in every editor.
  const rows = [...app.doc.layers].reverse().map((layer) => el('li', {
    class: `layer${layer.id === app.doc.activeId ? ' is-active' : ''}${layer.visible ? '' : ' is-hidden'}`,
    onClick: () => { app.doc.activeId = layer.id; app.doc.touch(); },
  }, [
    el('button', {
      class: 'layer__eye',
      title: layer.visible ? 'Hide layer' : 'Show layer',
      html: icon(layer.visible ? 'eye' : 'eyeOff'),
      onClick: (event) => {
        event.stopPropagation();
        layer.visible = !layer.visible;
        app.doc.touch();
      },
    }),
    el('img', { class: 'layer__thumb', src: thumbnailFor(layer), alt: '' }),
    el('div', { class: 'layer__name' }, [
      layer.name,
      layer.opacity < 1 ? el('em', { text: `${Math.round(layer.opacity * 100)}%` }) : null,
    ]),
  ]));
  host.replaceChildren(...rows);

  const active = app.doc.active;
  if (active) {
    $('#layer-opacity').value = Math.round(active.opacity * 100);
    $('#layer-opacity-value').textContent = `${Math.round(active.opacity * 100)}%`;
  }
}

function renderHistory() {
  const host = $('#historylist');
  if (!app.history) { host.replaceChildren(); return; }
  host.replaceChildren(...app.history.entries.map((entry, index) => el('li', {
    class: `${index === app.history.index ? 'is-current' : ''}${index > app.history.index ? ' is-undone' : ''}`,
    onClick: () => { app.history.goto(index); refreshAfterEdit(); },
    html: icon(entry.icon),
  }, [el('span', { text: entry.label })])));
  host.lastElementChild?.scrollIntoView({ block: 'nearest' });
}

function updateStatus() {
  if (!app.doc) {
    $('#status-size').textContent = '—';
    $('#status-zoom').textContent = '100%';
    return;
  }
  $('#status-size').textContent = `${app.doc.width} × ${app.doc.height}`;
  $('#status-zoom').textContent = `${(app.viewport.scale * 100).toFixed(app.viewport.scale < 0.1 ? 1 : 0)}%`;
}

function refreshChrome() {
  const { edition, plan, credits, trialDaysLeft } = app.server;
  const pill = $('#edition-pill');
  pill.dataset.edition = edition;
  pill.textContent = edition === 'trial'
    ? `Trial · ${trialDaysLeft}d left`
    : plan.name;

  $('#credits-value').textContent = credits.toLocaleString('en-US');
  $('#credits-pill').classList.toggle('is-low', app.server.ai && credits < 60);
  $('#credits-pill').hidden = !app.server.ai;
  buildToolbar();
  $$('.tool').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tool === app.currentToolId));
}

// ---------------------------------------------------------------------------
// Stage input
// ---------------------------------------------------------------------------

function wireStage() {
  const stage = $('#stage');
  let panning = null;
  let spaceDown = false;

  on(window, 'keydown', (e) => { if (e.code === 'Space') { spaceDown = true; $('#app').classList.add('is-panning'); } });
  on(window, 'keyup', (e) => { if (e.code === 'Space') { spaceDown = false; $('#app').classList.remove('is-panning'); } });

  on(stage, 'pointerdown', (event) => {
    if (!app.doc) return;
    stage.setPointerCapture(event.pointerId);
    // Space-drag or middle button pans, exactly as it does in Photoshop.
    if (spaceDown || event.button === 1) {
      panning = { x: event.clientX, y: event.clientY };
      return;
    }
    app.tools[app.currentToolId]?.onPointerDown?.(app, event, app.viewport.pointer(event));
  });

  on(stage, 'pointermove', (event) => {
    if (!app.doc) return;
    if (panning) {
      app.viewport.panBy(event.clientX - panning.x, event.clientY - panning.y);
      panning = { x: event.clientX, y: event.clientY };
      return;
    }
    app.tools[app.currentToolId]?.onPointerMove?.(app, event, app.viewport.pointer(event));
  });

  const endPointer = (event) => {
    if (!app.doc) return;
    if (panning) { panning = null; return; }
    app.tools[app.currentToolId]?.onPointerUp?.(app, event, app.viewport.pointer(event));
  };
  on(stage, 'pointerup', endPointer);
  on(stage, 'pointercancel', endPointer);
  on(stage, 'pointerleave', endPointer);

  on(stage, 'wheel', (event) => {
    if (!app.doc) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (event.ctrlKey || event.metaKey || !event.shiftKey) {
      app.viewport.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, anchor);
      updateStatus();
    } else {
      app.viewport.panBy(-event.deltaX, -event.deltaY);
    }
  }, { passive: false });
}

function wireKeyboard() {
  const shortcuts = Object.fromEntries(app.server.tools.map((t) => [t.shortcut.toLowerCase(), t.id]));

  on(window, 'keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) app.history?.redo(); else app.history?.undo();
      refreshAfterEdit();
      return;
    }
    if (typing) return;

    if (meta) {
      const map = { s: 'file:save', o: 'file:open', n: event.shiftKey ? 'layer:new' : 'file:new', e: 'tool:expand', j: 'layer:duplicate', 0: 'view:fit', 1: 'view:100' };
      const command = map[event.key.toLowerCase()];
      if (command) { event.preventDefault(); runCommand(command); }
      return;
    }

    // Squirreal: Space plays and pauses, as the transport's own tooltip says.
    if (event.key === ' ' && app.transport && app.doc?.clip) {
      event.preventDefault();
      if (app.transport.playing) app.transport.pause(); else app.transport.play();
      return;
    }

    const brush = app.tools[app.currentToolId]?.brush;
    if (event.key === '[' || event.key === ']') {
      if (!brush) return;
      const next = clamp(Math.round(brush.size * (event.key === '[' ? 0.8 : 1.25)), 1, 400);
      brush.set({ size: next });
      app.setBrushSize(next);
      return;
    }
    const toolId = shortcuts[event.key.toLowerCase()];
    if (toolId) selectTool(toolId);
  });
}

function wireDragAndDrop() {
  on(window, 'dragover', (event) => event.preventDefault());
  on(window, 'drop', async (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    const isClip = app.isVideo && file?.type.startsWith('video/');
    if (!file || !(isClip || file.type.startsWith('image/'))) return;
    const reader = new FileReader();
    reader.onload = () => (isClip
      ? app.openClip({ clip: reader.result, fps: 24 }, { name: file.name })
      : openDataUrl(reader.result, file.name)).catch((err) => toastError(err));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Services the tools use
// ---------------------------------------------------------------------------

app.render = () => app.viewport.render();

// Rebuild the options bar for the current tool. Tools that own their own state
// (an adjustment that has just been applied, say) call this to make the bar
// agree with it again.
app.refreshOptions = () => selectTool(app.currentToolId);

app.onDocChange = (fn) => { app.docListeners.push(fn); return () => { app.docListeners = app.docListeners.filter((f) => f !== fn); }; };

app.setBrushSize = (size) => {
  app.state.brushSize = size;
  const slider = document.getElementById('brush-size');
  const value = document.getElementById('brush-size-value');
  if (slider) slider.value = size;
  if (value) value.textContent = String(size);
};

app.quote = (toolId, params) => window.hazelnut.quote(toolId, params);

app.setCredits = async (balance) => {
  app.server.credits = balance;
  refreshChrome();
  // Re-read the whole state occasionally so trial countdowns stay honest.
  app.server = { ...app.server, ...(await window.hazelnut.getState()) };
  refreshChrome();
};

/**
 * The single check every paid tool runs before it does anything: is this
 * edition allowed to, and are there enough credits? Both failures explain
 * themselves and offer the way out.
 */
app.gate = async (toolId, quote) => {
  if (!quote.allowed) {
    showUpgrade(app.server.tools.find((t) => t.id === toolId), quote.message);
    return false;
  }
  if (!app.server.apiKeyConfigured) {
    toast('No API key', 'Add a Gemini API key in Settings before running an AI tool.', {
      kind: 'error',
      actions: [{ label: 'Settings', primary: true, onClick: showSettings }],
    });
    return false;
  }
  if (!quote.affordable) {
    toast('Not enough credits', `This needs ${quote.cost} and you have ${quote.balance}.`, {
      kind: 'error',
      actions: [{ label: 'Plans', primary: true, onClick: showPlans }],
    });
    return false;
  }
  return true;
};

app.reportToolError = (err) => {
  if (err?.code === 'TOOL_LOCKED') return showUpgrade(null, err.message);
  if (err?.code === 'INSUFFICIENT_CREDITS') {
    return toast('Not enough credits', err.message, {
      kind: 'error',
      actions: [{ label: 'Plans', primary: true, onClick: showPlans }],
    });
  }
  if (err?.code === 'NO_API_KEY') {
    return toast('No API key', err.message, {
      kind: 'error',
      actions: [{ label: 'Settings', primary: true, onClick: showSettings }],
    });
  }
  if (err?.name === 'AbortError' || /abort/i.test(err?.message || '')) {
    return toast('Cancelled', 'Nothing was charged.', { timeout: 3000 });
  }
  return toastError(err);
};

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

/** How many of the tools in this build never call a model. */
function localCount() {
  return (app.server.tools || []).filter((t) => !t.ai).length;
}

/**
 * The browser build's welcome. There is no trial to start and no key to add,
 * so it says what is here, what is not, and where the rest lives.
 */
async function showWebWelcome() {
  const total = (app.server.tools || []).length;
  const paid = total - localCount();
  const go = await modal({
    title: 'Hazelnut, in a browser tab',
    wide: true,
    body: el('div', {}, [
      el('p', { text: `This is the full editor with half its toolbox: the ${localCount()} tools that run on your machine work, and the ${paid} that need a model are locked.` }),
      el('p', { text: 'Nothing is uploaded, nothing is charged, and there is no account and no key. The picture you open never leaves this page.' }),
      el('p', { class: 'note', text: 'Magic Draw, Realtouch, Erase, Restore, Colourise, Background, Sky, Upscale, GIF Animate and AIScope Learn are in the desktop app.' }),
      toolGuide(app.server.tools),
    ]),
    footer: (close) => [
      el('button', { class: 'btn btn--primary', onClick: () => close(false), text: 'Start editing' }),
      el('button', { class: 'btn', onClick: () => close(true), text: 'Get the desktop app' }),
    ],
  });
  // The download page sits beside this build in the same directory tree, so
  // the link is relative — there is no invented address here.
  if (go === true) window.hazelnut.openExternal(new URL('../Hazelnut-downloads.html', location.href).href);
}

async function showWelcome() {
  const start = await modal({
    title: `Welcome to ${productName()}`,
    wide: true,
    body: el('div', {}, [
      el('p', { text: `Every tool is unlocked for ${app.server.trialDays} days, with ${app.server.trialCreditGrant.toLocaleString('en-US')} AI credits to spend. No card, no account.` }),
      el('p', { text: `When the trial ends ${productName()} does not stop working — it becomes ${freeName()}: the same editor, with the ${localCount()} tools that run on your machine, minus anything that needs a model.` }),
      toolGuide(app.server.tools),
    ]),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(false), text: 'Not yet' }),
      el('button', { class: 'btn btn--primary', onClick: () => close(true), text: `Start the ${app.server.trialDays}-day trial` }),
    ],
  });
  if (start !== true) return;
  try {
    const status = await window.hazelnut.startTrial();
    app.server = { ...app.server, ...(await window.hazelnut.getState()) };
    refreshChrome();
    toast('Trial started', `${status.trialDaysLeft} days, ${app.server.credits.toLocaleString('en-US')} credits.`, { kind: 'good' });
  } catch (err) {
    toastError(err);
  }
}

function showGuide() {
  modal({
    title: 'Tool guide',
    wide: true,
    body: toolGuide(app.server.tools),
    footer: (close) => [el('button', { class: 'btn btn--primary', onClick: () => close(), text: 'Close' })],
  });
}

function showUpgrade(tool, message) {
  modal({
    title: tool ? `${tool.name} needs the AI` : 'This tool needs the AI',
    body: el('div', {}, [
      el('p', { text: message || `${freeName()} runs everything that works locally. ${tool ? tool.name : 'This tool'} needs a model, so it is part of the paid app.` }),
      el('div', {
        class: 'note',
        text: `The ${localCount()} tools that run on your machine — drawing, cropping, straightening, `
          + 'levels, colour, sharpening, denoising, vignetting, text, expanding and the AIScope zoom — '
          + `stay available on ${freeName()}, forever, at no cost.`,
      }),
    ]),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(), text: 'Close' }),
      el('button', { class: 'btn btn--primary', onClick: () => { close(); showPlans(); }, text: 'See plans' }),
    ],
  });
}

function showPlans() {
  const plans = ['hazelnut-free', 'hazelnut-pro', 'mini-pro'].map((id) => app.server.plans[id]);
  const current = app.server.plan.id;

  modal({
    title: 'Plans & credits',
    wide: true,
    body: el('div', {}, [
      el('p', { text: `You are on ${app.server.plan.name}${app.server.edition === 'trial' ? ` — ${app.server.trialDaysLeft} days left` : ''}. Balance: ${app.server.credits.toLocaleString('en-US')} credits.` }),
      el('div', { class: 'plans' }, plans.map((plan) => el('div', { class: `plan${plan.id === current ? ' is-current' : ''}` }, [
        plan.id === current ? el('span', { class: 'plan__tag', text: 'Current' }) : null,
        el('h4', { text: plan.name }),
        el('div', { class: 'price' }, [
          plan.monthlyUsd === 0 ? 'Free' : `$${plan.monthlyUsd.toFixed(2)}`,
          plan.monthlyUsd === 0 ? null : el('small', { text: ' / month' }),
        ]),
        el('p', { text: plan.blurb }),
        el('ul', {}, [
          el('li', { text: plan.ai ? `${plan.credits.toLocaleString('en-US')} credits a month` : 'No AI, no credits' }),
          el('li', { text: plan.product === 'mini' ? 'Windows, Mac and Android' : 'Windows and Mac' }),
          el('li', { text: plan.product === 'mini' ? 'Chat bar, removal only' : 'The full editor' }),
        ]),
      ]))),
      el('h4', { text: 'What each tool costs' }),
      el('ul', {}, app.server.tools.map((tool) => el('li', { text: `${tool.name} — ${costLabel(tool)}` }))),
      el('h4', { text: 'Recent activity' }),
      app.server.ledger?.length
        ? el('ul', {}, app.server.ledger.slice(0, 8).map((entry) => el('li', {
            text: `${entry.amount > 0 ? '+' : ''}${entry.amount} · ${entry.note} · ${new Date(entry.at).toLocaleString()}`,
          })))
        : el('p', { text: 'Nothing spent yet.' }),
    ]),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(), text: 'Close' }),
      app.server.licensed
        ? el('button', {
            class: 'btn btn--danger',
            text: 'Remove licence',
            onClick: async () => { await window.hazelnut.deactivate(); app.server = await window.hazelnut.getState(); refreshChrome(); close(); },
          })
        : el('button', { class: 'btn btn--primary', onClick: () => { close(); showActivate(); }, text: 'Enter a licence key' }),
    ],
  });
}

function showActivate() {
  modal({
    title: 'Activate Hazelnut',
    body: el('div', {}, [
      el('p', { text: 'Enter the licence key from your purchase confirmation.' }),
      el('label', { class: 'stack' }, [
        el('span', { text: 'Licence key' }),
        el('input', { type: 'text', id: 'license-key', placeholder: 'HZL-XXXXX-XXXXX-XXXXX-XXXXX', autocomplete: 'off', spellcheck: 'false' }),
      ]),
    ]),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(), text: 'Cancel' }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Activate',
        onClick: async () => {
          try {
            const result = await window.hazelnut.activate($('#license-key').value);
            if (!result.ok) { toast('Activation', result.error, { kind: 'error' }); return; }
            app.server = await window.hazelnut.getState();
            refreshChrome();
            close();
            toast('Activated', `You are on ${app.server.plan.name}.`, { kind: 'good' });
          } catch (err) {
            toastError(err);
          }
        },
      }),
    ],
  });
}

function showSettings() {
  modal({
    title: 'Settings',
    wide: true,
    body: el('div', {}, [
      el('h4', { text: 'AI' }),
      el('p', { text: `${productName()} talks to Gemini with your own API key. It is stored on this machine only and is never sent anywhere but Google.` }),
      el('label', { class: 'stack' }, [
        el('span', { text: 'Gemini API key' }),
        el('input', {
          type: 'password', id: 'api-key', autocomplete: 'off', spellcheck: 'false',
          placeholder: app.server.apiKeyConfigured ? '•••••••••• (configured)' : 'Paste your key',
        }),
      ]),
      el('p', {
        class: app.server.apiKeyConfigured ? 'note' : 'note note--warn',
        text: app.server.apiKeyConfigured
          ? `A key is configured (from ${app.server.apiKeySource}). Paste a new one to replace it.`
          : 'No key configured yet. Draw, Expand and the AIScope zoom work without one; every other tool needs it.',
      }),
      el('p', {}, [
        'Get a key at ',
        el('a', {
          href: '#',
          text: 'aistudio.google.com/apikey',
          onClick: (e) => { e.preventDefault(); window.hazelnut.openExternal('https://aistudio.google.com/apikey'); },
        }),
        '.',
      ]),
      el('div', { class: 'note note--warn', text: 'Treat a key like a password. If one has ever been pasted into a chat, an issue tracker or a commit, revoke it and generate a new one.' }),
    ]),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(), text: 'Close' }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Save key',
        onClick: async () => {
          const key = $('#api-key').value.trim();
          if (!key) { close(); return; }
          try {
            await window.hazelnut.saveApiKey(key);
            app.server = await window.hazelnut.getState();
            refreshChrome();
            close();
            toast('Settings', 'API key saved.', { kind: 'good' });
          } catch (err) {
            toastError(err);
          }
        },
      }),
    ],
  });
}

function showAbout() {
  modal({
    title: `About ${productName()}`,
    body: el('div', {}, [
      el('p', { text: app.isVideo
        ? `Hazelnut Squirreal ${app.server.version} — Hazelnut, for moving pictures. Windows and Mac.`
        : `Hazelnut ${app.server.version} — an advanced AI photo generator for Windows and Mac.` }),
      el('p', { text: `You are on ${app.server.plan.name}.` }),
      el('p', { text: 'Images are sent to Google\'s Gemini API when an AI tool runs, and nowhere else. Draw and Expand never leave this machine.' }),
    ]),
    footer: (close) => [el('button', { class: 'btn btn--primary', onClick: () => close(), text: 'Close' })],
  });
}

boot().catch((err) => {
  const pre = document.createElement('pre');
  pre.style.cssText = 'padding:24px;color:#e05a5a;font:12px ui-monospace,monospace;white-space:pre-wrap';
  pre.textContent = `Hazelnut failed to start:\n\n${err?.stack || err}`;
  document.body.replaceChildren(pre);
});
