// Contact sheet for a scene: capture a few times as PNGs instead of encoding a
// film, so a cut can be checked in seconds rather than minutes.
//
//   AD_SCENE=short3.html AD_WIDTH=1080 AD_HEIGHT=1920 node ads/stills.mjs 2 12 24

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const CHROME = process.env.AD_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.AD_PORT || 8741);
const CDP_PORT = Number(process.env.AD_CDP_PORT || 9451);
const WIDTH = Number(process.env.AD_WIDTH || 1080);
const HEIGHT = Number(process.env.AD_HEIGHT || 1920);
const SCENE = process.env.AD_SCENE || 'short3.html';
const OUT = process.env.AD_STILLS || path.join(ROOT, '.build', 'stills');

const times = process.argv.slice(2).map(Number);
if (!times.length) throw new Error('give at least one time, in seconds');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs')], {
  env: { ...process.env, AD_PORT: String(PORT) }, stdio: 'ignore',
});
await wait(700);

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--disable-lcd-text',
  `--remote-debugging-port=${CDP_PORT}`, `--window-size=${WIDTH},${HEIGHT}`,
  `http://127.0.0.1:${PORT}/${SCENE}`,
], { stdio: 'ignore' });

async function debuggerUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) return target.webSocketDebuggerUrl;
    } catch { /* still starting */ }
    await wait(250);
  }
  throw new Error('the browser never exposed a debugging target');
}

const ws = new WebSocket(await debuggerUrl());
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let seq = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  const resolve = pending.get(msg.id);
  if (!resolve) return;
  pending.delete(msg.id);
  resolve(msg.error ? Promise.reject(new Error(msg.error.message)) : msg.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, (v) => (v instanceof Promise ? v.catch(reject) : resolve(v)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = (expression) =>
  send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
});

// Surface anything the page throws: a still that silently renders the wrong
// thing is worse than no still at all.
send('Log.enable').catch(() => {});
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    console.error(`  page error: ${msg.params.entry.text}`);
  }
});

for (let i = 0; i < 80; i += 1) {
  const probe = await evaluate('typeof window.AD === "object" && typeof AD.seek === "function"');
  if (probe.result?.value) break;
  await wait(250);
}
await evaluate('AD.ready()');

fs.mkdirSync(OUT, { recursive: true });
// The scene's cues only fire forwards, so step through every tenth of a second
// up to each wanted time rather than jumping.
let at = 0;
for (const t of times.sort((a, b) => a - b)) {
  for (; at < t; at = Math.min(t, at + 1 / 24)) await evaluate(`AD.seek(${at.toFixed(2)})`);
  await evaluate(`AD.seek(${t.toFixed(2)})`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, `t${t.toFixed(1).replace('.', '_')}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(`wrote ${path.relative(ROOT, file)}`);
}

// A probe expression, for checking what the page actually thinks is on screen.
if (process.env.AD_PROBE) {
  const probe = await evaluate(process.env.AD_PROBE);
  console.log('probe:', JSON.stringify(probe.result?.value ?? probe.exceptionDetails, null, 2));
}

ws.close();
chrome.kill();
server.kill();
