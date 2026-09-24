// Hazelnut Movi — Electron main process.
//
// One window over www/, served on the `hazelnut://` scheme so the page keeps a
// real origin and a real CSP rather than file://.
//
// Everything about the money is here rather than in the page, for the same
// reason it is in Mini: the page is the part a determined person edits. The
// order Simple charges in, the restore window and the refusal to restore
// twice are all enforced on this side.
//
// There are no Hazelnut 3.0 servers, so no render happens. What this process
// does is real bookkeeping over an imaginary render, and `pending: true` is
// how the page knows to say so.

import { app, BrowserWindow, ipcMain, shell, protocol, net, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Store } from '@hazelnut/core/store.js';
import { License, LICENSE_DEFAULTS } from '@hazelnut/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '@hazelnut/core/credits.js';
import { MOVI_TRIAL_CREDIT_GRANT } from '@hazelnut/core/pricing.js';
import {
  costOfSeconds, costOfClip, costOfExtension, restorable, restoreRefusal,
  MAX_CLIP_SECONDS,
} from '@hazelnut/core/movi.js';
import { tierForNewAccount, quotaBytes } from '@hazelnut/core/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'Hazelnut Movi';
const WWW_DIR = path.join(__dirname, '..', 'www');

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
      product: 'movi',
      welcomed: false,
      renders: [],
      clips: [],
      storageTier: null,
      usedBytes: 0,
    },
  });
  license = new License(store, { product: 'movi' });
  credits = new Credits(store, { costOf: () => 0 });
  credits.grant('movi-trial', MOVI_TRIAL_CREDIT_GRANT, 'Movi opening credits');
  if (!store.get('storageTier')) {
    // A real sign-up would have the server decide, since only it knows how
    // many founder places have gone. This client can speak only for itself.
    store.set('storageTier', tierForNewAccount({ taken: 0 }).id);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
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
  win.loadURL('hazelnut://movi/index.html');
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

// ---------------------------------------------------------------------------
// IPC — the same envelope the other apps use
// ---------------------------------------------------------------------------

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
    product: 'movi',
    edition: license.edition(),
    credits: credits.balance,
    welcomed: Boolean(store.get('welcomed', false)),
    storage: {
      tier,
      usedBytes: Number(store.get('usedBytes', 0)) || 0,
      // A string, because a BigInt does not survive the IPC boundary and 48
      // exabytes does not survive being a Number.
      quotaBytes: quotaBytes(tier).toString(),
    },
  };
};

const newId = (prefix) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function record(entry) {
  const renders = store.get('renders', []);
  renders.push(entry);
  store.set('renders', renders.slice(-200));
  return entry;
}

function spend(amount, note) {
  if (credits.balance < amount) {
    const err = new Error(`That costs ${amount} credits; you have ${credits.balance}.`);
    err.code = 'INSUFFICIENT_CREDITS';
    throw err;
  }
  store.set('credits', credits.balance - amount);
  const ledger = store.get('ledger', []);
  ledger.push({
    type: 'spend', amount: -amount, note, at: Date.now(), balanceAfter: credits.balance,
  });
  store.set('ledger', ledger.slice(-500));
}

handle('app:state', async () => state());
handle('app:welcomed', async () => { store.set('welcomed', true); return state(); });

handle('movi:simple', async (plan) => {
  // Charge first. That is the product, and doing it the safe way round would
  // quietly turn Simple into Advanced.
  const cost = costOfSeconds(plan.model, plan.seconds);
  spend(cost, `Movi Simple · ${plan.seconds}s`);
  return record({
    id: newId('r'),
    mode: 'simple',
    prompt: plan.prompt,
    model: plan.model,
    seconds: plan.seconds,
    charged: cost,
    at: Date.now(),
    restoredAt: null,
    pending: true,
    frame: null,
  });
});

handle('movi:clip', async ({ prompt, model, extendOf = null }) => {
  const cost = extendOf ? costOfExtension(model) : costOfClip(model);
  spend(cost, extendOf ? 'Movi extension' : 'Movi clip');
  const clip = record({
    id: newId('c'),
    mode: 'advanced',
    prompt,
    model,
    seconds: MAX_CLIP_SECONDS,
    charged: cost,
    extendOf,
    at: Date.now(),
    restoredAt: null,
    pending: true,
    frame: null,
  });
  store.set('clips', [...store.get('clips', []), clip.id]);
  return clip;
});

handle('movi:clips', async () => {
  const ids = new Set(store.get('clips', []));
  return store.get('renders', []).filter((r) => ids.has(r.id));
});

handle('movi:restore', async (id) => {
  const render = store.get('renders', []).find((r) => r.id === id) || null;
  const check = restorable(render);
  if (!check.ok) {
    const err = new Error(restoreRefusal(check.reason));
    err.code = 'NOT_RESTORABLE';
    throw err;
  }
  credits.refund('movi', check.amount, 'Movi restore');
  store.set('renders', store.get('renders', []).map((r) =>
    (r.id === id ? { ...r, restoredAt: Date.now() } : r)));
  store.set('clips', store.get('clips', []).filter((cid) => cid !== id));
  return state();
});

handle('movi:history', async (limit = 50) => credits.history(limit));
handle('shell:open-external', async (url) => { await shell.openExternal(url); return true; });
