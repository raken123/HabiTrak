// Hazelnut — Electron main process.
//
// The renderer is a sandboxed web page: no Node, no filesystem, no network of
// its own. Everything privileged happens here and is reached over a narrow,
// named IPC surface defined in preload.js. In particular the Gemini API key
// never crosses into the renderer — only the fact that one is configured.

import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Store } from '@hazelnut/core/store.js';
import { License, LICENSE_DEFAULTS } from '@hazelnut/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '@hazelnut/core/credits.js';
import { GeminiClient } from '@hazelnut/core/gemini.js';
import { resolveApiKey, saveApiKey } from '@hazelnut/core/keystore.js';
import { Engine } from '@hazelnut/core/engine.js';
import { TOOLS, TOOL_ORDER } from '@hazelnut/core/tools.js';
import { PLANS, TRIAL_DAYS, TRIAL_CREDIT_GRANT } from '@hazelnut/core/pricing.js';
import { parseDataUrl, stamp } from '@hazelnut/core/imaging.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'Hazelnut';
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');

// The renderer needs a couple of modules out of @hazelnut/core (the GIF
// encoder, which can only run where the canvas pixels are). It is a workspace
// dependency in development and a bundled one once packaged, so resolve it
// rather than assuming either layout.
const CORE_DIR = path.dirname(fileURLToPath(import.meta.resolve('@hazelnut/core/package.json')));

// The renderer is an ES-module app, and Chromium refuses to load module
// scripts over file:// because such pages have an opaque origin. Serving it
// from a privileged scheme of our own gives the page a real origin, so modules
// load and the Content-Security-Policy in index.html actually means something.
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

/** In-flight jobs, so the renderer can cancel one. */
const jobs = new Map();

