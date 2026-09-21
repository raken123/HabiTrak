// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// Pricing and plan definitions.
//
// These are the numbers the UI quotes and the paywall enforces. They live in
// one place so a price change is a one-line edit, and so the "Mini is half the
// price" rule is expressed as arithmetic rather than as two numbers that can
// drift apart.
//
// There are two editions per product and no third. Hazelnut Free has been
// removed — see license.js for why the unlimited trial replaces it rather than
// sitting alongside it.

/**
 * Credits granted once, when the trial starts, and never topped up.
 *
 * This is the whole of what limits the trial now that nothing else does, which
 * is why it is smaller than the 1,200 the seven-day trial used to grant. Read
 * against the generator it buys two pictures from Hazelnut 5 Pro at 350, or
 * twenty-eight from Hazelnut 2.5 at 25 — enough to see what both models are
 * and are not, which is what a trial is for.
 */
export const TRIAL_CREDIT_GRANT = 700;

/** Credits granted each billing period on a paid plan. */
export const PRO_MONTHLY_CREDITS = 5000;
export const MINI_MONTHLY_CREDITS = 1500;

// Squirreal's allowance is smaller than Hazelnut's on purpose: a generation is
// a clip rather than a frame, so each one costs more and fewer of them fit in a
// month. The plan is not less capable — it is priced against heavier work.
export const SQUIRREAL_MONTHLY_CREDITS = 3000;

// The trial grant follows the same logic: fewer credits than Hazelnut's, but
// enough for a few short clips.
export const SQUIRREAL_TRIAL_CREDIT_GRANT = 500;

/** Base price for the full Hazelnut desktop app, in USD. */
const HAZELNUT_MONTHLY_USD = 19.99;
const HAZELNUT_YEARLY_USD = 199.0;

const SQUIRREAL_MONTHLY_USD = 29.99;
const SQUIRREAL_YEARLY_USD = 299.0;

/** Mini is exactly half of Hazelnut, by construction. */
const half = (n) => Math.round(n * 50) / 100;

/**
 * `partnerModels` is the line the trial is drawn on. It means: may this plan
 * send a picture to somebody else's model?
 *
 * Hazelnut's own generator is not a partner model. It runs on the machine in
 * front of you, so the trial gets it in full and the browser build gets it
 * without an account.
 */
export const PLANS = {
  'hazelnut-web': {
    id: 'hazelnut-web',
    product: 'hazelnut',
    name: 'Hazelnut for the Web',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: 0,
    ai: false,
    partnerModels: false,
    blurb: 'The full editor in a browser tab, limited to the tools that need nobody else’s model — the local dozen, including Hazelnut’s own image generator. No account, no key, and nothing leaves the page.',
  },
  'hazelnut-trial': {
    id: 'hazelnut-trial',
    product: 'hazelnut',
    name: 'Hazelnut Trial',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: TRIAL_CREDIT_GRANT,
    ai: true,
    partnerModels: false,
    blurb: 'Free forever, no card, no deadline. Every local tool, plus both of Hazelnut’s own image models. The tools that call a partner model are not included.',
  },
  'hazelnut-pro': {
    id: 'hazelnut-pro',
    product: 'hazelnut',
    name: 'Hazelnut',
    monthlyUsd: HAZELNUT_MONTHLY_USD,
    yearlyUsd: HAZELNUT_YEARLY_USD,
    credits: PRO_MONTHLY_CREDITS,
    ai: true,
    partnerModels: true,
    blurb: 'Every tool, the partner models included, Hazelnut 2.5 unlimited, and a monthly credit allowance.',
  },

  // Mini used to keep its partner models on the trial, as a documented
  // exception: it was one remover and a strip of local adjustments, so
  // withholding them would have left a trial of nothing to try.
  //
  // Imagine ended that. Mini now has a model of its own that runs on the
  // phone, so the exception has lost the thing that justified it and Mini's
  // trial is Hazelnut's trial exactly: no deadline, the same opening grant,
  // every tool that runs on the device — and the partner models behind the
  // licence.
  'mini-trial': {
    id: 'mini-trial',
    product: 'mini',
    name: 'Hazelnut Mini Trial',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: TRIAL_CREDIT_GRANT,
    ai: true,
    partnerModels: false,
    blurb: 'Free forever, no card, no deadline. The tools that run on the phone, and both of Hazelnut’s own image models. The remover comes with Mini itself.',
  },
  'mini-pro': {
    id: 'mini-pro',
    product: 'mini',
    name: 'Hazelnut Mini',
    monthlyUsd: half(HAZELNUT_MONTHLY_USD),
    yearlyUsd: half(HAZELNUT_YEARLY_USD),
    credits: MINI_MONTHLY_CREDITS,
    ai: true,
    partnerModels: true,
    blurb: 'One chat bar that removes things. Half the price of Hazelnut.',
  },
  // Squirreal keeps the exception, because nothing has changed for it: every
  // AI tool it has is a video model somebody else runs, and it has no local
  // generator to fall back on. What limits its trial is the credit grant.
  'squirreal-trial': {
    id: 'squirreal-trial',
    product: 'squirreal',
    name: 'Squirreal Trial',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: SQUIRREAL_TRIAL_CREDIT_GRANT,
    ai: true,
    partnerModels: true,
    blurb: 'Every tool unlocked, no deadline, until the opening credits run out.',
  },
  'squirreal-pro': {
    id: 'squirreal-pro',
    product: 'squirreal',
    name: 'Hazelnut Squirreal',
    monthlyUsd: SQUIRREAL_MONTHLY_USD,
    yearlyUsd: SQUIRREAL_YEARLY_USD,
    credits: SQUIRREAL_MONTHLY_CREDITS,
    ai: true,
    partnerModels: true,
    blurb: 'Hazelnut, for moving pictures. The same six tools, pointed at clips.',
  },
};

export function planFor(product, edition) {
  if (product === 'mini') return PLANS[edition === 'pro' ? 'mini-pro' : 'mini-trial'];
  // The browser build is Hazelnut only, and only ever the local half.
  if (edition === 'web') return PLANS['hazelnut-web'];
  const family = product === 'squirreal' ? 'squirreal' : 'hazelnut';
  return PLANS[edition === 'pro' ? `${family}-pro` : `${family}-trial`];
}

/** May this product/edition send a picture to a partner model? */
export function allowsPartnerModels(product, edition) {
  return Boolean(planFor(product, edition)?.partnerModels);
}

export function formatUsd(n) {
  return n === 0 ? 'Free' : `$${n.toFixed(2)}`;
}
