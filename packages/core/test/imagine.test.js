import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMAGE_MODELS, MODEL_ORDER, DEFAULT_MODEL,
  modelPrice, modelThinks, modelAllowed, isUnlimited, warnsUnthought,
  modelMaxEdge, modelsFor, priceLabel, UNTHOUGHT_WARNING,
} from '../models.js';
import { planImage, parse, seedFor, mulberry32 } from '../imagine-plan.js';
import { paint, fingerCount } from '../imagine-paint.js';

/* ── a canvas context that records rather than draws ─────────────────────── */

function recordingContext(width = 512, height = 512) {
  const calls = [];
  const noop = (name) => (...args) => { calls.push({ name, args }); };
  const ctx = {
    canvas: { width, height },
    filter: '',
    globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    font: '', textAlign: '', textBaseline: '',
    calls,
    names: () => calls.map((c) => c.name),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (s) => ({ width: String(s).length * 6 }),
  };
  for (const name of [
    'save', 'restore', 'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo',
    'fill', 'stroke', 'translate', 'scale', 'rotate', 'drawImage', 'fillText', 'clip',
  ]) ctx[name] = noop(name);
  return ctx;
}

/* ── the registry ────────────────────────────────────────────────────────── */

test('the two models are priced exactly as advertised', () => {
  assert.deepEqual(MODEL_ORDER, ['hazelnut-2.5', 'hazelnut-5-pro']);
  assert.equal(DEFAULT_MODEL, 'hazelnut-2.5');

  assert.equal(modelPrice('hazelnut-2.5', 'trial'), 25);
  assert.equal(modelPrice('hazelnut-2.5', 'pro'), 0);
  assert.equal(modelPrice('hazelnut-5-pro', 'trial'), 350);
  assert.equal(modelPrice('hazelnut-5-pro', 'pro'), 120);

  assert.equal(isUnlimited('hazelnut-2.5', 'pro'), true);
  assert.equal(isUnlimited('hazelnut-2.5', 'trial'), false);
  assert.equal(priceLabel('hazelnut-2.5', 'pro'), 'Unlimited');
  assert.equal(priceLabel('hazelnut-5-pro', 'trial'), '350 credits');

  // Both models run on both editions; what differs is the price and the thinking.
  for (const id of MODEL_ORDER) {
    for (const edition of ['trial', 'pro']) assert.equal(modelAllowed(id, edition), true);
  }
});

test('the browser build is priced as the trial, not as a free-for-all', () => {
  // 'web' is not a paying edition, so it must not fall through to Pro's prices.
  assert.equal(modelPrice('hazelnut-2.5', 'web'), 25);
  assert.equal(modelPrice('hazelnut-5-pro', 'web'), 350);
  assert.equal(modelThinks('hazelnut-5-pro', 'web'), false);
});

test('only 5 Pro thinks, and only on Hazelnut', () => {
  assert.equal(modelThinks('hazelnut-2.5', 'trial'), false);
  assert.equal(modelThinks('hazelnut-2.5', 'pro'), false, '2.5 never thinks, at any price');
  assert.equal(modelThinks('hazelnut-5-pro', 'trial'), false);
  assert.equal(modelThinks('hazelnut-5-pro', 'pro'), true);

  // The warning follows the model that can write but has not thought, because
  // that is the one that produces something convincing and wrong.
  assert.equal(warnsUnthought('hazelnut-5-pro', 'trial'), true);
  assert.equal(warnsUnthought('hazelnut-5-pro', 'pro'), false);
  assert.equal(warnsUnthought('hazelnut-2.5', 'trial'), false, '2.5 cannot spell, so nobody is fooled');
});

test('every model declares what it cannot do', () => {
  for (const id of MODEL_ORDER) {
    const model = IMAGE_MODELS[id];
    assert.ok(model.limits.length, `${id} claims no limits`);
    assert.ok(model.help.length > 40);
  }
  // 2.5's two headline failures are recorded as capabilities, not as prose, so
  // the renderer and the advertising read them from the same place.
  assert.equal(IMAGE_MODELS['hazelnut-2.5'].draws.text, false);
  assert.equal(IMAGE_MODELS['hazelnut-2.5'].draws.hands, false);
  assert.equal(IMAGE_MODELS['hazelnut-5-pro'].draws.text, true);
  assert.equal(IMAGE_MODELS['hazelnut-5-pro'].draws.hands, true);
});

test('modelsFor gives the picker everything it needs in one pass', () => {
  const trial = modelsFor('trial');
  assert.equal(trial.length, 2);
  assert.equal(trial[0].priceLabel, '25 credits');
  assert.equal(trial[1].warns, true);
  const pro = modelsFor('pro');
  assert.equal(pro[0].unlimited, true);
  assert.equal(pro[1].thinks, true);
});

/* ── the planner ─────────────────────────────────────────────────────────── */

