import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.js';
import { Credits, CREDIT_DEFAULTS } from '../credits.js';
import { License, LICENSE_DEFAULTS } from '../license.js';
import { Engine, LockedError } from '../engine.js';

const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

/** A stand-in for GeminiClient that records what it was asked for. */
class FakeClient {
  constructor({ image = 'AAAA', text = 'PLACE: a street\nOBJECT: a car\nBEHIND: kerb and railings', data = null, sources = [], fail = null } = {}) {
    this.configured = true;
    this.calls = [];
    this.image = image;
    this.text = text;
    this.data = data;
    this.sources = sources;
    this.fail = fail;
  }

  async generateImage(opts) {
    this.calls.push({ kind: 'image', ...opts });
    if (this.fail === 'image') throw new Error('model exploded');
    return { base64: this.image, mimeType: 'image/png', text: '' };
  }

  async analyze(opts) {
    this.calls.push({ kind: 'analyze', ...opts });
    if (this.fail === 'analyze') throw new Error('analysis exploded');
    return { text: this.text, data: this.data, sources: this.sources };
  }
}

function build({ credits = 5000, edition = 'trial', client = new FakeClient() } = {}) {
  const licenseStore = Store.memory({ ...LICENSE_DEFAULTS });
  const license = new License(licenseStore);
  if (edition !== 'free') license.startTrial();
  if (edition === 'pro') license.activate('HZL-A1B2C-D3E4F-G5H6J-K7M8N');

  const creditStore = Store.memory({ ...CREDIT_DEFAULTS, credits });
  const creditsApi = new Credits(creditStore);
  return { engine: new Engine({ client, credits: creditsApi, license }), client, credits: creditsApi, license };
}

test('Magic Draw returns an image and charges inside its band', async () => {
  const { engine, credits } = build();
  const out = await engine.magicDraw({ sketch: PIXEL, prompt: 'a red barn', metrics: { coveragePct: 30, colorCount: 6, megapixels: 2 } });
  assert.match(out.result.image, /^data:image\/png;base64,/);
  assert.ok(out.charged >= 5 && out.charged <= 20);
  assert.equal(credits.balance, 5000 - out.charged);
});

test('Realtouch examines the scene before it repaints, and reports its sources', async () => {
  const client = new FakeClient({ sources: [{ title: 'Trafalgar Square', uri: 'https://example.org/a' }] });
  const { engine } = build({ client });
  const stages = [];
  const out = await engine.realtouch({
    image: PIXEL,
    marked: PIXEL,
    onProgress: (p) => stages.push(p.stage),
  });

  assert.deepEqual(client.calls.map((c) => c.kind), ['analyze', 'image'], 'analysis must come first');
  assert.equal(client.calls[0].search, true, 'the analysis pass must use search grounding');
  assert.deepEqual(stages, ['examining', 'rebuilding']);
  assert.equal(out.charged, 20);
  assert.equal(out.result.sources.length, 1);
  assert.match(out.result.scene, /BEHIND/);
});

test('a failed model call leaves the balance untouched', async () => {
  const { engine, credits } = build({ client: new FakeClient({ fail: 'image' }) });
  await assert.rejects(engine.realtouch({ image: PIXEL, marked: PIXEL }), /model exploded/);
  assert.equal(credits.balance, 5000);
});

test('GIF Animate chains keyframes and charges 600 for five seconds', async () => {
  const { engine, client } = build();
  const progress = [];
  const out = await engine.gifAnimate({ image: PIXEL, motion: 'the flag ripples', seconds: 5, fps: 8, onProgress: (p) => progress.push(p) });

  assert.equal(out.charged, 600);
  assert.equal(out.result.plan.count, 40, 'five seconds at 8fps is forty played frames');
  assert.equal(out.result.keyframes.length, out.result.keyCount);
  assert.equal(out.result.keyframes[0], PIXEL, 'the source image is the first keyframe');
  assert.equal(client.calls.length, out.result.keyCount - 1, 'one model call per generated keyframe');
  assert.equal(progress.at(-1).stage, 'encoding');
});

test('GIF Animate refuses to run without a motion description', async () => {
  const { engine, credits } = build();
  await assert.rejects(engine.gifAnimate({ image: PIXEL, motion: '   ' }), /description of the motion/);
  assert.equal(credits.balance, 5000);
});

test('AIScope Learn returns a structured card for 15 credits', async () => {
  const client = new FakeClient({
    data: { subject: 'Denim twill', category: 'textile', description: 'Cotton warp-faced twill.', features: ['diagonal wale'], confidence: 0.82 },
  });
  const { engine } = build({ client });
  const out = await engine.aiscopeLearn({ crop: PIXEL, zoom: 1200 });
  assert.equal(out.charged, 15);
  assert.equal(out.result.card.subject, 'Denim twill');
  assert.equal(out.result.card.zoom, 1200);
});

test('Hazelnut Free locks the AI tools and says why', async () => {
  const { engine, credits } = build({ edition: 'free' });
  for (const run of [
    () => engine.magicDraw({ sketch: PIXEL }),
    () => engine.realtouch({ image: PIXEL, marked: PIXEL }),
    () => engine.gifAnimate({ image: PIXEL, motion: 'wind' }),
    () => engine.aiscopeLearn({ crop: PIXEL }),
  ]) {
    await assert.rejects(run(), (err) => err instanceof LockedError && err.reason === 'no-ai-on-free');
  }
  assert.equal(credits.balance, 5000, 'a locked tool must not spend credits');
});

test('quote() tells the UI the price, the balance and the lock in one call', () => {
  const { engine } = build({ credits: 10 });
  const quote = engine.quote('realtouch');
  assert.deepEqual(quote, { cost: 20, balance: 10, affordable: false, allowed: true, reason: null, message: null });

  const free = build({ edition: 'free' }).engine.quote('gif-animate');
  assert.equal(free.allowed, false);
  assert.match(free.message, /Hazelnut Free/);
});

test('Mini charges only when it actually removes something', async () => {
  const refusing = new FakeClient({ data: { removable: false, reply: 'Mini only removes things.' } });
  const { engine, credits } = build({ client: refusing });
  const out = await engine.miniRemove({ image: PIXEL, message: 'make it look like a painting' });
  assert.equal(out.charged, 0);
  assert.equal(out.result.handled, false);
  assert.equal(credits.balance, 5000);

  const removing = new FakeClient({ data: { removable: true, target: 'the bin', reply: 'Removing the bin.' } });
  const second = build({ client: removing });
  const done = await second.engine.miniRemove({ image: PIXEL, message: 'get rid of the bin' });
  assert.equal(done.charged, 20);
  assert.equal(done.result.handled, true);
  assert.match(done.result.image, /^data:image\/png;base64,/);
});

test('a missing API key is reported before anything is charged', async () => {
  const { engine, credits } = build();
  engine.client.configured = false;
  await assert.rejects(engine.magicDraw({ sketch: PIXEL }), (err) => err.code === 'NO_API_KEY');
  assert.equal(credits.balance, 5000);
});

test('running out of credits is refused with a shortfall the UI can quote', async () => {
  const { engine } = build({ credits: 5 });
  await assert.rejects(
    engine.realtouch({ image: PIXEL, marked: PIXEL }),
    (err) => err.code === 'INSUFFICIENT_CREDITS' && err.cost === 20 && err.short === 15,
  );
});
