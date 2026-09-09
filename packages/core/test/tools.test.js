import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_ORDER, LOCAL_TOOLS, costOf, needsAi, availability } from '../tools.js';

test('every advertised tool exists and is ordered', () => {
  // The six the app shipped with, still in the toolbar and still first in
  // their groups; the fifteen that came after are ordered around them.
  for (const id of ['draw', 'magic-draw', 'realtouch', 'gif-animate', 'expand', 'aiscope']) {
    assert.ok(TOOL_ORDER.includes(id), `${id} left the toolbar`);
  }
  assert.equal(TOOL_ORDER.length, 21);
  assert.equal(new Set(TOOL_ORDER).size, 21, 'a tool is listed twice');
  for (const id of TOOL_ORDER) assert.ok(TOOLS[id], `${id} is missing`);
  for (const id of Object.keys(TOOLS)) assert.ok(TOOL_ORDER.includes(id), `${id} is not in the order`);
});

test('the toolbox is half local, half model — and the shortcuts are unique', () => {
  const ai = TOOL_ORDER.filter((id) => TOOLS[id].ai);
  assert.equal(LOCAL_TOOLS.length, 11);
  assert.equal(ai.length, 10);
  assert.equal(LOCAL_TOOLS.length + ai.length, TOOL_ORDER.length);

  const keys = TOOL_ORDER.map((id) => TOOLS[id].shortcut);
  assert.equal(new Set(keys).size, keys.length, `two tools share a shortcut: ${keys.join(' ')}`);
});

test('the fifteen new tools are cheap, and the browser edition locks the paid half', () => {
  const FIFTEEN = {
    crop: 0, straighten: 0, levels: 0, colour: 0, sharpen: 0, denoise: 0, vignette: 0, text: 0,
    caption: 3, erase: 5, background: 5, sky: 6, colourise: 6, upscale: 8, restore: 8,
  };
  assert.equal(Object.keys(FIFTEEN).length, 15);
  for (const [id, cost] of Object.entries(FIFTEEN)) {
    assert.ok(TOOLS[id], `${id} is missing`);
    assert.equal(costOf(id), cost, `${id} is priced at ${costOf(id)}`);
    // None of them may cost more than the cheapest of the original AI tools.
    if (TOOLS[id].ai) assert.ok(cost < costOf('realtouch'), `${id} is not cheap`);
  }

  for (const id of LOCAL_TOOLS) {
    assert.equal(availability(id, 'web').allowed, true, `${id} should work in a browser`);
  }
  for (const id of TOOL_ORDER.filter((t) => TOOLS[t].ai)) {
    const check = availability(id, 'web');
    assert.equal(check.allowed, false, `${id} should be locked on the web`);
    assert.equal(check.reason, 'web-half');
  }
  // AIScope is local, but its Learn button is not.
  assert.equal(availability('aiscope', 'web', { learn: true }).allowed, false);
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
