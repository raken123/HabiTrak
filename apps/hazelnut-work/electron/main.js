// Hazelnut Work — Electron main process.
//
// One window over www/, on the `hazelnut://` scheme.
//
// Nothing here connects to Google or Microsoft. There is no OAuth client and
// no token store, so `work:connect` writes an id into local state and reads no
// mail; `work:run` charges and writes a placeholder that says so in its own
// body. The disclosure the page prints across the top comes from here, so it
// cannot be edited out of the page alone.

import { app, BrowserWindow, ipcMain, shell, protocol, net, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Store } from '@hazelnut/core/store.js';
import { License, LICENSE_DEFAULTS } from '@hazelnut/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '@hazelnut/core/credits.js';
import { WORK_TRIAL_CREDIT_GRANT } from '@hazelnut/core/pricing.js';
import { TASKS, CONNECTORS, canRun, costOf } from '@hazelnut/core/work.js';
import { tierForNewAccount, quotaBytes } from '@hazelnut/core/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'Hazelnut Work';
const WWW_DIR = path.join(__dirname, '..', 'www');

const DISCLOSURE =
  'Nothing is connected. Hazelnut Work has no sign-in to Google or Microsoft '
  + 'yet, so Connect marks a service connected on this machine and reads no '
  + 'mail. Every draft below is a placeholder.';

protocol.registerSchemesAsPrivileged([{
  scheme: 'hazelnut',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

let win = null;
let store;
let license;
let credits;

function boot() {
  store = new Store({
    appName: APP_NAME,
    defaults: {
      ...LICENSE_DEFAULTS,
      ...CREDIT_DEFAULTS,
      product: 'work',
      connected: [],
      drafts: [],
      storageTier: null,
      usedBytes: 0,
    },
  });
  license = new License(store, { product: 'work' });
  credits = new Credits(store, { costOf: () => 0 });
  credits.grant('work-trial', WORK_TRIAL_CREDIT_GRANT, 'Work opening credits');
  if (!store.get('storageTier')) store.set('storageTier', tierForNewAccount({ taken: 0 }).id);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 780,
    minWidth: 780,
    minHeight: 560,
    backgroundColor: '#141210',
    show: false,
    title: APP_NAME,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL('hazelnut://work/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

nativeTheme.themeSource = 'dark';

app.whenReady().then(() => {
  boot();
  protocol.handle('hazelnut', async (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.normalize(path.join(WWW_DIR, rel));
    if (file !== WWW_DIR && !file.startsWith(WWW_DIR + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const handle = (channel, fn) => ipcMain.handle(channel, async (_event, ...args) => {
  try {
    return { ok: true, value: await fn(...args) };
  } catch (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }
});

const state = () => {
  const tier = store.get('storageTier', 'standard');
  return {
    product: 'work',
    edition: license.edition(),
    credits: credits.balance,
    connected: store.get('connected', []),
    disclosure: DISCLOSURE,
    storage: {
      tier,
      usedBytes: Number(store.get('usedBytes', 0)) || 0,
      quotaBytes: quotaBytes(tier).toString(),
    },
  };
};

function placeholderDraft(taskId, connectorId) {
  const task = TASKS[taskId];
  const conn = CONNECTORS[connectorId];
  return {
    id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    title: `${task.name} — ${conn.name}`,
    // The blurb is a sentence of its own; splicing it after "would" produced
    // "would sorts what arrived".
    body: 'This is a placeholder, not a result.\n\n'
      + `${task.name}: ${task.blurb}\n`
      + `It would read from ${conn.name} using: ${conn.scopes.join(', ')}.\n\n`
      + 'No mail was read, because Hazelnut Work is not connected to anything yet.',
    at: Date.now(),
    sent: false,
  };
}

handle('app:state', async () => state());

handle('work:connect', async (id) => {
  if (!CONNECTORS[id]) throw new Error('No such connection.');
  const connected = new Set(store.get('connected', []));
  connected.add(id);
  store.set('connected', [...connected]);
  return state();
});

handle('work:disconnect', async (id) => {
  store.set('connected', store.get('connected', []).filter((c) => c !== id));
  return state();
});

handle('work:run', async ({ taskId, connectorId }) => {
  const check = canRun(taskId, store.get('connected', []));
  if (!check.ok) {
    const err = new Error('That needs a connection first.');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  const cost = costOf(taskId);
  if (credits.balance < cost) {
    const err = new Error(`That costs ${cost} credits; you have ${credits.balance}.`);
    err.code = 'INSUFFICIENT_CREDITS';
    throw err;
  }
  const draft = placeholderDraft(taskId, connectorId || check.using);
  store.set('credits', credits.balance - cost);
  const ledger = store.get('ledger', []);
  ledger.push({
    type: 'spend', amount: -cost, note: `Work · ${TASKS[taskId].name}`,
    at: Date.now(), balanceAfter: credits.balance,
  });
  store.set('ledger', ledger.slice(-500));
  store.set('drafts', [...store.get('drafts', []), draft].slice(-100));
  return draft;
});

handle('work:drafts', async () => store.get('drafts', []));
handle('work:history', async (limit = 50) => credits.history(limit));
handle('shell:open-external', async (url) => { await shell.openExternal(url); return true; });
