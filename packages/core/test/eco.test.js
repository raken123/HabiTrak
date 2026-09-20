import test from 'node:test';
import assert from 'node:assert/strict';
import { ECO, ecoCost, ecoScale, ECO_NOTES, ECO_SUMMARY } from '../eco.js';
import { costOf, TOOL_ORDER, TOOLS } from '../tools.js';
import { videoCostOf } from '../video-tools.js';
import { Engine } from '../engine.js';
import { Credits, CREDIT_DEFAULTS } from '../credits.js';
import { License, LICENSE_DEFAULTS } from '../license.js';
import { Store } from '../store.js';

test('Eco Mode costs less than full, and never nothing', () => {
  for (const id of TOOL_ORDER.filter((t) => TOOLS[t].ai)) {
    const full = costOf(id);
    const eco = costOf(id, { eco: true });
    assert.ok(eco < full, `${id}: ${eco} is not less than ${full}`);
    assert.ok(eco >= 1, `${id} became free, which it is not`);
    assert.equal(Number.isInteger(eco), true);
  }
  assert.equal(costOf('realtouch', { eco: true }), 12);
  assert.equal(costOf('caption', { eco: true }), 2);
  assert.equal(videoCostOf('realtouch', { seconds: 8, eco: true }), 90);
});

test('a free tool stays free — there is nothing to save', () => {
  for (const id of TOOL_ORDER.filter((t) => !TOOLS[t].ai)) {
    assert.equal(costOf(id, { eco: true }), costOf(id), `${id} changed price`);
  }
});

test('the scale rule only shrinks, and only what is too big', () => {
  assert.equal(ecoScale(800, 600), 1, 'a small picture is left alone');
  assert.equal(ecoScale(ECO.maxEdge, ECO.maxEdge), 1);
  const scale = ecoScale(4000, 3000);
  assert.ok(scale < 1);
  assert.equal(Math.round(4000 * scale), ECO.maxEdge);
});

test('every AI tool says what it gives up', () => {
  for (const id of TOOL_ORDER.filter((t) => TOOLS[t].ai)) {
    assert.ok(ECO_NOTES[id], `${id} has no Eco note`);
  }
  // And the summary promises a mechanism, not a measurement.
  assert.match(ECO_SUMMARY, /we cannot measure/i);
  assert.doesNotMatch(ECO_SUMMARY, /\d+\s*(ml|l|litre|liter|gallon)/i);
});

// ── what Eco Mode actually stops the engine doing ──────────────────────────

class FakeClient {
  constructor() { this.calls = []; this.configured = true; }

  async analyze(opts) {
    this.calls.push({ kind: 'analyze', search: Boolean(opts.search) });
    return { text: 'A cobbled square in Ghent.', sources: [{ title: 'a', uri: 'b' }], data: null };
  }

  async generateImage(opts) {
    this.calls.push({ kind: 'image', prompt: opts.prompt });
    return { base64: 'AAAA', mimeType: 'image/png', text: '' };
  }
}

function engineWith() {
  const store = Store.memory({ ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, trialStartedAt: Date.now() });
  const client = new FakeClient();
  const credits = new Credits(store);
  credits.grant('test', 5000, 'test');
  return { engine: new Engine({ client, credits, license: new License(store) }), client, credits };
}

const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

test('Realtouch drops the lookup in Eco Mode — one call, not two', async () => {
  const plain = engineWith();
  await plain.engine.realtouch({ image: PIXEL, marked: PIXEL });
  assert.deepEqual(plain.client.calls.map((c) => c.kind), ['analyze', 'image']);
  assert.equal(plain.client.calls[0].search, true, 'the lookup is a grounded search');

  const eco = engineWith();
  const { result } = await eco.engine.realtouch({ image: PIXEL, marked: PIXEL, eco: true });
  assert.deepEqual(eco.client.calls.map((c) => c.kind), ['image'], 'no lookup happened');
  assert.equal(result.scene, null);
  assert.deepEqual(result.sources, []);
  assert.equal(result.eco, true);

  // And the prompt tells the model it is working blind, rather than leaving a
  // hole where the analysis should be.
  assert.match(eco.client.calls[0].prompt, /Nothing was looked up/);
});

test('Eco Mode charges the Eco price, and only on success', async () => {
  const { engine, credits } = engineWith();
  const before = credits.balance;
  await engine.realtouch({ image: PIXEL, marked: PIXEL, eco: true });
  assert.equal(before - credits.balance, costOf('realtouch', { eco: true }));
});

test('GIF Animate generates half the keyframes in Eco Mode', async () => {
  const plain = engineWith();
  await plain.engine.gifAnimate({ image: PIXEL, motion: 'the flag ripples', seconds: 5, fps: 8 });
  const fullFrames = plain.client.calls.filter((c) => c.kind === 'image').length;

  const eco = engineWith();
  await eco.engine.gifAnimate({ image: PIXEL, motion: 'the flag ripples', seconds: 5, fps: 8, eco: true });
  const ecoFrames = eco.client.calls.filter((c) => c.kind === 'image').length;

  assert.ok(ecoFrames < fullFrames, `${ecoFrames} is not fewer than ${fullFrames}`);
  assert.ok(ecoFrames >= 1, 'it still makes something');
});
