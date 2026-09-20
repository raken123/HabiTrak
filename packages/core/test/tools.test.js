import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_ORDER, LOCAL_TOOLS, PARTNER_TOOLS, isPartnerTool, costOf, needsAi, availability } from '../tools.js';
import { TRANSFORMS, transformPrompt } from '../transforms.js';

test('every advertised tool exists and is ordered', () => {
  // The six the app shipped with, still in the toolbar and still first in
  // their groups; the fifteen that came after are ordered around them.
  for (const id of ['draw', 'magic-draw', 'realtouch', 'gif-animate', 'expand', 'aiscope']) {
    assert.ok(TOOL_ORDER.includes(id), `${id} left the toolbar`);
  }
  assert.equal(TOOL_ORDER.length, 23);
  assert.equal(new Set(TOOL_ORDER).size, 23, 'a tool is listed twice');
  for (const id of TOOL_ORDER) assert.ok(TOOLS[id], `${id} is missing`);
  for (const id of Object.keys(TOOLS)) assert.ok(TOOL_ORDER.includes(id), `${id} is not in the order`);
});

test('the toolbox splits on whose machine, not on whether there is a model', () => {
  // Twelve stay here and eleven do not. Imagine is the one that makes the two
  // counts disagree: it needs a model, and the model is ours and runs locally.
  assert.equal(LOCAL_TOOLS.length, 12);
  assert.equal(PARTNER_TOOLS.length, 11);
  assert.equal(LOCAL_TOOLS.length + PARTNER_TOOLS.length, TOOL_ORDER.length);
  assert.equal(LOCAL_TOOLS.includes('imagine'), true);
  assert.equal(isPartnerTool('imagine'), false, 'Imagine must never be a partner tool');
  assert.equal(TOOLS.imagine.ai, true, 'but it is still a model, and still charged');

  // A new AI tool is a partner tool unless it opts out on purpose.
  for (const id of TOOL_ORDER) {
    if (TOOLS[id].ai && TOOLS[id].partner !== false) {
      assert.equal(isPartnerTool(id), true, `${id} should default to partner`);
    }
  }

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
  for (const id of PARTNER_TOOLS) {
    const check = availability(id, 'web');
    assert.equal(check.allowed, false, `${id} should be locked on the web`);
    assert.equal(check.reason, 'web-half');
  }
  // Imagine is an AI tool that the browser build keeps, because it never
  // sends anything anywhere.
  assert.equal(availability('imagine', 'web').allowed, true);
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

test('the trial keeps the local tools and our own models, and locks the partners', () => {
  for (const id of ['draw', 'expand', 'imagine']) {
    assert.equal(availability(id, 'trial').allowed, true, `${id} must work on the trial`);
  }
  for (const id of ['magic-draw', 'realtouch', 'gif-animate']) {
    const check = availability(id, 'trial');
    assert.equal(check.allowed, false, `${id} must be locked on the trial`);
    assert.equal(check.reason, 'partner-needs-pro');
  }
  assert.equal(availability('aiscope', 'trial', { learn: false }).allowed, true, 'optical zoom stays');
  assert.equal(availability('aiscope', 'trial', { learn: true }).allowed, false, 'Learn does not');
});

test('pro unlocks everything; the trial unlocks everything that runs here', () => {
  for (const id of TOOL_ORDER) {
    assert.equal(availability(id, 'pro', { learn: true }).allowed, true, `${id} on pro`);
  }
  for (const id of LOCAL_TOOLS) {
    // Except AIScope's Learn, which is a partner call wearing a local tool's
    // clothes — the zoom is free, the asking is not.
    const params = id === 'aiscope' ? { learn: false } : {};
    assert.equal(availability(id, 'trial', params).allowed, true, `${id} on trial`);
  }
});

test('Imagine is priced by model and edition, exactly as advertised', () => {
  // These four numbers are what the app quotes, the ad states and the page
  // prints. If one of them moves, all of those are wrong until it moves back.
  assert.equal(costOf('imagine', { model: 'hazelnut-2.5', edition: 'trial' }), 25);
  assert.equal(costOf('imagine', { model: 'hazelnut-2.5', edition: 'pro' }), 0);
  assert.equal(costOf('imagine', { model: 'hazelnut-5-pro', edition: 'trial' }), 350);
  assert.equal(costOf('imagine', { model: 'hazelnut-5-pro', edition: 'pro' }), 120);

  // Paying must never cost more than not paying.
  for (const model of ['hazelnut-2.5', 'hazelnut-5-pro']) {
    const trial = costOf('imagine', { model, edition: 'trial' });
    const pro = costOf('imagine', { model, edition: 'pro' });
    assert.ok(pro <= trial, `${model} costs more on Hazelnut than on the trial`);
  }
  assert.equal(needsAi('imagine'), true);
});

test('an unknown tool is refused rather than priced', () => {
  assert.throws(() => costOf('nope'), /Unknown tool/);
  assert.equal(availability('nope', 'pro').allowed, false);
});

test('Magic Text replaces the lettering and nothing else', () => {
  assert.equal(TOOLS['magic-text'].cost, 12);
  assert.equal(costOf('magic-text'), 12);
  assert.equal(costOf('magic-text', { eco: true }), 4);
  assert.equal(needsAi('magic-text'), true);

  const prompt = transformPrompt('magic-text', { words: 'CLOSED FOR THE WINTER' });
  assert.match(prompt, /CLOSED FOR THE WINTER/);
  assert.match(prompt, /magenta/i);
  assert.match(prompt, /character for character/i);
  assert.match(prompt, /Nothing outside the magenta changes/);

  // It is a masked edit, and it is useless without words: both are refused
  // before anything is charged.
  const spec = TRANSFORMS['magic-text'];
  assert.equal(spec.needsMask, true);
  assert.equal(spec.requires.key, 'words');
});
