// The service: products, storage, Movi's money, Work's connectors.
//
// The tests that matter most here are the ones about numbers nobody can check
// by eye — forty-eight exabytes, a quota bar at 199 GB of 200 — and the ones
// about a promise being kept: that a deadline closes an offer without taking
// back what it gave, and that a withdrawn product refuses loudly.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRODUCTS, PRODUCT_ORDER, SERVICE, isCancelled, cancellationNotice,
} from '../products.js';
import {
  FOUNDER_PLACES, FOUNDER_BYTES, STANDARD_BYTES, FOUNDER_ENDS,
  founderOpen, founderClosedBecause, placesLeft, daysLeft,
  tierForNewAccount, formatBytes, usedFraction, remainingBytes, fits,
  storageLine, quotaBytes,
} from '../storage.js';
import {
  VIDEO_MODELS, MODEL_ORDER, MAX_CLIP_SECONDS, planSimple, costOfSeconds,
  costOfClip, costOfExtension, restorable, restoreRefusal, RESTORE_WINDOW_MS,
  SIMPLE_MAX_SECONDS,
} from '../movi.js';
import {
  CONNECTORS, CONNECTOR_ORDER, TASK_ORDER, TASKS, canRun, missingLine, costOf,
} from '../work.js';
import { planFor, isRetired, SELLABLE_PLAN_IDS, PLANS } from '../pricing.js';
import { VideoClient } from '../video.js';

// ── products ───────────────────────────────────────────────────────────────

test('the service and the editor are different things with different names', () => {
  // The whole point of products.js: "Hazelnut" used to mean the editor and now
  // means the account. If these two ever return the same string, every dialog
  // that says one of them has become ambiguous.
  assert.equal(SERVICE.name, 'Hazelnut');
  assert.equal(PRODUCTS.photo.name, 'Hazelnut Photo');
  assert.notEqual(SERVICE.name, PRODUCTS.photo.name);
});

test('the three products are live and Squirreal is not among them', () => {
  assert.deepEqual(PRODUCT_ORDER, ['photo', 'movi', 'work']);
  assert.equal(isCancelled('squirreal'), true);
  for (const id of PRODUCT_ORDER) assert.equal(isCancelled(id), false);
});

test('a withdrawn product says what still works, not only that it stopped', () => {
  const notice = cancellationNotice('squirreal');
  assert.equal(notice.moveTo, 'Hazelnut Movi');
  assert.match(notice.stillWorks, /never needed a server/);
  // The bad news must not be delivered twice in one sentence.
  assert.equal(`${notice.title} ${notice.reason}`.match(/withdrawn/gi).length, 1);
});

test('there is no notice for a product that is fine', () => {
  assert.equal(cancellationNotice('photo'), null);
});

// ── storage ────────────────────────────────────────────────────────────────

test('forty-eight exabytes survives being printed', () => {
  // 4.8e19 is past Number.MAX_SAFE_INTEGER, which is the whole reason these
  // are BigInt. If this ever prints 48.000000000000004 EB, someone has put a
  // double back in.
  assert.equal(formatBytes(FOUNDER_BYTES), '48 EB');
  assert.equal(formatBytes(STANDARD_BYTES), '200 GB');
  assert.ok(Number(FOUNDER_BYTES) > Number.MAX_SAFE_INTEGER);
});

test('bytes are printed the way people read them', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(912_000), '912 kB');
  assert.equal(formatBytes(1_400_000_000), '1.4 GB');
  assert.equal(formatBytes(-5), '0 B');
});

test('the founder tier needs places left AND the date', () => {
  const inTime = Date.UTC(2026, 8, 24);
  const late = Date.UTC(2026, 9, 1);
  assert.equal(founderOpen({ taken: 0, now: inTime }), true);
  assert.equal(founderOpen({ taken: FOUNDER_PLACES, now: inTime }), false);
  assert.equal(founderOpen({ taken: 0, now: late }), false);
  // And it says which of the two shut it, because those are different facts.
  assert.equal(founderClosedBecause({ taken: FOUNDER_PLACES, now: inTime }), 'places');
  assert.equal(founderClosedBecause({ taken: 0, now: late }), 'deadline');
  assert.equal(founderClosedBecause({ taken: 0, now: inTime }), null);
});

test('the offer is open through the last day of September and shut on the first', () => {
  assert.equal(founderOpen({ now: Date.UTC(2026, 8, 30, 23, 59, 59) }), true);
  assert.equal(founderOpen({ now: FOUNDER_ENDS + 1 }), false);
  assert.equal(daysLeft(FOUNDER_ENDS), 0);
  assert.equal(daysLeft(Date.UTC(2026, 8, 24)), 7);
});

