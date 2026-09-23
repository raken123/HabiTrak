// A screenshot of the editor for the download page.
//
// It reuses the ad harness rather than a separate rig: the film already drives
// the real app to the moment worth photographing — a clip open, the transport
// bar under it — so this steps the film to that moment, strips the film away,
// and photographs what is left. Nothing is mocked up; the pixels are the app's.
//
//   node ads/shoot-app.mjs site/s-squirreal.jpg 37.5
//   AD_SCENE=short5.html AD_SHOT_W=1800 AD_SHOT_H=1106 \
//     node ads/shoot-app.mjs site/s-editor.jpg 24
//   AD_SCENE=short.html AD_SHOT_W=760 AD_SHOT_H=1211 \
//     node ads/shoot-app.mjs site/s-mini.jpg 20
//
// Two layouts, because the films have two: Hazelnut and Squirreal sit in a
// slab (`.app__shell` around an iframe), and Mini sits in a phone. The frame
// is found rather than named, so a film using either is shot the same way.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const CHROME = process.env.AD_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.AD_PORT || 8756);
const CDP_PORT = Number(process.env.AD_CDP_PORT || 9466);
const SCENE = process.env.AD_SCENE || 'short3.html';
const WIDTH = Number(process.env.AD_SHOT_W || 1560);
const HEIGHT = Number(process.env.AD_SHOT_H || 940);

const OUT = path.resolve(ROOT, process.argv[2] || 'site/s-squirreal.jpg');
const AT = Number(process.argv[3] || 37.5);

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

for (let i = 0; i < 80; i += 1) {
  const probe = await evaluate('typeof window.AD === "object"');
  if (probe.result?.value) break;
  await wait(250);
}
await evaluate('AD.ready()');

// Cues only fire forwards, so walk the film rather than jumping to the moment.
for (let t = 0; t < AT; t = Math.min(AT, t + 1 / 24)) await evaluate(`AD.seek(${t.toFixed(3)})`);
await evaluate(`AD.seek(${AT})`);

// Strip the film: no copy, no vignette, no camera. The iframe is never moved in
// the DOM — that would reload it and take the clip with it — only its
// surroundings are resized around it.
await evaluate(`(() => {
  for (const sel of ['.line--top', '.line--bottom', '.stamp', '.end', '.end2', '.flash', '.vignette', '.nle', '.card', '.prices', '.chip', '.standin']) {
    for (const node of document.querySelectorAll(sel)) node.style.display = 'none';
  }
  document.body.style.cssText = 'width:${WIDTH}px;height:${HEIGHT}px;background:#14110d';
  const film = document.getElementById('film');
  film.style.cssText = 'position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:clip;background:#14110d';

  // Mini's films put the app in a phone rather than a slab. Centre it and
  // leave the phone's own chrome alone — it is part of the picture.
  const phone = document.getElementById('phone');
  if (phone) {
    phone.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);opacity:1';
    return 'phone';
  }

  const app = document.getElementById('app');
  app.style.cssText = 'position:absolute;left:0;top:40px;width:${WIDTH}px;opacity:1;transform:none';
  // A little wider than the film's window, so the options bar is not cut off
  // mid-button. The iframe is resized, not moved, so it is not reloaded.
  const inner = ${WIDTH} - 120;
  const frame = document.getElementById('sq') || document.getElementById('hz');
  const tall = Math.round(inner * 760 / 1440);
  frame.width = inner; frame.height = tall;
  frame.style.width = inner + 'px'; frame.style.height = tall + 'px';
  document.querySelector('.app__shell').style.cssText =
    'width:' + (inner + 40) + 'px;margin:0 auto;padding:16px;border-radius:20px;'
    + 'background:linear-gradient(160deg,#3d352d,#14110d);'
    + 'box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 1px rgba(224,137,74,.22)';
  document.querySelector('.app__frame').style.cssText =
    'width:' + inner + 'px;height:' + tall + 'px;overflow:hidden;border-radius:12px';
  frame.style.transform = 'none';
  return 'slab';
})()`);
// Resizing the frame grows the app's stage, and the picture that was centred
// in the film's smaller window ends up outside it. The app fits the view on
// `0`, so it is asked to — through a key event into the frame, because the
// editor keeps its own state module-scoped and there is nothing on `window`
// to call. Same origin, so the document is reachable.
await evaluate(`(() => {
  const frame = document.getElementById('sq') || document.getElementById('hz');
  if (!frame) return 'no frame';
  const doc = frame.contentDocument;
  if (!doc) return 'no document';
  doc.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
  return 'fitted';
})()`);
await wait(400);

// No further seek: paint() would put the film's camera straight back on.

const shot = await send('Page.captureScreenshot', {
  format: 'jpeg',
  quality: 92,
  clip: { x: 0, y: 0, width: WIDTH, height: 852, scale: 1 },
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
console.log(`${path.relative(ROOT, OUT)} — ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);

ws.close();
chrome.kill();
server.kill();
