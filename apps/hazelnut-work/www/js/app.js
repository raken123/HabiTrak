// Hazelnut Work.
//
// Two lists: what it may touch, and what it may do. The second is derived from
// the first — a task whose connector is missing says which ones would satisfy
// it rather than going mysteriously grey.
//
// The disclosure across the top is not decoration and must not be removed
// without removing the thing it discloses. Nothing is connected: there is no
// OAuth client behind this, so "Connect" marks a connector connected on this
// machine and reads nothing. An app that claims to be reading your mail, and
// is not, is lying about the most sensitive thing it could lie about.

import {
  CONNECTORS, CONNECTOR_ORDER, TASKS, TASK_ORDER, canRun, missingLine, costOf,
} from '../vendor/core/work.js';
import { storageLine, formatBytes } from '../vendor/core/storage.js';

const bridge = window.hazelnutWork;
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

const app = { state: null, drafts: [] };

const status = (text) => { $('status-text').textContent = text; };

function toast(text, ms = 3400) {
  const node = el('div', { class: 'toast', text });
  $('toasts').append(node);
  setTimeout(() => node.remove(), ms);
}

function sheet({ title, body, list, actions }) {
  return new Promise((resolve) => {
    const close = (v) => { $('sheets').replaceChildren(); resolve(v); };
    $('sheets').replaceChildren(el('div', { class: 'sheet' }, [
      el('h2', { text: title }),
      ...[].concat(body || []).map((line) => el('p', { html: line })),
      list ? el('ul', {}, list.map((item) => el('li', { text: item }))) : null,
      el('div', { class: 'sheet__actions' }, actions.map((a) => el('button', {
        class: a.primary ? 'btn btn--primary' : 'btn',
        text: a.label,
        onClick: () => close(a.value),
      }))),
    ]));
  });
}

function renderPills() {
  const { storage, credits } = app.state;
  $('storage-pill').textContent = storageLine(storage.usedBytes, storage.tier);
  $('storage-pill').title = `${formatBytes(storage.quotaBytes)} of storage`;
  $('credits-pill').textContent = `${credits} credits`;
}

function renderConnections() {
  const connected = app.state.connected;
  $('conns').replaceChildren(...CONNECTOR_ORDER.map((id) => {
    const conn = CONNECTORS[id];
    const on = connected.includes(id);
    return el('li', { class: `conn${on ? ' conn--on' : ''}` }, [
      el('div', {}, [
        el('b', { text: conn.name }),
        el('span', { text: `${conn.vendor} · ${conn.kind}` }),
      ]),
      el('button', {
        class: on ? 'btn' : 'btn btn--primary',
        text: on ? 'Disconnect' : 'Connect',
        onClick: () => (on ? disconnect(id) : connect(id)),
      }),
    ]);
  }));
}

function renderTasks() {
  const connected = app.state.connected;
  $('tasks').replaceChildren(...TASK_ORDER.map((id) => {
    const task = TASKS[id];
    const { ok } = canRun(id, connected);
    return el('li', { class: `task${ok ? '' : ' task--blocked'}` }, [
      el('div', {}, [
        el('b', { text: task.name }),
        el('span', { text: ok ? task.blurb : missingLine(id, connected) }),
      ]),
      el('div', {}, [
        el('button', {
          class: 'btn',
          text: 'Run',
          disabled: ok ? null : 'disabled',
          onClick: () => run(id),
        }),
        el('div', { class: 'task__cost', text: `${costOf(id)} credits` }),
      ]),
    ]);
  }));
}

function renderDrafts() {
  $('out-empty').hidden = app.drafts.length > 0;
  $('out-note').textContent = app.drafts.length
    ? `${app.drafts.length} · none of them sent`
    : '';
  $('drafts').replaceChildren(...[...app.drafts].reverse().map((draft) => el('li', {}, [
    el('div', { class: 'draft' }, [
      el('b', { text: draft.title }),
      el('p', { text: draft.body }),
      el('span', { class: 'draft__tag', text: 'Draft — not sent' }),
    ]),
  ])));
}

// ── actions ────────────────────────────────────────────────────────────────

async function connect(id) {
  const conn = CONNECTORS[id];
  const yes = await sheet({
    title: `Connect ${conn.name}?`,
    body: [
      `Hazelnut Work would ask ${conn.vendor} for:`,
    ],
    list: conn.scopes,
    actions: [
      { label: 'Cancel', value: false },
      { label: 'Connect', value: true, primary: true },
    ],
  });
  if (!yes) return;
  app.state = await bridge.connect(id);
  renderConnections();
  renderTasks();
  status(`${conn.name} connected on this machine. Nothing was read.`);
}

async function disconnect(id) {
  app.state = await bridge.disconnect(id);
  renderConnections();
  renderTasks();
  status(`${CONNECTORS[id].name} disconnected.`);
}

async function run(id) {
  const task = TASKS[id];
  const { ok, using } = canRun(id, app.state.connected);
  if (!ok) { toast(missingLine(id, app.state.connected)); return; }
  if (app.state.credits < costOf(id)) {
    toast(`${task.name} costs ${costOf(id)} credits; you have ${app.state.credits}.`);
    return;
  }
  status(`${task.name}…`);
  try {
    const draft = await bridge.run(id, using);
    app.state = await bridge.getState();
    app.drafts = await bridge.listDrafts();
    renderPills();
    renderDrafts();
    status('Written to drafts. Nothing was sent.');
  } catch (err) {
    toast(err.message || 'That did not work.');
    status('Nothing was charged.');
  }
}

// ── boot ───────────────────────────────────────────────────────────────────

(async function boot() {
  app.state = await bridge.getState();
  app.drafts = await bridge.listDrafts();

  $('disclosure').textContent = app.state.disclosure;
  renderPills();
  renderConnections();
  renderTasks();
  renderDrafts();
  status('Connect a mailbox to begin.');
})();