test('places left never goes negative', () => {
  assert.equal(placesLeft(0), 50);
  assert.equal(placesLeft(50), 0);
  assert.equal(placesLeft(99), 0);
});

test('a new account gets the tier the offer was open for', () => {
  assert.equal(tierForNewAccount({ taken: 0, now: Date.UTC(2026, 8, 24) }).id, 'founder');
  assert.equal(tierForNewAccount({ taken: 50, now: Date.UTC(2026, 8, 24) }).id, 'standard');
  assert.equal(tierForNewAccount({ taken: 0, now: Date.UTC(2026, 9, 2) }).id, 'standard');
});

test('the quota bar is not empty at 199 GB of 200', () => {
  // The bug this exists to prevent: BigInt division floors, so used/quota is 0
  // for everything short of the whole quota and the bar reads empty at 99.5%.
  const used = 199_000_000_000;
  assert.ok(usedFraction(used, 'standard') > 0.99);
  assert.equal(usedFraction(0, 'founder'), 0);
  assert.equal(usedFraction(STANDARD_BYTES, 'standard'), 1);
  assert.equal(usedFraction(STANDARD_BYTES * 2n, 'standard'), 1);
});

test('what is left, and what still fits', () => {
  assert.equal(remainingBytes(50_000_000_000, 'standard'), 150_000_000_000n);
  assert.equal(remainingBytes(STANDARD_BYTES * 2n, 'standard'), 0n);
  assert.equal(fits(190_000_000_000, 9_000_000_000, 'standard'), true);
  assert.equal(fits(190_000_000_000, 11_000_000_000, 'standard'), false);
  // On the founder tier essentially anything fits, which is the point of it.
  assert.equal(fits(0, quotaBytes('founder') - 1n, 'founder'), true);
});

test('the storage line does not soften 48 EB into "unlimited"', () => {
  assert.equal(storageLine(1_400_000_000, 'standard'), '1.4 GB of 200 GB');
  assert.equal(storageLine(1_400_000_000, 'founder'), '1.4 GB of 48 EB');
});

// ── Movi ───────────────────────────────────────────────────────────────────

test('all three 3.0 models exist and Fast is sold on speed, not looks', () => {
  assert.deepEqual(MODEL_ORDER,
    ['hazelnut-3.0-lite', 'hazelnut-3.0-lite-fast', 'hazelnut-3.0-pro']);
  const lite = VIDEO_MODELS['hazelnut-3.0-lite'];
  const fast = VIDEO_MODELS['hazelnut-3.0-lite-fast'];
  // Same picture …
  assert.equal(fast.height, lite.height);
  // … quicker, and dearer for it.
  assert.ok(fast.secondsPerSecond < lite.secondsPerSecond);
  assert.ok(fast.creditsPerSecond > lite.creditsPerSecond);
  assert.match(fast.blurb, /not the quality/);
});

test('an extension costs a whole clip, because it is one', () => {
  for (const id of MODEL_ORDER) {
    assert.equal(costOfExtension(id), costOfClip(id));
    assert.equal(costOfClip(id), costOfSeconds(id, MAX_CLIP_SECONDS));
  }
});

test('a part second is charged as a second', () => {
  assert.equal(costOfSeconds('hazelnut-3.0-lite', 8.1), 12 * 9);
  assert.equal(costOfSeconds('hazelnut-3.0-lite', 0), 12);
});

test('Simple gives the same sentence the same plan every time', () => {
  // It charges before it asks, so a price that moved between the quote and the
  // charge would be indefensible.
  const a = planSimple('a cat on a windowsill', { budget: 6000 });
  const b = planSimple('a cat on a windowsill', { budget: 6000 });
  assert.deepEqual(a, b);
});

test('Simple reads the prompt for length and quality', () => {
  assert.equal(planSimple('a quick loop of rain', { budget: 6000 }).seconds, MAX_CLIP_SECONDS);
  assert.equal(planSimple('a documentary about bees', { budget: 6000 }).seconds, SIMPLE_MAX_SECONDS);
  assert.equal(planSimple('a cinematic portrait', { budget: 6000 }).model, 'hazelnut-3.0-pro');
  assert.equal(planSimple('a rough draft', { budget: 6000 }).model, 'hazelnut-3.0-lite-fast');
});

test('Simple never plans something the balance cannot pay for', () => {
  const poor = planSimple('a cinematic trailer', { budget: 100 });
  assert.equal(poor.affordable, true);
  assert.ok(poor.cost <= 100, `planned ${poor.cost} on a budget of 100`);
  assert.ok(poor.trimmed);

  // And when it cannot plan anything at all it says so rather than planning
  // something it knows will fail.
  assert.equal(planSimple('anything', { budget: 20 }).affordable, false);
});

