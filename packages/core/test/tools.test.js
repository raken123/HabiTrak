import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_ORDER, costOf, needsAi, availability } from '../tools.js';

test('every advertised tool exists and is ordered', () => {
  assert.deepEqual(TOOL_ORDER, ['draw', 'magic-draw', 'realtouch', 'gif-animate', 'expand', 'aiscope']);
  for (const id of TOOL_ORDER) assert.ok(TOOLS[id], `${id} is missing`);
});

test('Magic Draw stays inside its 5–20 credit band', () => {
  const samples = [
    { coveragePct: 0, colorCount: 1, megapixels: 0.1 },
    { coveragePct: 25, colorCount: 4, megapixels: 1 },
    { coveragePct: 100, colorCount: 64, megapixels: 12 },
  ];
  for (const s of samples) {
    const cost = costOf('magic-draw', s);
    assert.ok(cost >= 5 && cost <= 20, `${JSON.stringify(s)} priced at ${cost}`);
    assert.equal(Number.isInteger(cost), true);
  }
  assert.ok(costOf('magic-draw', samples[2]) > costOf('magic-draw', samples[0]), 'more work should cost more');
});

test('the fixed prices are the advertised ones', () => {
  assert.equal(costOf('realtouch'), 20);
  assert.equal(costOf('gif-animate'), 600);
  assert.equal(costOf('draw'), 0);
  assert.equal(costOf('expand'), 0, 'Expand never costs a credit');
});

test('AIScope only charges when it is asked to learn', () => {
  assert.equal(costOf('aiscope', { learn: false }), 0);
  assert.equal(needsAi('aiscope', { learn: false }), false);
  assert.equal(costOf('aiscope', { learn: true }), 15);
  assert.equal(needsAi('aiscope', { learn: true }), true);
});

test('AIScope covers the full advertised magnification range', () => {
  assert.equal(TOOLS.aiscope.minZoom, 80);
  assert.equal(TOOLS.aiscope.maxZoom, 60000);
});

test('Hazelnut Free keeps the local tools and locks the model', () => {
  for (const id of ['draw', 'expand']) {
    assert.equal(availability(id, 'free').allowed, true, `${id} must work on Free`);
  }
  for (const id of ['magic-draw', 'realtouch', 'gif-animate']) {
    const check = availability(id, 'free');
    assert.equal(check.allowed, false, `${id} must be locked on Free`);
    assert.equal(check.reason, 'no-ai-on-free');
  }
  assert.equal(availability('aiscope', 'free', { learn: false }).allowed, true, 'optical zoom stays on Free');
  assert.equal(availability('aiscope', 'free', { learn: true }).allowed, false, 'Learn does not');
});

test('trial and pro unlock everything', () => {
  for (const edition of ['trial', 'pro']) {
    for (const id of TOOL_ORDER) {
      assert.equal(availability(id, edition, { learn: true }).allowed, true, `${id} on ${edition}`);
    }
  }
});

test('an unknown tool is refused rather than priced', () => {
  assert.throws(() => costOf('nope'), /Unknown tool/);
  assert.equal(availability('nope', 'pro').allowed, false);
});
