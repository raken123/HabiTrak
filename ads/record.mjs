// Record the ad.
//
// Steps virtual time in the scene, screenshots every frame over the DevTools
// protocol, and pipes the frames straight into ffmpeg — so nothing depends on
// wall-clock timing and no intermediate frames touch the disk.
//
//   node ads/record.mjs [out.mp4]

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const CHROME = process.env.AD_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = process.env.AD_FFMPEG || 'ffmpeg';
const PORT = Number(process.env.AD_PORT || 8732);
const CDP_PORT = Number(process.env.AD_CDP_PORT || 9444);

const WIDTH = Number(process.env.AD_WIDTH || 1280);
const HEIGHT = Number(process.env.AD_HEIGHT || 720);
const FPS = Number(process.env.AD_FPS || 24);
const SCENE = process.env.AD_SCENE || 'scene.html';
const OUT = process.argv[2] || path.join(ROOT, 'dist', 'Hazelnut-ad.mp4');
const MUSIC = process.env.AD_MUSIC || path.join(ROOT, '.build', 'bed.wav');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the browser ────────────────────────────────────────────────────────────

const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs')], {
  env: { ...process.env, AD_PORT: String(PORT) },
  stdio: 'ignore',
});
await wait(700);

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--disable-lcd-text',
  `--remote-debugging-port=${CDP_PORT}`,
  `--window-size=${WIDTH},${HEIGHT}`,
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

// A headless window is not the same size as its viewport, and the difference
// crops the frame. Pin the metrics so every capture is exactly 1280x720.
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
});

// Wait for the scene to declare itself, then let it load both apps.
for (let i = 0; i < 80; i += 1) {
  const probe = await evaluate('typeof window.AD === "object" && typeof AD.seek === "function"');
  if (probe.result?.value) break;
  await wait(250);
}
process.stdout.write('scene loaded, booting the apps…\n');
await evaluate('AD.ready()');

const duration = (await evaluate('AD.duration')).result.value;
const frames = Math.round(duration * FPS);

// ── the encoder ────────────────────────────────────────────────────────────

const hasMusic = fs.existsSync(MUSIC);
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const args = [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0',
  ...(hasMusic ? ['-i', MUSIC] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  ...(hasMusic ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
  OUT,
];
const ffmpeg = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });

const write = (buf) => new Promise((resolve) => {
  if (ffmpeg.stdin.write(buf)) resolve();
  else ffmpeg.stdin.once('drain', resolve);
});

// ── the frames ─────────────────────────────────────────────────────────────

const started = Date.now();
for (let f = 0; f < frames; f += 1) {
  const t = f / FPS;
  await evaluate(`AD.seek(${t.toFixed(4)})`);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  await write(Buffer.from(shot.data, 'base64'));

  if (f % (FPS * 10) === 0 || f === frames - 1) {
    const done = (f + 1) / frames;
    const elapsed = (Date.now() - started) / 1000;
    process.stdout.write(
      `  ${String(Math.round(done * 100)).padStart(3)}%  frame ${f + 1}/${frames}  `
      + `t=${t.toFixed(1)}s  elapsed ${elapsed.toFixed(0)}s  eta ${(elapsed / done - elapsed).toFixed(0)}s\n`,
    );
  }
}

ffmpeg.stdin.end();
await new Promise((resolve) => ffmpeg.on('close', resolve));

ws.close();
chrome.kill();
server.kill();

const size = fs.statSync(OUT).size;
console.log(`\n${OUT}  ${(size / 1024 / 1024).toFixed(1)} MB  ${duration}s  ${WIDTH}x${HEIGHT} @ ${FPS}fps`);
