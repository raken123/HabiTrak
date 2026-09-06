// AI credits.
//
// Two rules the rest of the app relies on:
//
//   1. Nothing is charged until a tool has actually produced a result. A model
//      call that fails costs the user nothing.
//   2. Every movement is written to a ledger, so "where did my credits go" has
//      an answer in the UI rather than in a support ticket.

import { costOf } from './tools.js';

export const CREDIT_DEFAULTS = {
  credits: 0,
  ledger: [],
  grants: {},          // grantId -> timestamp, so a grant is never applied twice
};

const LEDGER_LIMIT = 500;

export class Credits {
  /**
   * @param {import('./store.js').Store} store
   * @param {{now?:() => number}} opts
   */
  constructor(store, { now = Date.now } = {}) {
    this.store = store;
    this.now = now;
  }

  get balance() {
    return Number(this.store.get('credits', 0)) || 0;
  }

  /**
   * Add credits once and only once. `grantId` makes this safe to call on every
   * launch — "the trial grant" is applied the first time and ignored after.
   */
  grant(grantId, amount, note = '') {
    const grants = this.store.get('grants', {});
    if (grants[grantId]) return { applied: false, balance: this.balance };
    grants[grantId] = this.now();
    this.store.update({
      grants,
      credits: this.balance + amount,
    });
    this.#log({ type: 'grant', amount, note: note || grantId, id: grantId });
    return { applied: true, balance: this.balance };
  }

  /** Can this tool run right now, at these parameters? */
  canAfford(toolId, params = {}) {
    const cost = costOf(toolId, params);
    return { ok: this.balance >= cost, cost, balance: this.balance, short: Math.max(0, cost - this.balance) };
  }

  /**
   * Run `work`, and charge for it only if it resolves. `work` is handed the
   * quoted cost so a tool can bail out early if it disagrees with the quote.
   *
   * @template T
   * @param {string} toolId
   * @param {object} params
   * @param {(cost:number) => Promise<T>} work
   * @returns {Promise<{result:T, charged:number, balance:number}>}
   */
  async charge(toolId, params, work) {
    const { ok, cost, balance, short } = this.canAfford(toolId, params);
    if (!ok) {
      const err = new Error(`Not enough credits: ${toolId} costs ${cost}, you have ${balance}.`);
      err.code = 'INSUFFICIENT_CREDITS';
      err.cost = cost;
      err.balance = balance;
      err.short = short;
      throw err;
    }

    const result = await work(cost);

    // Only now, with a result in hand, does the balance move.
    if (cost > 0) {
      this.store.set('credits', this.balance - cost);
      this.#log({ type: 'spend', amount: -cost, note: toolId, tool: toolId });
    }
    return { result, charged: cost, balance: this.balance };
  }

  /** Hand credits back — used when a result is discarded before it is applied. */
  refund(toolId, amount, note = 'refund') {
    if (amount <= 0) return this.balance;
    this.store.set('credits', this.balance + amount);
    this.#log({ type: 'refund', amount, note, tool: toolId });
    return this.balance;
  }

  history(limit = 50) {
    return this.store.get('ledger', []).slice(-limit).reverse();
  }

  #log(entry) {
    const ledger = this.store.get('ledger', []);
    ledger.push({ ...entry, at: this.now(), balanceAfter: this.balance });
    this.store.set('ledger', ledger.slice(-LEDGER_LIMIT));
  }
}
