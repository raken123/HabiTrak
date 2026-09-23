import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFERS, activeOffer, offerById, offerPrice, offerBanner, appliesTo,
  daysLeft, endsOn, hasEnded, isWellFormedAccessCode,
} from '../offers.js';
import { PLANS } from '../pricing.js';
import { Store } from '../store.js';
import { License, LICENSE_DEFAULTS, isWellFormedKey } from '../license.js';

const FALL = OFFERS['fall-2026'];
const DURING = Date.UTC(2026, 9, 1);          // 1 October 2026
const LAST_DAY = Date.UTC(2026, 10, 13, 9);   // the morning of the 13th
const AFTER = Date.UTC(2026, 10, 14);         // the 14th

const licenseAt = (now, store = Store.memory({ ...LICENSE_DEFAULTS })) =>
  new License(store, { product: 'hazelnut', now: () => now });

test('the fall deal is the deal that was advertised', () => {
  assert.equal(FALL.discountPct, 98);
  assert.equal(FALL.headline, '98% off Hazelnut');
  assert.equal(endsOn(FALL), '13 November 2026');
  assert.deepEqual(FALL.plans, ['hazelnut-pro']);
});

test('the price is derived from the plan and the percentage, not typed', () => {
  const price = offerPrice(PLANS['hazelnut-pro'], FALL);
  // 2% of $19.99 and of $199.00, to the cent.
  assert.equal(price.monthlyUsd, 0.4);
  assert.equal(price.yearlyUsd, 3.98);
  assert.equal(price.wasMonthlyUsd, 19.99);
  assert.equal(price.savedMonthlyUsd, 19.59);

  // The claim on the banner has to be the arithmetic the banner shows.
  const payable = price.monthlyUsd / price.wasMonthlyUsd;
  assert.ok(Math.abs((1 - payable) * 100 - FALL.discountPct) < 0.5,
    `the discount shown (${FALL.discountPct}%) is not the discount charged`);
});

test('it applies to Hazelnut and not to the others', () => {
  assert.equal(appliesTo(PLANS['hazelnut-pro'], FALL), true);
  for (const id of ['mini-pro', 'squirreal-pro', 'hazelnut-trial']) {
    assert.equal(appliesTo(PLANS[id], FALL), false, `${id} should not be in this offer`);
    assert.equal(offerPrice(PLANS[id], FALL), null);
  }
});

test('the deadline is a real boundary', () => {
  assert.equal(activeOffer(DURING)?.id, 'fall-2026');
  assert.equal(activeOffer(LAST_DAY)?.id, 'fall-2026', 'the 13th is still in the offer');
  assert.equal(activeOffer(AFTER), null);
  assert.equal(hasEnded(FALL, LAST_DAY), false);
  assert.equal(hasEnded(FALL, AFTER), true);

  // The last day counts as one day left, not none.
  assert.equal(daysLeft(FALL, LAST_DAY), 1);
  assert.equal(daysLeft(FALL, AFTER), 0);
  assert.equal(daysLeft(FALL, DURING), 44);
});

test('the banner says less when there is less to say', () => {
  assert.equal(offerBanner(PLANS['hazelnut-pro'], DURING).urgent, false);
  assert.equal(offerBanner(PLANS['hazelnut-pro'], LAST_DAY).urgent, true);
  assert.equal(offerBanner(PLANS['hazelnut-pro'], AFTER), null);
  assert.equal(offerBanner(PLANS['mini-pro'], DURING), null, 'Mini is not in this offer');
});

test('an access code and a licence key can never be mistaken for each other', () => {
  const codes = ['FALL-A1B2C-D3E4F', 'fall-a1b2c-d3e4f', 'FALL-11111-22222'];
  const keys = ['HZL-A1B2C-D3E4F-G5H6J-K7M8N', 'hzl-a1b2c-d3e4f-g5h6j-k7m8n'];

  for (const code of codes) {
    assert.equal(isWellFormedAccessCode(code), true, `${code} should be a code`);
    assert.equal(isWellFormedKey(code), false, `${code} must not pass as a licence key`);
  }
  for (const key of keys) {
    assert.equal(isWellFormedKey(key), true, `${key} should be a key`);
    assert.equal(isWellFormedAccessCode(key), false, `${key} must not pass as an access code`);
  }

  // The same alphabet rule: I, O and U are out.
  assert.equal(isWellFormedAccessCode('FALL-AIB2C-D3E4F'), false);
  assert.equal(isWellFormedAccessCode('FALL-A1B2C'), false, 'two groups, not one');
  assert.equal(isWellFormedAccessCode('FALL-A1B2C-D3E4F-G5H6J'), false, 'two groups, not three');
});