test('Simple shortens before it downgrades', () => {
  // A shorter clip of what was asked for is nearer the ask than a longer one
  // of something cheaper.
  const plan = planSimple('a cinematic montage', { budget: 640 });
  assert.equal(plan.model, 'hazelnut-3.0-pro');
  assert.equal(plan.trimmed, 'shortened');
});

test('credits come back once, inside the window, from Simple only', () => {
  const now = Date.UTC(2026, 8, 24, 12, 0, 0);
  const fresh = { mode: 'simple', charged: 192, at: now };
  assert.equal(restorable(fresh, now).ok, true);
  assert.equal(restorable(fresh, now).amount, 192);

  assert.equal(restorable({ ...fresh, restoredAt: now }, now).reason, 'already');
  assert.equal(restorable(fresh, now + RESTORE_WINDOW_MS + 1).reason, 'expired');
  assert.equal(restorable({ ...fresh, mode: 'advanced' }, now).reason, 'advanced');
  assert.equal(restorable({ ...fresh, charged: 0 }, now).reason, 'free');
  assert.equal(restorable(null, now).reason, 'missing');
});

test('every refusal has a sentence, and they differ', () => {
  const reasons = ['missing', 'advanced', 'already', 'free', 'expired'];
  const lines = reasons.map(restoreRefusal);
  for (const line of lines) assert.ok(line && line.length > 10);
  assert.equal(new Set(lines).size, reasons.length);
});

// ── Work ───────────────────────────────────────────────────────────────────

test('no task sends anything on your behalf', () => {
  // The rule the product is sold on. If a task is ever added with sends:true
  // it needs a confirmation path, and this test is where that gets noticed.
  for (const id of TASK_ORDER) assert.equal(TASKS[id].sends, false, id);
});

test('a task names every connector that would satisfy it', () => {
  assert.equal(canRun('triage', []).ok, false);
  assert.deepEqual(canRun('triage', []).missing, ['gmail', 'outlook']);
  assert.equal(canRun('triage', ['outlook']).ok, true);
  assert.equal(canRun('triage', ['outlook']).using, 'outlook');
  assert.equal(missingLine('triage', []), 'Connect Gmail or Outlook first.');
  assert.equal(missingLine('triage', ['gmail']), null);
  assert.equal(missingLine('file', []), 'Connect Google Drive first.');
});

test('every connector and task is described and priced', () => {
  for (const id of CONNECTOR_ORDER) {
    const c = CONNECTORS[id];
    assert.ok(c.name && c.vendor && c.kind && c.scopes.length, id);
  }
  for (const id of TASK_ORDER) assert.ok(costOf(id) > 0, id);
});

// ── plans ──────────────────────────────────────────────────────────────────

test('the rename does not log anybody out', () => {
  // Every stored licence from before the service existed says `hazelnut`.
  assert.equal(planFor('photo', 'pro').id, planFor('hazelnut', 'pro').id);
  assert.equal(planFor('photo', 'trial').id, 'hazelnut-trial');
});

test('Movi runs our models on both editions', () => {
  // The headline: what separates Movi's trial from its paid plan is the
  // allowance, not the engines.
  assert.equal(PLANS['movi-trial'].partnerModels, false);
  assert.equal(PLANS['movi-pro'].partnerModels, false);
  assert.ok(PLANS['movi-pro'].credits > PLANS['movi-trial'].credits);
});

test('Squirreal is retired and unsellable, but still answers', () => {
  assert.equal(isRetired('squirreal-pro'), true);
  assert.equal(isRetired('movi-pro'), false);
  assert.ok(!SELLABLE_PLAN_IDS.includes('squirreal-pro'));
  assert.ok(SELLABLE_PLAN_IDS.includes('movi-pro'));
  // A holder's app must still be able to ask what they have.
  assert.equal(planFor('squirreal', 'pro').name, 'Hazelnut Squirreal');
});

test('Squirreal refuses its own calls without opening a socket', () => {
  // The withdrawal has to be a sentence, not a timeout.
  let fetches = 0;
  const fetchImpl = async () => { fetches += 1; return { ok: true, json: async () => ({}) }; };
  const client = new VideoClient({ apiKey: 'k', product: 'squirreal', fetchImpl });
  return client.generateClip({ prompt: 'x' }).then(
    () => assert.fail('a withdrawn product generated a clip'),
    (err) => {
      assert.equal(err.code, 'PRODUCT_WITHDRAWN');
      assert.equal(err.status, 410);
      assert.equal(fetches, 0, 'it opened a socket to an account that is closed');
      assert.equal(err.notice.moveTo, 'Hazelnut Movi');
    },
  );
});
