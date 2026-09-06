import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.js';
import { License, LICENSE_DEFAULTS, isWellFormedKey } from '../license.js';

const DAY = 24 * 60 * 60 * 1000;

function clockedLicense(startAt = 1_700_000_000_000, product = 'hazelnut') {
  let now = startAt;
  const store = Store.memory({ ...LICENSE_DEFAULTS });
  const license = new License(store, { product, now: () => now });
  return { license, store, advance: (ms) => { now += ms; }, set: (t) => { now = t; } };
}

test('a fresh install is Free until the trial is started', () => {
  const { license } = clockedLicense();
  assert.equal(license.edition(), 'free');
  assert.equal(license.status().ai, false);
  assert.equal(license.status().trialStarted, false);
});

test('the trial unlocks the AI for exactly seven days', () => {
  const { license, advance } = clockedLicense();
  license.startTrial();
  assert.equal(license.edition(), 'trial');
  assert.equal(license.trialDaysLeft(), 7);

  advance(6 * DAY);
  assert.equal(license.edition(), 'trial');
  assert.equal(license.trialDaysLeft(), 1);

  advance(1 * DAY + 1000);
  assert.equal(license.edition(), 'free', 'day eight drops to Free');
  assert.equal(license.status().ai, false);
  assert.equal(license.status().trialUsed, true);
});

test('the trial cannot be restarted', () => {
  const { license, advance } = clockedLicense();
  license.startTrial();
  advance(8 * DAY);
  license.startTrial();
  assert.equal(license.edition(), 'free');
});

test('winding the clock back spends the trial rather than extending it', () => {
  const start = 1_700_000_000_000;
  const { license, advance, set } = clockedLicense(start);
  license.startTrial();
  advance(3 * DAY);
  license.status();          // the app checks in, recording the time it saw
  set(start - 30 * DAY);     // user rolls the system clock back a month
  const rolled = new License(license.store, { now: () => start - 30 * DAY });
  assert.equal(rolled.edition(), 'free');
});

test('a licence key promotes to pro and survives the trial expiring', () => {
  const { license, advance } = clockedLicense();
  license.startTrial();
  const activated = license.activate('hzl-a1b2c-d3e4f-g5h6j-k7m8n');
  assert.equal(activated.ok, true);
  assert.equal(license.edition(), 'pro');
  advance(90 * DAY);
  assert.equal(license.edition(), 'pro');
  assert.equal(license.status().plan.name, 'Hazelnut');
});

test('deactivating a licence after the trial falls back to Free, not to a lockout', () => {
  const { license, advance } = clockedLicense();
  license.startTrial();
  license.activate('HZL-A1B2C-D3E4F-G5H6J-K7M8N');
  advance(30 * DAY);
  license.deactivate();
  assert.equal(license.edition(), 'free');
  assert.equal(license.status().plan.name, 'Hazelnut Free');
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