function boot() {
  store = new Store({
    appName: APP_NAME,
    defaults: { ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, product: 'hazelnut', settings: {} },
  });
  license = new License(store, { product: 'hazelnut' });
  credits = new Credits(store);
  const { key, source } = resolveApiKey({ appName: APP_NAME, cwd: app.getAppPath() });
  client = new GeminiClient({ apiKey: key });
  client.keySource = source;
  engine = new Engine({ client, credits, license });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 640,
    backgroundColor: '#1e1e1e',
    show: false,
    title: APP_NAME,
    // Windows and Linux take the window and taskbar icon from here;
    // macOS uses the .icns inside the bundle instead and ignores it.
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    // The in-app menu bar is part of the editor chrome, so the native one is
    // hidden on Windows and tucked into the traffic-light strip on macOS.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL('hazelnut://app/index.html');

  // Anything that is not the app itself opens in the user's browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('hazelnut://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

nativeTheme.themeSource = 'dark';

function serveRenderer() {
  protocol.handle('hazelnut', async (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);

    // /core/* is the sliver of @hazelnut/core the renderer is allowed to import.
    const root = rel.startsWith('/core/') ? CORE_DIR : RENDERER_DIR;
    const file = path.normalize(path.join(root, rel.startsWith('/core/') ? rel.slice(6) : rel));

    // Never serve anything outside those two directories, whatever the URL says.
    if (file !== root && !file.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

app.whenReady().then(() => {
  boot();
  serveRenderer();
  Menu.setApplicationMenu(buildMenu());
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// Menu — mirrors the in-app menu bar so the OS shortcuts work too
// ---------------------------------------------------------------------------

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

const menuCommand = (id) => () => send('menu:command', id);

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { label: 'About Hazelnut', click: menuCommand('about') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: menuCommand('settings') },
        { label: 'Plans & Credits…', click: menuCommand('plans') },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New…', accelerator: 'CmdOrCtrl+N', click: menuCommand('file:new') },
        { label: 'Open Image…', accelerator: 'CmdOrCtrl+O', click: menuCommand('file:open') },
        { type: 'separator' },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+S', click: menuCommand('file:save') },
        { label: 'Export GIF…', click: menuCommand('file:export-gif') },
        ...(isMac ? [] : [
          { type: 'separator' },
          { label: 'Settings…', accelerator: 'Ctrl+,', click: menuCommand('settings') },
          { type: 'separator' },
          { role: 'quit' },
        ]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: menuCommand('edit:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: menuCommand('edit:redo') },
        { type: 'separator' },
        { role: 'copy' }, { role: 'paste' },
      ],
    },
    {
      label: 'Image',
      submenu: [
        { label: 'Expand Canvas…', accelerator: 'CmdOrCtrl+E', click: menuCommand('tool:expand') },
        { label: 'Fit on Screen', accelerator: 'CmdOrCtrl+0', click: menuCommand('view:fit') },
        { label: 'Actual Pixels', accelerator: 'CmdOrCtrl+1', click: menuCommand('view:100') },
      ],
    },
    {
      label: 'Layer',
      submenu: [
        { label: 'New Layer', accelerator: 'CmdOrCtrl+Shift+N', click: menuCommand('layer:new') },
        { label: 'Duplicate Layer', accelerator: 'CmdOrCtrl+J', click: menuCommand('layer:duplicate') },
        { label: 'Delete Layer', click: menuCommand('layer:delete') },
        { type: 'separator' },
        { label: 'Flatten Image', click: menuCommand('layer:flatten') },
      ],
    },
    {
      label: 'Tools',
      submenu: TOOL_ORDER.map((id) => ({
        label: TOOLS[id].name,
        accelerator: TOOLS[id].shortcut,
        click: menuCommand(`select:${id}`),
      })),
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Tool Guide', click: menuCommand('help') },
        { label: 'Plans & Credits', click: menuCommand('plans') },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// ---------------------------------------------------------------------------
// IPC
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
    ledger: credits.history(20),
    apiKeyConfigured: client.configured,
    apiKeySource: client.keySource || null,
    platform: process.platform,
    version: app.getVersion(),
    tools: TOOL_ORDER.map((id) => TOOLS[id]),
    plans: PLANS,
    trialDays: TRIAL_DAYS,
    trialCreditGrant: TRIAL_CREDIT_GRANT,
    settings: store.get('settings', {}),
  };
}

handle('app:state', () => state());

handle('app:settings', (patch) => {
  const settings = { ...store.get('settings', {}), ...patch };
  store.set('settings', settings);
  return settings;
});

handle('trial:start', () => {
  const status = license.startTrial();
  // The trial's credits are granted once, keyed so a restart cannot re-grant.
  credits.grant('trial-grant', TRIAL_CREDIT_GRANT, 'Trial credits');
  return { ...status, credits: credits.balance };
});

handle('license:activate', (key) => {
  const result = license.activate(key);
  if (result.ok) {
    const plan = license.status().plan;
    credits.grant(`plan-${plan.id}-${new Date().toISOString().slice(0, 7)}`, plan.credits, `${plan.name} credits`);
  }
  return { ...result, state: state() };
});

handle('license:deactivate', () => ({ ...license.deactivate(), state: state() }));

handle('apikey:save', (key) => {
  const file = saveApiKey(key, { appName: APP_NAME });
  client.apiKey = String(key || '').trim() || null;
  client.keySource = file;
  return { configured: client.configured, source: file };
});

handle('tool:quote', (toolId, params) => engine.quote(toolId, params));

// -- tool runs --------------------------------------------------------------

function runJob(jobId, run) {
  const controller = new AbortController();
  jobs.set(jobId, controller);
  const onProgress = (payload) => send('job:progress', { jobId, ...payload });
  return run({ signal: controller.signal, onProgress })
    .finally(() => jobs.delete(jobId));
}

ipcMain.on('job:cancel', (_event, jobId) => {
  jobs.get(jobId)?.abort();
  jobs.delete(jobId);
});

handle('tool:magic-draw', (jobId, opts) => runJob(jobId, (ctx) =>
  engine.magicDraw({ ...opts, ...ctx })));

handle('tool:realtouch', (jobId, opts) => runJob(jobId, (ctx) =>
  engine.realtouch({ ...opts, ...ctx })));

handle('tool:transform', (jobId, opts) => runJob(jobId, (ctx) =>
  engine.transform({ ...opts, ...ctx })));

handle('tool:describe', (jobId, opts) => runJob(jobId, (ctx) =>
  engine.describe({ ...opts, ...ctx })));

handle('tool:gif-animate', (jobId, opts) => runJob(jobId, (ctx) =>
  engine.gifAnimate({ ...opts, ...ctx })));

handle('tool:aiscope-learn', (jobId, opts) => runJob(jobId, (ctx) =>
  engine.aiscopeLearn({ ...opts, ...ctx })));

handle('credits:refund', (toolId, amount, note) => credits.refund(toolId, amount, note));

// -- files ------------------------------------------------------------------

handle('file:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
  });
  if (canceled || !filePaths.length) return null;
  return readImage(filePaths[0]);
});

handle('file:open-path', (filePath) => readImage(filePath));

async function readImage(filePath) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
  return {
    name: path.basename(filePath),
    path: filePath,
    dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
  };
}

handle('file:save', async (dataUrl, suggestedName) => {
  const { mimeType, base64 } = parseDataUrl(dataUrl);
  const ext = mimeType.includes('gif') ? 'gif' : mimeType.includes('jpeg') ? 'jpg' : 'png';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save image',
    defaultPath: path.join(
      app.getPath('pictures'),
      suggestedName || `hazelnut-${stamp()}.${ext}`,
    ),
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
