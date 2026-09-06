// Edition and trial handling.
//
// Three editions, one lifecycle:
//
//   install ──► trial (7 days, everything unlocked)
//                 │
//                 ├── activate a licence ──► pro
//                 └── 7 days elapse ───────► free  (Hazelnut, minus the AI)
//
// Nobody is ever locked out of the app. When the trial lapses the editor keeps
// working; the tools that need a model are what stop.

import { TRIAL_DAYS, TRIAL_CREDIT_GRANT, planFor } from './pricing.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const LICENSE_DEFAULTS = {
  installedAt: null,
  trialStartedAt: null,
  licenseKey: null,
  product: 'hazelnut',
  // Set when the clock is caught going backwards, so a rolled-back system
  // clock buys one extra trial and not an unlimited supply of them.
  clockTamperedAt: null,
  lastSeenAt: null,
};

export class License {
  /**
   * @param {import('./store.js').Store} store
   * @param {{product?:'hazelnut'|'mini', now?:() => number}} opts
   */
  constructor(store, { product = 'hazelnut', now = Date.now } = {}) {
    this.store = store;
    this.now = now;
    this.product = product;
    if (!this.store.get('installedAt')) {
      this.store.update({ installedAt: this.now(), product });
    }
    this.#checkClock();
  }

  /**
   * A trial that is measured against the local clock can be extended by
   * winding that clock back. We cannot stop it, but we can notice: if we ever
   * see a timestamp earlier than the last one we recorded, the trial is
   * treated as spent.
   */
  #checkClock() {
    const now = this.now();
    const lastSeen = this.store.get('lastSeenAt');
    if (lastSeen && now < lastSeen - 5 * 60 * 1000) {
      this.store.update({ clockTamperedAt: lastSeen });
    }
    this.store.set('lastSeenAt', Math.max(now, lastSeen || 0));
  }

  /** Begin the 7-day trial. Idempotent — calling it twice does not restart it. */
  startTrial() {
    if (this.store.get('trialStartedAt')) return this.status();
    this.store.update({ trialStartedAt: this.now() });
    return this.status();
  }

  /**
   * Activate a paid licence. Keys are validated for shape here; the real
   * check belongs on the licence server, and `verifyRemote` is where that call
   * goes when there is one to make.
   */
  activate(key) {
    const normalized = String(key || '').trim().toUpperCase();
    if (!isWellFormedKey(normalized)) {
      return { ok: false, error: 'That does not look like a Hazelnut licence key.' };
    }
    this.store.update({ licenseKey: normalized });
    return { ok: true, status: this.status() };
  }

  deactivate() {
    this.store.set('licenseKey', null);
    return this.status();
  }

  /** Milliseconds left in the trial. Zero once it has run out. */
  trialRemainingMs() {
    const started = this.store.get('trialStartedAt');
    if (!started) return TRIAL_DAYS * DAY_MS;
    if (this.store.get('clockTamperedAt')) return 0;
    return Math.max(0, started + TRIAL_DAYS * DAY_MS - this.now());
  }

  trialDaysLeft() {
    return Math.ceil(this.trialRemainingMs() / DAY_MS);
  }

  /** 'pro' | 'trial' | 'free' — the single value every gate is decided on. */
  edition() {
    if (this.store.get('licenseKey')) return 'pro';
    if (!this.store.get('trialStartedAt')) return 'free';
    return this.trialRemainingMs() > 0 ? 'trial' : 'free';
  }

  status() {
    const edition = this.edition();
    const plan = planFor(this.product, edition);
    const remaining = this.trialRemainingMs();
    return {
      product: this.product,
      edition,
      plan,
      ai: plan.ai,
      trialStarted: Boolean(this.store.get('trialStartedAt')),
      trialUsed: Boolean(this.store.get('trialStartedAt')) && remaining <= 0,
      trialDaysLeft: edition === 'trial' ? this.trialDaysLeft() : 0,
      trialEndsAt: this.store.get('trialStartedAt')
        ? this.store.get('trialStartedAt') + TRIAL_DAYS * DAY_MS
        : null,
      trialCreditGrant: TRIAL_CREDIT_GRANT,
      licensed: Boolean(this.store.get('licenseKey')),
    };
  }
}

/** HZL-XXXXX-XXXXX-XXXXX-XXXXX, Crockford-ish alphabet, no ambiguous glyphs. */
const KEY_RE = /^HZL(-[0-9A-HJ-NP-Z]{5}){4}$/;

export function isWellFormedKey(key) {
  return KEY_RE.test(String(key || '').trim().toUpperCase());
}
