// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// Edition and trial handling.
//
// Two editions, one step between them:
//
//   install ──► trial ──── activate a licence ────► pro
//               (forever)
//
// There used to be a third. Hazelnut Free was what you fell into when the
// seven-day trial ran out: the whole editor, minus everything that needed a
// model. It existed to keep the promise that nobody is ever locked out of
// their own pictures.
//
// The trial now keeps that promise better, so Free is gone and is not coming
// back. It does not expire. It carries a fixed grant of credits that is never
// topped up, and when those are spent the local tools carry on exactly as they
// always did — which is precisely what Free was. What the trial adds is that
// Hazelnut's own image models run on it, because they run on your machine and
// cost us nothing to let you have.
//
// What the trial does not get is the partner models. Every tool that sends a
// picture to Gemini is Hazelnut proper, because every one of those calls is a
// bill somebody has to pay.
//
// Removing the deadline also removed the only reason this file ever watched
// the system clock. A trial measured against a local clock can be extended by
// winding that clock back, so there used to be a check here that noticed time
// going backwards and treated the trial as spent. A trial with no end has
// nothing to steal, so the check — and the false positives it gave people who
// travel — is deleted rather than disabled.

import { TRIAL_CREDIT_GRANT, planFor } from './pricing.js';

export const LICENSE_DEFAULTS = {
  installedAt: null,
  trialStartedAt: null,
  licenseKey: null,
  product: 'hazelnut',
};

export class License {
  /**
   * @param {import('./store.js').Store} store
   * @param {{product?:'hazelnut'|'mini'|'squirreal', now?:() => number,
   *          fixedEdition?:string}} opts
   */
  constructor(store, { product = 'hazelnut', now = Date.now, fixedEdition = null } = {}) {
    this.store = store;
    this.now = now;
    this.product = product;
    // A build that is one edition and can never be another — the browser one,
    // which has no licence to activate.
    this.fixedEdition = fixedEdition;
    if (!this.store.get('installedAt')) {
      this.store.update({ installedAt: this.now(), product });
    }
  }

  /**
   * Record that the trial has begun, so the opening credit grant can be handed
   * out exactly once. Idempotent, and no longer load-bearing for the edition:
   * an install that never calls this is on the trial anyway.
   */
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

  /** 'pro' | 'trial' — the single value every gate is decided on. */
  edition() {
    if (this.fixedEdition) return this.fixedEdition;
    return this.store.get('licenseKey') ? 'pro' : 'trial';
  }

  status() {
    const edition = this.edition();
    const plan = planFor(this.product, edition);
    return {
      product: this.product,
      edition,
      plan,
      ai: plan.ai,
      /** The partner models — everything that leaves the machine. Pro only. */
      partnerModels: plan.partnerModels,
      trialStarted: Boolean(this.store.get('trialStartedAt')),
      /** Kept, and always null: there is no date on which the trial stops. */
      trialEndsAt: null,
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
