import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.js';
import { License, LICENSE_DEFAULTS, isWellFormedKey } from '../license.js';
import { PLANS } from '../pricing.js';
import { EDITIONS, availability } from '../tools.js';

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;

function clockedLicense(startAt = 1_700_000_000_000, product = 'hazelnut') {
  let now = startAt;
  const store = Store.memory({ ...LICENSE_DEFAULTS });
  const license = new License(store, { product, now: () => now });
  return { license, store, advance: (ms) => { now += ms; }, set: (t) => { now = t; } };
}

test('Free is gone, and not hiding anywhere', () => {
  assert.equal(EDITIONS.includes('free'), false, 'free is still an edition');
  for (const id of Object.keys(PLANS)) {
    assert.doesNotMatch(id, /free/, `${id} is still a plan`);
  }
  // The gate must not have a branch for it either: asking about an edition
  // that no longer exists is an unknown edition, not a silent pass.
  assert.equal(availability('erase', 'free').allowed, false);
  assert.equal(availability('erase', 'free').reason, 'unlicensed');
});

test('a fresh install is already on the trial, with the AI switched on', () => {
  const { license } = clockedLicense();
  assert.equal(license.edition(), 'trial');
  assert.equal(license.status().ai, true);
  assert.equal(license.status().trialStarted, false, 'the grant has not been claimed yet');
  assert.equal(license.status().partnerModels, false);
});

test('the trial has no end date, however long you leave it', () => {
  const { license, advance } = clockedLicense();
  license.startTrial();
  assert.equal(license.edition(), 'trial');
  assert.equal(license.status().trialEndsAt, null);

  advance(10 * YEAR);
  assert.equal(license.edition(), 'trial', 'ten years later it is still the trial');
  assert.equal(license.status().ai, true);
});

test('winding the clock back does nothing, because there is nothing left to steal', () => {
  const start = 1_700_000_000_000;
  const { license, advance, set } = clockedLicense(start);
  license.startTrial();
  advance(3 * DAY);
  license.status();
  set(start - 30 * DAY);
  const rolled = new License(license.store, { now: () => start - 30 * DAY });
  assert.equal(rolled.edition(), 'trial', 'no deadline, so no penalty for moving the clock');
  assert.equal(rolled.status().ai, true);
});

test('the trial keeps what runs here and not what runs elsewhere', () => {
  const { license } = clockedLicense();
  license.startTrial();
  const edition = license.edition();

  // Ours.
  assert.equal(availability('imagine', edition, { model: 'hazelnut-2.5' }).allowed, true);
  assert.equal(availability('imagine', edition, { model: 'hazelnut-5-pro' }).allowed, true);
  assert.equal(availability('levels', edition).allowed, true);

  // Somebody else's.
  for (const id of ['realtouch', 'erase', 'sky', 'caption', 'magic-text']) {
    const check = availability(id, edition);
    assert.equal(check.allowed, false, `${id} should need the licence`);
    assert.equal(check.reason, 'partner-needs-pro');
    assert.match(check.message, /partner model/);
  }
});

test('a licence key promotes to pro and unlocks the partner models', () => {
  const { license, advance } = clockedLicense();
  license.startTrial();
  const activated = license.activate('hzl-a1b2c-d3e4f-g5h6j-k7m8n');
  assert.equal(activated.ok, true);
  assert.equal(license.edition(), 'pro');
  assert.equal(license.status().partnerModels, true);
  assert.equal(availability('realtouch', 'pro').allowed, true);

  advance(90 * DAY);
  assert.equal(license.edition(), 'pro');
  assert.equal(license.status().plan.name, 'Hazelnut');
});

test('deactivating a licence falls back to the trial, never to a lockout', () => {
  const { license, advance } = clockedLicense();
  license.startTrial();
  license.activate('HZL-A1B2C-D3E4F-G5H6J-K7M8N');
  advance(30 * DAY);
  license.deactivate();
  assert.equal(license.edition(), 'trial');
  assert.equal(license.status().plan.name, 'Hazelnut Trial');
  assert.equal(license.status().ai, true, 'the editor and our own models keep working');
});

test('malformed keys are rejected', () => {
  const { license } = clockedLicense();
  for (const bad of ['', 'ABC', 'HZL-12345', 'XYZ-A1B2C-D3E4F-G5H6J-K7M8N', 'HZL-A1B2C-D3E4F-G5H6J-K7M8NO']) {
    assert.equal(license.activate(bad).ok, false, `${bad} should not activate`);
  }
  // I, L, O and U are excluded so nobody mistypes them for 1, 0 or V.
  assert.equal(isWellFormedKey('HZL-AIB2C-D3E4F-G5H6J-K7M8N'), false);
  assert.equal(isWellFormedKey('HZL-A1B2C-D3E4F-G5H6J-K7M8N'), true);
});

test('Mini reports Mini pricing, at half of Hazelnut', () => {
  const { license } = clockedLicense(1_700_000_000_000, 'mini');
  license.startTrial();
  license.activate('HZL-A1B2C-D3E4F-G5H6J-K7M8N');
  const status = license.status();
  assert.equal(status.plan.id, 'mini-pro');
  assert.equal(status.plan.monthlyUsd, 9.99);
});

test('Mini and Squirreal keep their partner models on the trial', () => {
  // They have no local AI to fall back on, so withholding it would leave a
  // trial of nothing. This is a deliberate exception to Hazelnut's rule.
  for (const product of ['mini', 'squirreal']) {
    const { license } = clockedLicense(1_700_000_000_000, product);
    license.startTrial();
    assert.equal(license.status().partnerModels, true, `${product} lost its trial`);
  }
});

test('the browser build is one edition and stays there', () => {
  const store = Store.memory({ ...LICENSE_DEFAULTS, licenseKey: 'HZL-AAAAA-BBBBB-CCCCC-DDDDD' });
  const license = new License(store, { product: 'hazelnut', fixedEdition: 'web' });

  assert.equal(license.edition(), 'web');
  assert.equal(license.status().plan.id, 'hazelnut-web');
  assert.equal(license.status().ai, false);

  license.startTrial();
  assert.equal(license.edition(), 'web', 'starting a trial cannot change it');

  // But the generator is ours and runs in the page, so the browser gets it.
  assert.equal(availability('imagine', 'web').allowed, true);
  assert.equal(availability('erase', 'web').allowed, false);
});