test('the prompt is read, and what was not understood is reported', () => {
  const p = parse('three red balloons over a mountain lake at sunset');
  assert.deepEqual(p.objects, [{ what: 'balloon', count: 3 }]);
  assert.equal(p.terrain, 'mountains');
  assert.equal(p.time, 'golden');
  assert.deepEqual(p.ignored, [], 'nothing in this sentence should be dropped silently');

  // A generator that quietly discards half a sentence is lying about what it
  // drew, so unrecognised words come back rather than disappearing.
  const q = parse('a photorealistic bioluminescent axolotl');
  assert.ok(q.ignored.includes('axolotl'), 'an unknown subject must be reported');
});

test('quoted words are taken literally', () => {
  assert.equal(parse('a sign that says "OPEN"').title, 'OPEN');
  assert.equal(parse('a poster titled "SUMMER FETE"').title, 'SUMMER FETE');
});

test('the same prompt and seed give the same picture', () => {
  const a = planImage({ prompt: 'a cottage in the snow', model: 'hazelnut-2.5', edition: 'trial' });
  const b = planImage({ prompt: 'a cottage in the snow', model: 'hazelnut-2.5', edition: 'trial' });
  assert.deepEqual(a.layers, b.layers);
  assert.equal(a.seed, b.seed);
  assert.equal(a.seed, seedFor('a cottage in the snow'));

  const c = planImage({ prompt: 'a cottage in the snow', model: 'hazelnut-2.5', edition: 'trial', seed: 99 });
  assert.notDeepEqual(a.layers, c.layers, 'a different seed should give a different picture');
});

test('both models plan identically — every difference is the renderer', () => {
  // This is what makes a side-by-side comparison of the two models fair.
  const seed = 4242;
  const opts = { prompt: 'a cat in a field of flowers', edition: 'pro', seed };
  const small = planImage({ ...opts, model: 'hazelnut-2.5' });
  const large = planImage({ ...opts, model: 'hazelnut-5-pro' });
  assert.deepEqual(small.layers, large.layers);
});

test('a model will not render larger than its edition allows', () => {
  assert.equal(modelMaxEdge('hazelnut-5-pro', 'pro'), 2048);
  assert.equal(modelMaxEdge('hazelnut-5-pro', 'trial'), 1024);

  const big = planImage({ prompt: 'the sea', model: 'hazelnut-5-pro', edition: 'trial', width: 4000, height: 2000 });
  assert.equal(big.width, 1024);
  assert.equal(big.height, 512, 'the aspect ratio survives the clamp');
  assert.equal(big.clamped, true);
  assert.deepEqual(big.requested, { width: 4000, height: 2000 });

  const small = planImage({ prompt: 'the sea', model: 'hazelnut-5-pro', edition: 'pro', width: 800, height: 600 });
  assert.equal(small.clamped, false);
  assert.equal(small.width, 800);
});

/* ── the thinking pass, which is the whole of the trial/Pro difference ───── */

/** Re-derive an answer from the question text, with no help from the planner. */
function solve(text) {
  const m = text.match(/^(\d+) ([+−×÷]) (\d+) =$/);
  if (!m) return null;
  const a = Number(m[1]); const b = Number(m[3]);
  switch (m[2]) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? null : a / b;
    default: return null;
  }
}

test('on Hazelnut, every answer on the sheet is right', () => {
  // Checked by solving the questions again here, rather than by trusting the
  // number the planner wrote down.
  for (let seed = 0; seed < 40; seed += 1) {
    const plan = planImage({ prompt: 'a maths homework sheet', model: 'hazelnut-5-pro', edition: 'pro', seed });
    const doc = plan.layers[0].doc;
    assert.equal(plan.thought, true);
    assert.equal(plan.unverified, false);
    assert.equal(doc.questions.length, 6);
    for (const q of doc.questions) {
      const truth = solve(q.text);
      assert.notEqual(truth, null, `unsolvable question survived the planning pass: ${q.text}`);
      assert.equal(String(truth), q.answer, `${q.text} answered ${q.answer}, should be ${truth}`);
      assert.equal(q.solvable, true);
      assert.equal(q.checked, true);
    }
    assert.deepEqual(plan.warnings, []);
  }
});

test('on the trial, 5 Pro sets the sheet beautifully and gets it wrong', () => {
  let wrongAnswers = 0;
  let unsolvable = 0;
  for (let seed = 0; seed < 40; seed += 1) {
    const plan = planImage({ prompt: 'a maths homework sheet', model: 'hazelnut-5-pro', edition: 'trial', seed });
    const doc = plan.layers[0].doc;
    assert.equal(plan.thought, false);
    assert.equal(plan.unverified, true, 'an unchecked sheet must be marked as one');
    assert.ok(plan.warnings.length, 'and must say so in words');

    for (const q of doc.questions) {
      assert.equal(q.checked, false, 'nothing may claim to have been checked');
      const truth = solve(q.text);
      if (truth == null) unsolvable += 1;
      else if (String(truth) !== q.answer) wrongAnswers += 1;
    }
  }
  // The failure is the point, so it has to actually happen rather than being
  // asserted in a comment.
  assert.ok(wrongAnswers > 0, 'no wrong answers appeared — the demonstration is broken');
  assert.ok(unsolvable > 0, 'no unsolvable questions appeared');
});

