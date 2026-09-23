// Offers.
//
// A deal is a price and a deadline, and both are easy to get quietly wrong: a
// discount typed into a banner drifts from the one the app charges, and a
// deadline written as prose ("ends in three days!") is still there in March.
// So an offer is declared once, here, and everything that shows or applies it
// reads from this file.
//
// Two rules the rest of the code leans on:
//
//   1. The deadline is on *claiming*, not on keeping. Redeem the fall deal and
//      it is yours; when the offer closes on the 13th it stops being
//      redeemable and does not reach back and take the app away. A deadline
//      that did that would make this a rental, and it is not sold as one.
//
//   2. An access code is not a licence key. They have different shapes and
//      different validators, and neither will accept the other's input — a
//      test holds them to that. Entering a voucher in the licence box should
//      say "that is an access code", not "that is malformed".
//
// What this file will not do is pretend the code was checked. `isWellFormed`
// is a shape test and nothing more, exactly as `License.activate` is: there is
// no redemption server here, so a well-formed code is accepted. When there is
// one, `redeem` in license.js is where that call belongs. Saying so is
// cheaper than discovering it.

/** The end of 13 November 2026, UTC. Deadlines without a zone are arguments. */
const FALL_ENDS = Date.UTC(2026, 10, 13, 23, 59, 59, 999);

export const OFFERS = {
  'fall-2026': {
    id: 'fall-2026',
    name: 'The fall deal',
    /** 98 means 98% off. The payable fraction is derived, never typed twice. */
    discountPct: 98,
    endsAt: FALL_ENDS,
    /** Which plans it applies to. Mini and Squirreal are not in this one. */
    plans: ['hazelnut-pro'],
    headline: '98% off Hazelnut',
    /** Shown wherever the offer is offered. */
    blurb: 'Hazelnut, for two percent of the usual price. You will need an access code.',
    /** FALL-XXXXX-XXXXX — the same unambiguous alphabet the licence keys use. */
    codePrefix: 'FALL',
  },
};

/** No ambiguous glyphs: I, O and U are out so nobody mistypes 1, 0 or V. */
const CODE_RE = /^FALL(-[0-9A-HJ-NP-Z]{5}){2}$/;

export function isWellFormedAccessCode(code) {
  return CODE_RE.test(String(code || '').trim().toUpperCase());
}

export function normalizeAccessCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Which offer, if any, is running right now.
 *
 * `now` is injected rather than read, so the tests can stand on either side of
 * the deadline without touching the system clock.
 */
export function activeOffer(now = Date.now()) {
  for (const offer of Object.values(OFFERS)) {
    if (now <= offer.endsAt) return offer;
  }
  return null;
}

export function offerById(id) {
  return OFFERS[id] || null;
}

export function hasEnded(offer, now = Date.now()) {
  return !offer || now > offer.endsAt;
}

/** Whole days left, rounded up: the last day is "1 day left", not "0". */
export function daysLeft(offer, now = Date.now()) {
  if (!offer) return 0;
  return Math.max(0, Math.ceil((offer.endsAt - now) / 86_400_000));
}

/** "13 November 2026", in the one place that decides how a date is written. */
export function endsOn(offer) {
  if (!offer) return '';
  return new Date(offer.endsAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/**
 * What a plan costs under an offer.
 *
 * Both figures come out of the plan's own price and the offer's own
 * percentage. Neither is written down anywhere else, so the banner, the
 * dialog and the download page cannot disagree with each other — and a change
 * to the discount moves all three.
 */
export function offerPrice(plan, offer) {
  if (!plan || !offer || !appliesTo(plan, offer)) return null;
  const payable = (1 - offer.discountPct / 100);
  const money = (n) => Math.round(n * payable * 100) / 100;
  return {
    monthlyUsd: money(plan.monthlyUsd),
    yearlyUsd: money(plan.yearlyUsd),
    wasMonthlyUsd: plan.monthlyUsd,
    wasYearlyUsd: plan.yearlyUsd,
    savedMonthlyUsd: Math.round((plan.monthlyUsd - money(plan.monthlyUsd)) * 100) / 100,
    discountPct: offer.discountPct,
  };
}

export function appliesTo(plan, offer) {
  if (!plan || !offer) return false;
  return offer.plans.includes(plan.id);
}

/**
 * Everything a banner needs, or null when there is nothing to say.
 *
 * Returning one object rather than five loose values keeps the three UIs that
 * draw this banner from each deciding for themselves what "nearly over" means.
 */
export function offerBanner(plan, now = Date.now()) {
  const offer = activeOffer(now);
  if (!offer || !appliesTo(plan, offer)) return null;
  const left = daysLeft(offer, now);
  return {
    id: offer.id,
    name: offer.name,
    headline: offer.headline,
    blurb: offer.blurb,
    price: offerPrice(plan, offer),
    endsAt: offer.endsAt,
    endsOn: endsOn(offer),
    daysLeft: left,
    /** The last week is the only thing that earns a louder banner. */
    urgent: left <= 7,
  };
}
