// Hazelnut Mini — Electron main process.
//
// Mini is Hazelnut's remover and nothing else, so this file is a fraction of
// the size of its big sibling's: one window, one tool, the same licence and
// credit machinery underneath.

import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, nativeTheme } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Store } from '@hazelnut/core/store.js';
import { License, LICENSE_DEFAULTS } from '@hazelnut/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '@hazelnut/core/credits.js';
import { GeminiClient } from '@hazelnut/core/gemini.js';
import { resolveApiKey, saveApiKey } from '@hazelnut/core/keystore.js';
import { Engine } from '@hazelnut/core/engine.js';
import { PLANS, TRIAL_DAYS } from '@hazelnut/core/pricing.js';
import { parseDataUrl, stamp } from '@hazelnut/core/imaging.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'Hazelnut Mini';
const WWW_DIR = path.join(__dirname, '..', 'www');

protocol.registerSchemesAsPrivileged([{
  scheme: 'hazelnut',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

let win = null;
let store;
let license;
let credits;
let client;
let engine;
const jobs = new Map();

function boot() {
  store = new Store({
    appName: APP_NAME,
    defaults: { ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, product: 'mini' },
  });
  license = new License(store, { product: 'mini' });
  credits = new Credits(store);
  const { key, source } = resolveApiKey({ appName: APP_NAME, cwd: app.getAppPath() });
  client = new GeminiClient({ apiKey: key });
  client.keySource = source;
  engine = new Engine({ client, credits, license });
}

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 780,
    minWidth: 360,
    minHeight: 520,
    backgroundColor: '#1a1a1a',
    show: false,
    title: APP_NAME,
    // Windows and Linux take the window and taskbar icon from here;
    // macOS uses the .icns inside the bundle instead and ignores it.
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
  win.loadURL('hazelnut://mini/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
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
// IPC — the same envelope Hazelnut uses
// ---------------------------------------------------------------------------

const handle = (channel, fn) => ipcMain.handle(channel, async (_event, ...args) => {
  try {
    return { ok: true, value: await fn(...args) };
  } catch (err) {
    return {
      ok: false,
      error: {
        message: err?.message || String(err),
        code: err?.code || null,
        cost: err?.cost ?? null,
        balance: err?.balance ?? null,
        short: err?.short ?? null,
      },
    };
  }
});

function state() {
  return {
    ...license.status(),
    credits: credits.balance,
    apiKeyConfigured: client.configured,
    apiKeySource: client.keySource || null,
    platform: process.platform,
    version: app.getVersion(),
    plans: { mini: PLANS['mini-pro'], full: PLANS['hazelnut-pro'] },
    trialDays: TRIAL_DAYS,
    removalCost: 20,
  };
}

handle('app:state', () => state());
handle('trial:start', () => {
  const status = license.startTrial();
  credits.grant('mini-trial-grant', PLANS['mini-trial'].credits, 'Trial credits');
  return { ...status, credits: credits.balance };
});
handle('license:activate', (key) => {
  const result = license.activate(key);
  if (result.ok) {
    credits.grant(`mini-pro-${new Date().toISOString().slice(0, 7)}`, PLANS['mini-pro'].credits, 'Hazelnut Mini credits');
  }
  return { ...result, state: state() };
});
handle('apikey:save', (key) => {
  const file = saveApiKey(key, { appName: APP_NAME });
  client.apiKey = String(key || '').trim() || null;
  client.keySource = file;
  return { configured: client.configured };
});

handle('mini:remove', (jobId, opts) => {
  const controller = new AbortController();
  jobs.set(jobId, controller);
  return engine.miniRemove({
    ...opts,
    signal: controller.signal,
    onProgress: (payload) => win?.webContents.send('job:progress', { jobId, ...payload }),
  }).finally(() => jobs.delete(jobId));
});

ipcMain.on('job:cancel', (_e, jobId) => { jobs.get(jobId)?.abort(); jobs.delete(jobId); });

handle('file:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose a photo',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (canceled || !filePaths.length) return null;
  const buffer = await fs.readFile(filePaths[0]);
  const ext = path.extname(filePaths[0]).slice(1).toLowerCase();
  return {
    name: path.basename(filePaths[0]),
    dataUrl: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buffer.toString('base64')}`,
  };
});

handle('file:save', async (dataUrl) => {
  const { mimeType, base64 } = parseDataUrl(dataUrl);
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save photo',
    defaultPath: path.join(app.getPath('pictures'), `hazelnut-mini-${stamp()}.${ext}`),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return { path: filePath };
});

handle('shell:open-external', (url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  return true;
});
