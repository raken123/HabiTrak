import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.js';
import { Credits, CREDIT_DEFAULTS } from '../credits.js';
import { License, LICENSE_DEFAULTS } from '../license.js';
import { LockedError } from '../engine.js';
import { VideoEngine } from '../video-engine.js';
import { VideoClient } from '../video.js';
import { videoCostOf, videoAvailability, VIDEO_TOOLS, MAX_CLIP_SECONDS } from '../video-tools.js';
import { PLANS } from '../pricing.js';

const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

class FakeVideo {
  constructor({ fail = null } = {}) {
    this.configured = true;
    this.calls = [];
    this.fail = fail;
  }

  async generateClip(opts) {
    this.calls.push(opts);
    if (this.fail) throw new Error(this.fail);
    opts.onProgress?.({ stage: 'rendering', message: 'Rendering the clip…' });
    return { base64: 'Q0xJUA==', mimeType: 'video/mp4' };
  }
}

class FakeText {
  constructor({ text = 'PLACE: a car park\nOBJECT: a van\nBEHIND: a painted line and a kerb', sources = [], data = null } = {}) {
    this.configured = true;
    this.calls = [];
    this.text = text;
    this.sources = sources;
    this.data = data;
  }

  async analyze(opts) {
    this.calls.push(opts);
    return { text: this.text, data: this.data, sources: this.sources };
  }
}

function build({ credits = 3000, edition = 'trial', video = new FakeVideo(), client = new FakeText() } = {}) {
  const licenseStore = Store.memory({ ...LICENSE_DEFAULTS });
  const license = new License(licenseStore, { product: 'squirreal' });
  if (edition !== 'free') license.startTrial();
  if (edition === 'pro') license.activate('HZL-A1B2C-D3E4F-G5H6J-K7M8N');

  const creditStore = Store.memory({ ...CREDIT_DEFAULTS, credits });
  const creditsApi = new Credits(creditStore, { costOf: videoCostOf });
  return { engine: new VideoEngine({ video, client, credits: creditsApi, license }), video, client, credits: creditsApi, license };
}

test('a clip is priced mostly on its length', () => {
  const sketch = { coveragePct: 30, colorCount: 6, megapixels: 2 };
  const short = videoCostOf('magic-draw', { ...sketch, seconds: 1 });
  const long = videoCostOf('magic-draw', { ...sketch, seconds: MAX_CLIP_SECONDS });

  assert.ok(short >= 40 && long <= 120, 'both stay inside the band');
  assert.ok(long - short > 35, 'length moves the price more than half the band');

  // Length dominates but is not the whole story: the same length with a denser
  // sketch and a larger output costs more, and only that reaches the top.
  const dense = videoCostOf('magic-draw', { seconds: MAX_CLIP_SECONDS, coveragePct: 90, colorCount: 40, megapixels: 8 });
  assert.ok(dense > long);
  assert.equal(dense, 120);

  assert.equal(videoCostOf('realtouch', { seconds: MAX_CLIP_SECONDS }), 150);
  assert.ok(videoCostOf('realtouch', { seconds: 1 }) < 150);
});

test('GIF Animate and Expand are free in a video app, because the motion already exists', () => {
  assert.equal(videoCostOf('gif-animate'), 0);
  assert.equal(videoCostOf('expand'), 0);
  assert.equal(VIDEO_TOOLS['gif-animate'].ai, false);
  assert.equal(videoAvailability('gif-animate', 'free').allowed, true);
  assert.equal(videoAvailability('expand', 'free').allowed, true);
});

test('Squirreal carries fewer credits than Hazelnut, and costs more', () => {
  assert.ok(PLANS['squirreal-pro'].credits < PLANS['hazelnut-pro'].credits);
  assert.equal(PLANS['squirreal-pro'].credits, 3000);
  assert.ok(PLANS['squirreal-pro'].monthlyUsd > PLANS['hazelnut-pro'].monthlyUsd);
});

test('Magic Draw returns a clip and charges inside the band', async () => {
  const { engine, credits, video } = build();
  const out = await engine.magicDraw({ sketch: PIXEL, prompt: 'a red car', motion: 'it drives past', seconds: 4 });
  assert.match(out.result.clip, /^data:video\/mp4;base64,/);
  assert.equal(out.result.seconds, 4);
  assert.ok(out.charged >= 40 && out.charged <= 120);
  assert.equal(credits.balance, 3000 - out.charged);
  assert.match(video.calls[0].prompt, /it drives past/);
  assert.equal(video.calls[0].seconds, 4);
});

test('a clip longer than the model covers is clamped rather than refused', async () => {
  const { engine, video } = build();
  await engine.magicDraw({ sketch: PIXEL, seconds: 60 });
  assert.equal(video.calls[0].seconds, MAX_CLIP_SECONDS);
});

