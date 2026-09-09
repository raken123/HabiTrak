// Hazelnut Squirreal — Electron main process.
//
// The same shape as Hazelnut's: a sandboxed renderer with no Node, no
// filesystem and no network of its own, and every privileged thing behind a
// named IPC surface. Three things differ, and they are the whole app:
//
//   - the tools are the video registry, and the prices come with them;
//   - generations go through VideoClient, which talks to the video model;
//   - GIF Animate never reaches this process. In a video app the motion
//     already exists, so encoding a loop is local work in the renderer.
//
// The renderer itself is Hazelnut's, unchanged: it notices `product` in the
// state below and turns on the transport bar and the clip-aware tools.

import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Store } from '@hazelnut/core/store.js';
import { License, LICENSE_DEFAULTS } from '@hazelnut/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '@hazelnut/core/credits.js';
import { GeminiClient } from '@hazelnut/core/gemini.js';
import { VideoClient } from '@hazelnut/core/video.js';
import { resolveApiKey, saveApiKey } from '@hazelnut/core/keystore.js';
import { VideoEngine } from '@hazelnut/core/video-engine.js';
import { VIDEO_TOOLS, VIDEO_TOOL_ORDER, videoCostOf } from '@hazelnut/core/video-tools.js';
import { PLANS, TRIAL_DAYS, SQUIRREAL_TRIAL_CREDIT_GRANT } from '@hazelnut/core/pricing.js';
import { parseDataUrl, stamp } from '@hazelnut/core/imaging.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'Hazelnut Squirreal';

// Packaged, the renderer is copied in beside this file; in the repository it is
// still Hazelnut's, imported rather than duplicated.
const RENDERER_DIR = [
  path.join(__dirname, '..', 'renderer'),
  path.join(__dirname, '..', '..', 'hazelnut', 'renderer'),
].find((dir) => existsSync(path.join(dir, 'index.html')));

const CORE_DIR = path.dirname(fileURLToPath(import.meta.resolve('@hazelnut/core/package.json')));

// As in Hazelnut: Chromium will not load ES modules over file://, so the page
// is served from a privileged scheme of our own and gets a real origin.
protocol.registerSchemesAsPrivileged([{
  scheme: 'squirreal',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

let win = null;
let store;
let license;
let credits;
let client;
let video;
let engine;

const jobs = new Map();

function boot() {
  store = new Store({
    appName: APP_NAME,
    defaults: { ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, product: 'squirreal', settings: {} },
  });
  license = new License(store, { product: 'squirreal' });
  // Squirreal's ledger is priced from the video registry: a clip is not a still
  // and must never be charged as one.
  credits = new Credits(store, { costOf: videoCostOf });

  const { key, source } = resolveApiKey({ appName: APP_NAME, cwd: app.getAppPath() });
  client = new GeminiClient({ apiKey: key });
  client.keySource = source;
  video = new VideoClient({ apiKey: key });
  engine = new VideoEngine({ video, client, credits, license });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#1e1e1e',
    show: false,
    title: APP_NAME,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
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
  win.loadURL('squirreal://app/index.html');

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('squirreal://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

nativeTheme.themeSource = 'dark';

function serveRenderer() {
  protocol.handle('squirreal', async (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);

    const root = rel.startsWith('/core/') ? CORE_DIR : RENDERER_DIR;
    const file = path.normalize(path.join(root, rel.startsWith('/core/') ? rel.slice(6) : rel));

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
// Menu
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
        { label: 'About Hazelnut Squirreal', click: menuCommand('about') },
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
        { label: 'Open Frame or Clip…', accelerator: 'CmdOrCtrl+O', click: menuCommand('file:open') },
        { type: 'separator' },
        { label: 'Save Frame As…', accelerator: 'CmdOrCtrl+S', click: menuCommand('file:save') },
        { label: 'Export Clip as GIF…', click: menuCommand('file:export-gif') },
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
        { label: 'Expand Frame…', accelerator: 'CmdOrCtrl+E', click: menuCommand('tool:expand') },
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
        { label: 'Flatten Frame', click: menuCommand('layer:flatten') },
      ],
    },
    {
      label: 'Tools',
      submenu: VIDEO_TOOL_ORDER.map((id) => ({
        label: VIDEO_TOOLS[id].name,
        accelerator: VIDEO_TOOLS[id].shortcut,
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
    apiKeyConfigured: video.configured,
    apiKeySource: client.keySource || null,
    platform: process.platform,
    version: app.getVersion(),
    tools: VIDEO_TOOL_ORDER.map((id) => VIDEO_TOOLS[id]),
    plans: PLANS,
    trialDays: TRIAL_DAYS,
    trialCreditGrant: SQUIRREAL_TRIAL_CREDIT_GRANT,
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
  credits.grant('trial-grant', SQUIRREAL_TRIAL_CREDIT_GRANT, 'Trial credits');
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
  const trimmed = String(key || '').trim() || null;
  client.apiKey = trimmed;
  video.apiKey = trimmed;
  client.keySource = file;
  return { configured: video.configured, source: file };
});

handle('tool:quote', (toolId, params) => engine.quote(toolId, params));

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

handle('tool:aiscope-learn', (jobId, opts) => runJob(jobId, (ctx) =>
  engine.aiscopeLearn({ ...opts, ...ctx })));

handle('tool:transform', () => {
  throw new Error('That tool edits a still. Squirreal works on clips — use Hazelnut for it.');
});

handle('tool:describe', () => {
  throw new Error('That tool reads a still. Squirreal works on clips — use Hazelnut for it.');
});

// Deliberately not implemented: the renderer encodes the open clip itself.
handle('tool:gif-animate', () => {
  throw new Error('In Squirreal the clip is encoded on this machine — nothing is sent and nothing is charged.');
});

handle('credits:refund', (toolId, amount, note) => credits.refund(toolId, amount, note));

// -- files ------------------------------------------------------------------

handle('file:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open a frame or a clip',
    properties: ['openFile'],
    filters: [
      { name: 'Clips', extensions: ['mp4', 'webm', 'mov', 'm4v'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
    ],
  });
  if (canceled || !filePaths.length) return null;
  return readMedia(filePaths[0]);
});

handle('file:open-path', (filePath) => readMedia(filePath));

const VIDEO_MIME = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

async function readMedia(filePath) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const video_ = VIDEO_MIME[ext];
  const mime = video_ || (ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`);
  return {
    name: path.basename(filePath),
    path: filePath,
    // A clip comes back under its own key, so the renderer knows to decode it
    // into frames rather than drop it in as a still.
    ...(video_
      ? { clip: `data:${mime};base64,${buffer.toString('base64')}` }
      : { dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }),
  };
}

handle('file:save', async (dataUrl, suggestedName) => {
  const { mimeType, base64 } = parseDataUrl(dataUrl);
  const ext = mimeType.includes('gif') ? 'gif'
    : mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('webm') ? 'webm'
    : mimeType.includes('jpeg') ? 'jpg'
    : 'png';
  const dir = ['mp4', 'webm'].includes(ext) ? 'videos' : 'pictures';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save',
    defaultPath: path.join(
      app.getPath(dir),
      suggestedName || `squirreal-${stamp()}.${ext}`,
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