test('redeeming during the offer buys the app', () => {
  const license = licenseAt(DURING);
  assert.equal(license.edition(), 'trial');

  const result = license.redeem('fall-a1b2c-d3e4f');
  assert.equal(result.ok, true);
  assert.equal(license.edition(), 'pro');

  const redeemed = license.status().redeemed;
  assert.equal(redeemed.id, 'fall-2026');
  assert.equal(redeemed.discountPct, 98);
  assert.equal(redeemed.price.monthlyUsd, 0.4);
});

test('the deadline is on claiming, not on keeping', () => {
  // This is the rule the whole offer hangs on: redeem it in October and it is
  // still yours in December. An offer that expired what it sold would be a
  // rental, and it is not sold as one.
  const store = Store.memory({ ...LICENSE_DEFAULTS });
  assert.equal(licenseAt(DURING, store).redeem('FALL-A1B2C-D3E4F').ok, true);

  const later = licenseAt(AFTER, store);
  assert.equal(later.edition(), 'pro', 'the offer closing took the app away');
  assert.equal(later.status().offer, null, 'but the banner is gone');
  assert.equal(later.status().redeemed.id, 'fall-2026');
});

test('a closed offer refuses new codes, and says when it closed', () => {
  const late = licenseAt(AFTER);
  const result = late.redeem('FALL-A1B2C-D3E4F');
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'closed');
  assert.match(result.error, /13 November 2026/);
  assert.equal(late.edition(), 'trial', 'a refused redemption must not let anyone in');
});

test('a Hazelnut voucher does not unlock Mini or Squirreal', () => {
  // Everything else about the code is fine — well formed, offer live — so only
  // the plan check stands between a Hazelnut deal and a free copy of Mini.
  for (const product of ['mini', 'squirreal']) {
    const license = new License(Store.memory({ ...LICENSE_DEFAULTS }), { product, now: () => DURING });
    const result = license.redeem('FALL-A1B2C-D3E4F');
    assert.equal(result.ok, false, `${product} accepted a Hazelnut voucher`);
    assert.equal(result.kind, 'wrong-product');
    assert.match(result.error, /for Hazelnut/);
    assert.equal(license.edition(), 'trial');
    assert.equal(license.status().offer, null, `${product} should not advertise this offer`);
  }
});

test('an offer is redeemed once', () => {
  const license = licenseAt(DURING);
  assert.equal(license.redeem('FALL-A1B2C-D3E4F').ok, true);
  const again = license.redeem('FALL-99999-88888');
  assert.equal(again.ok, false);
  assert.equal(again.kind, 'already');
});

test('each box says which box the other code belongs in', () => {
  const license = licenseAt(DURING);

  const wrongWay = license.redeem('HZL-A1B2C-D3E4F-G5H6J-K7M8N');
  assert.equal(wrongWay.ok, false);
  assert.equal(wrongWay.kind, 'licence-key');
  assert.match(wrongWay.error, /licence key/i);

  const otherWay = license.activate('FALL-A1B2C-D3E4F');
  assert.equal(otherWay.ok, false);
  assert.equal(otherWay.kind, 'access-code');
  assert.match(otherWay.error, /access code/i);

  assert.equal(license.edition(), 'trial', 'neither mistake may unlock anything');
});

test('malformed codes are refused and explain the shape', () => {
  const license = licenseAt(DURING);
  for (const bad of ['', 'nope', 'FALL', 'FALL-A1B2C', 'FALL-AIB2C-D3E4F']) {
    const result = license.redeem(bad);
    assert.equal(result.ok, false, `${bad} should not redeem`);
    assert.match(result.error, /FALL-XXXXX-XXXXX/);
  }
  assert.equal(license.edition(), 'trial');
});

test('deactivating hands the machine back, offer included', () => {
  const license = licenseAt(DURING);
  license.redeem('FALL-A1B2C-D3E4F');
  assert.equal(license.edition(), 'pro');

  license.deactivate();
  assert.equal(license.edition(), 'trial');
  assert.equal(license.status().redeemed, null);
  assert.equal(license.redeemedOffer(), null);
});

test('offerById is honest about what it does not have', () => {
  assert.equal(offerById('fall-2026').id, 'fall-2026');
  assert.equal(offerById('spring-1999'), null);
});