test('a picture that asserts nothing carries no warning, whatever made it', () => {
  // The band is driven by the picture, not the model. A hillside from an
  // unthinking model claims nothing and must not be plastered with a notice —
  // a warning printed on everything is a warning nobody reads.
  const scene = planImage({ prompt: 'a mountain lake at sunset', model: 'hazelnut-5-pro', edition: 'trial' });
  assert.equal(scene.unverified, false);
  assert.equal(warnsUnthought(scene.model, scene.edition), true, 'the model could still mislead elsewhere');
});

/* ── the renderers ───────────────────────────────────────────────────────── */

test('Hazelnut 2.5 cannot write, structurally', () => {
  // Not "is styled so text looks wrong" — there is no path from 2.5 to a glyph.
  //
  // The one thing on the canvas that is set in a real typeface is the app's own
  // disclaimer, and that is drawn over the picture after the model has
  // finished rather than by the model. So the claim under test is narrower and
  // more useful than "never calls fillText": none of the *content* is real
  // text. 2.5 never thinks, so its worksheet is unchecked and carries the band.
  const ctx = recordingContext();
  const plan = planImage({ prompt: 'a maths homework sheet', model: 'hazelnut-2.5', edition: 'pro', width: 512, height: 512 });
  assert.equal(plan.unverified, true, '2.5 does not think, on any edition');
  paint(ctx, plan);

  const texts = ctx.calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
  const doc = plan.layers[0].doc;
  assert.equal(texts.includes(doc.title), false, '2.5 set the title in a real typeface');
  for (const q of doc.questions) {
    assert.equal(texts.some((t) => t.includes(q.text)), false, `2.5 really wrote "${q.text}"`);
  }
  // The disclaimer is wrapped, so each line is a run of words from it.
  const isDisclaimer = (t) => t === 'NOT CHECKED' || UNTHOUGHT_WARNING.includes(t);
  assert.ok(texts.every(isDisclaimer), `2.5 wrote something that was not the disclaimer: ${texts.filter((t) => !isDisclaimer(t))}`);
  assert.ok(ctx.names().includes('stroke'), 'but it did put letter-shaped marks down');
});

test('Hazelnut 5 Pro writes with a real typeface', () => {
  const ctx = recordingContext();
  const plan = planImage({ prompt: 'a maths homework sheet', model: 'hazelnut-5-pro', edition: 'pro', width: 512, height: 512 });
  paint(ctx, plan);
  const texts = ctx.calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
  assert.ok(texts.includes('Practice Sheet'), 'the title should be real text');
  for (const q of plan.layers[0].doc.questions) {
    assert.ok(texts.some((t) => String(t).includes(q.text)), `${q.text} was not drawn`);
  }
});

test('the disclaimer is drawn into the picture, not around it', () => {
  const ctx = recordingContext();
  const plan = planImage({ prompt: 'a maths homework sheet', model: 'hazelnut-5-pro', edition: 'trial', width: 512, height: 512 });
  paint(ctx, plan);
  const texts = ctx.calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
  assert.ok(texts.includes('NOT CHECKED'), 'the screenshot must carry its own warning');
  assert.ok(texts.some((t) => /not been checked/i.test(t)));
});

test('five fingers on Hazelnut 5 Pro, and not on 2.5', () => {
  const five = new Set();
  const other = new Set();
  for (let i = 0; i < 400; i += 1) {
    five.add(fingerCount('hazelnut-5-pro', mulberry32(i)));
    other.add(fingerCount('hazelnut-2.5', mulberry32(i)));
  }
  assert.deepEqual([...five], [5]);
  for (const n of other) assert.ok(n > 5, `2.5 drew ${n} fingers, which would be correct`);
});

test('both models draw every prompt without falling over', () => {
  const prompts = [
    'a mountain lake at sunset', 'a city skyline at night', 'three red balloons over the sea',
    'a cottage in the snow', 'a person waving with hands', 'a maths homework sheet',
    'a sign that says "OPEN"', 'a menu', 'a certificate', 'a dog in the fog',
    'a forest in the rain', 'the desert', '', 'zzzz qqqq',
  ];
  for (const prompt of prompts) {
    for (const model of MODEL_ORDER) {
      const ctx = recordingContext();
      const plan = planImage({ prompt, model, edition: 'pro', width: 256, height: 256 });
      assert.doesNotThrow(() => paint(ctx, plan), `${model} fell over on "${prompt}"`);
      assert.ok(ctx.calls.length > 0, `${model} drew nothing for "${prompt}"`);
    }
  }
});
