import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.js';
import { Credits, CREDIT_DEFAULTS } from '../credits.js';

const fresh = (credits = 0) => {
  const store = Store.memory({ ...CREDIT_DEFAULTS, credits });
  return new Credits(store, { now: () => 1_000_000 });
};

test('a successful tool run is charged exactly once', async () => {
  const credits = fresh(100);
  const { result, charged, balance } = await credits.charge('realtouch', {}, async () => 'image');
  assert.equal(result, 'image');
  assert.equal(charged, 20);
  assert.equal(balance, 80);
  assert.equal(credits.balance, 80);
});

test('a failed tool run costs nothing', async () => {
  const credits = fresh(100);
  await assert.rejects(
    credits.charge('realtouch', {}, async () => { throw new Error('model exploded'); }),
    /model exploded/,
  );
  assert.equal(credits.balance, 100, 'a failed call must not move the balance');
  assert.equal(credits.history().length, 0, 'and must not write a ledger entry');
});

test('an unaffordable tool never runs the work', async () => {
  const credits = fresh(10);
  let ran = false;
  await assert.rejects(
    credits.charge('realtouch', {}, async () => { ran = true; }),
    (err) => err.code === 'INSUFFICIENT_CREDITS' && err.short === 10,
  );
  assert.equal(ran, false);
  assert.equal(credits.balance, 10);
});

test('free tools run without touching the balance or the ledger', async () => {
  const credits = fresh(0);
  const { charged } = await credits.charge('expand', {}, async () => 'expanded');
  assert.equal(charged, 0);
  assert.equal(credits.balance, 0);
  assert.equal(credits.history().length, 0);
});

test('GIF Animate is quoted at 600 for a full five seconds', async () => {
  const credits = fresh(1000);
  const { charged } = await credits.charge('gif-animate', { seconds: 5, fps: 8 }, async () => 'gif');
  assert.equal(charged, 600);
});

test('a grant is applied once, however many times it is offered', () => {
  const credits = fresh(0);
  assert.equal(credits.grant('trial', 1200).applied, true);
  assert.equal(credits.grant('trial', 1200).applied, false);
  assert.equal(credits.grant('trial', 1200).applied, false);
  assert.equal(credits.balance, 1200);
});

test('refunds return credits and are recorded', async () => {
  const credits = fresh(100);
  await credits.charge('realtouch', {}, async () => 'ok');
  assert.equal(credits.balance, 80);
  assert.equal(credits.refund('realtouch', 20, 'result discarded'), 100);
  const [latest] = credits.history();
  assert.equal(latest.type, 'refund');
  assert.equal(latest.amount, 20);
});

test('the ledger reads newest first and records the running balance', async () => {
  const credits = fresh(0);
  credits.grant('trial', 100);
  await credits.charge('realtouch', {}, async () => 'ok');
  const history = credits.history();
  assert.equal(history[0].type, 'spend');
  assert.equal(history[0].balanceAfter, 80);
  assert.equal(history[1].type, 'grant');
});