test('Realtouch studies the scene once, then hands it to the clip', async () => {
  const client = new FakeText({ sources: [{ title: 'The car park', uri: 'https://example.org/a' }] });
  const { engine, video } = build({ client });
  const stages = [];
  const out = await engine.realtouch({
    frame: PIXEL, marked: PIXEL, seconds: 6,
    onProgress: (p) => stages.push(p.stage),
  });

  assert.equal(client.calls[0].search, true, 'the study is grounded');
  assert.ok(stages.includes('examining') && stages.includes('rebuilding'));
  assert.match(video.calls[0].prompt, /BEHIND: a painted line/, 'the findings reach the clip');
  assert.match(video.calls[0].prompt, /no swimming, no flicker/i, 'and it is told to hold steady');
  assert.equal(out.result.sources.length, 1);
  assert.equal(out.charged, videoCostOf('realtouch', { seconds: 6 }));
});

test('a failed render costs nothing', async () => {
  const { engine, credits } = build({ video: new FakeVideo({ fail: 'the renderer fell over' }) });
  await assert.rejects(engine.magicDraw({ sketch: PIXEL }), /fell over/);
  assert.equal(credits.balance, 3000);
});

test('Squirreal Free locks the generating tools and keeps the local ones', async () => {
  const { engine, credits } = build({ edition: 'free' });
  for (const run of [
    () => engine.magicDraw({ sketch: PIXEL }),
    () => engine.realtouch({ frame: PIXEL, marked: PIXEL }),
  ]) {
    await assert.rejects(run(), (err) => err instanceof LockedError && err.reason === 'no-ai-on-free');
  }
  assert.equal(engine.quote('gif-animate').allowed, true);
  assert.equal(engine.quote('expand').allowed, true);
  assert.equal(credits.balance, 3000);
});

test('quote reports the video price, not the still one', () => {
  const { engine } = build({ credits: 100 });
  const q = engine.quote('realtouch', { seconds: 8 });
  assert.equal(q.cost, 150);
  assert.equal(q.affordable, false);
});

test('the video client defaults to the named model and can be pointed elsewhere', () => {
  assert.equal(new VideoClient({}).model, 'gemini-omni-1.1-flash');
  assert.equal(new VideoClient({ model: 'something-else' }).model, 'something-else');
  assert.equal(new VideoClient({}).mode, 'operation');
});

test('the client starts an operation and polls it until the clip arrives', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method });
    if (url.endsWith(':predictLongRunning')) {
      return { ok: true, status: 200, json: async () => ({ name: 'operations/abc' }), text: async () => '' };
    }
    const done = calls.filter((c) => c.url.includes('operations/abc')).length >= 2;
    return {
      ok: true,
      status: 200,
      json: async () => (done
        ? { done: true, response: { generatedVideos: [{ video: { inlineData: { mimeType: 'video/mp4', data: 'Q0xJUA==' } } }] } }
        : { done: false }),
      text: async () => '',
    };
  };

  const client = new VideoClient({ apiKey: 'k', fetchImpl, pollIntervalMs: 1 });
  const seen = [];
  const clip = await client.generateClip({ prompt: 'a car', onProgress: (p) => seen.push(p.stage) });

  assert.deepEqual(clip, { base64: 'Q0xJUA==', mimeType: 'video/mp4', seconds: 4 });
  assert.match(calls[0].url, /gemini-omni-1\.1-flash:predictLongRunning$/);
  assert.equal(calls[1].method, 'GET', 'the operation is polled');
  assert.ok(seen.includes('queued') && seen.includes('rendering'));
});

test('an operation that fails is reported, not waited on for ever', async () => {
  const fetchImpl = async (url) => ({
    ok: true, status: 200, text: async () => '',
    json: async () => (url.endsWith(':predictLongRunning')
      ? { name: 'operations/bad' }
      : { done: true, error: { code: 500, message: 'render failed' } }),
  });
  const client = new VideoClient({ apiKey: 'k', fetchImpl, pollIntervalMs: 1 });
  await assert.rejects(client.generateClip({ prompt: 'x' }), /render failed/);
});

test('a deployment that answers immediately is handled without an operation', async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200, text: async () => '',
    json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'video/mp4', data: 'QUJD' } }] } }] }),
  });
  const client = new VideoClient({ apiKey: 'k', fetchImpl, pollIntervalMs: 1 });
  const clip = await client.generateClip({ prompt: 'x' });
  assert.equal(clip.base64, 'QUJD');
});

test('a missing key is caught before any request', async () => {
  let called = false;
  const client = new VideoClient({ fetchImpl: async () => { called = true; } });
  await assert.rejects(client.generateClip({ prompt: 'x' }), /No API key configured/);
  assert.equal(called, false);
});

test('an unknown model says how to change it', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '{}', json: async () => ({}) });
  const client = new VideoClient({ apiKey: 'k', fetchImpl, maxRetries: 0 });
  await assert.rejects(client.generateClip({ prompt: 'x' }), /HAZELNUT_VIDEO_MODEL/);
});
