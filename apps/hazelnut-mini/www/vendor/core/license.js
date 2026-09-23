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
import {
  OFFERS, activeOffer, offerById, offerBanner, offerPrice, appliesTo,
  isWellFormedAccessCode, normalizeAccessCode, endsOn,
} from './offers.js';

export const LICENSE_DEFAULTS = {
  installedAt: null,
  trialStartedAt: null,
  licenseKey: null,
  /** A redeemed offer: { id, code, redeemedAt }. See `redeem` below. */
  offer: null,
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
    // The two codes look nothing alike, so when somebody puts one in the other
    // box the app can say which box they want rather than "malformed".
    if (isWellFormedAccessCode(normalized)) {
      return { ok: false, error: 'That is an offer access code, not a licence key. Use “Redeem an access code”.', kind: 'access-code' };
    }
    if (!isWellFormedKey(normalized)) {
      return { ok: false, error: 'That does not look like a Hazelnut licence key.' };
    }
    this.store.update({ licenseKey: normalized });
    return { ok: true, status: this.status() };
  }

  /**
   * Redeem an offer's access code.
   *
   * The deadline is enforced here and only here, and it is a deadline on
   * claiming. An offer that has closed refuses new redemptions and says when
   * it closed; one already redeemed is unaffected by the date passing, because
   * what was bought was the app and not a month of it.
   *
   * Shape-only, exactly as `activate` is. A real redemption is a server call
   * that burns the code so it cannot be used twice, and this is where it goes.
   */
  redeem(code) {
    const normalized = normalizeAccessCode(code);
    if (isWellFormedKey(normalized)) {
      return { ok: false, error: 'That is a licence key, not an access code. Use “Enter a licence key”.', kind: 'licence-key' };
    }
    if (!isWellFormedAccessCode(normalized)) {
      return { ok: false, error: 'That does not look like an access code. They read FALL-XXXXX-XXXXX.' };
    }

    const offer = activeOffer(this.now());
    if (!offer) {
      const closed = Object.values(OFFERS).find((o) => normalized.startsWith(o.codePrefix));
      return {
        ok: false,
        error: closed
          ? `${closed.name} closed on ${endsOn(closed)}. This code can no longer be redeemed.`
          : 'There is no offer running.',
        kind: 'closed',
      };
    }

    // An offer names the plans it covers, and the fall deal covers Hazelnut
    // only. Without this, a Hazelnut voucher typed into Mini would unlock Mini
    // — the code is well formed and the offer is live, so every other check
    // here would pass it.
    const plan = planFor(this.product, 'pro');
    if (!appliesTo(plan, offer)) {
      return {
        ok: false,
        error: `${offer.name} is for Hazelnut, not ${plan.name}.`,
        kind: 'wrong-product',
      };
    }

    const already = this.store.get('offer');
    if (already) {
      return { ok: false, error: 'An offer has already been redeemed on this machine.', kind: 'already' };
    }

    this.store.update({ offer: { id: offer.id, code: normalized, redeemedAt: this.now() } });
    return { ok: true, offer, status: this.status() };
  }

  /** The offer redeemed on this machine, if any — with its definition. */
  redeemedOffer() {
    const record = this.store.get('offer');
    if (!record) return null;
    const offer = offerById(record.id);
    return offer ? { ...record, offer } : null;
  }

  /** Remove the licence *and* any redeemed offer: "this machine is not mine". */
  deactivate() {
    this.store.update({ licenseKey: null, offer: null });
    return this.status();
  }

  /** 'pro' | 'trial' — the single value every gate is decided on. */
  edition() {
    if (this.fixedEdition) return this.fixedEdition;
    // A redeemed offer is a purchase and does not lapse when the offer closes.
    if (this.store.get('offer')) return 'pro';
    return this.store.get('licenseKey') ? 'pro' : 'trial';
  }

  #redeemedSummary() {
    const record = this.redeemedOffer();
    if (!record) return null;
    const paid = offerPrice(planFor(this.product, 'pro'), record.offer);
    return {
      id: record.id,
      name: record.offer.name,
      redeemedAt: record.redeemedAt,
      discountPct: record.offer.discountPct,
      price: paid,
    };
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
      /** The live offer, priced against this product's paid plan, or null. */
      offer: offerBanner(planFor(this.product, 'pro'), this.now()),
      /** What was redeemed here, if anything — and what it cost.  */
      redeemed: this.#redeemedSummary(),
    };
  }
}

/** HZL-XXXXX-XXXXX-XXXXX-XXXXX, Crockford-ish alphabet, no ambiguous glyphs. */
const KEY_RE = /^HZL(-[0-9A-HJ-NP-Z]{5}){4}$/;

export function isWellFormedKey(key) {
  return KEY_RE.test(String(key || '').trim().toUpperCase());
}
