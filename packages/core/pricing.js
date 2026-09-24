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
//
// Hazelnut is a service now, with three products on it (products.js), so the
// plans below cover Photo, Movi and Work. Squirreal's are kept and marked
// `retired`: a plan nobody can buy still has to be describable, because people
// hold it, and `planFor` still has to hand back something when their app asks
// what they have. Deleting it would turn a withdrawn product into a crash.

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
// Retired with the product; kept so existing holders can still be quoted.
export const SQUIRREAL_MONTHLY_CREDITS = 3000;
export const SQUIRREAL_TRIAL_CREDIT_GRANT = 500;

// Movi's allowance is larger than Squirreal's was, because Movi's models are
// ours and priced by the second rather than by somebody else's per-clip rate.
// Read against movi.js it buys sixty-two seconds of 3.0 Lite a month, or just
// under nineteen of 3.0 Pro.
export const MOVI_MONTHLY_CREDITS = 6000;

// Enough for two eight-second Lite clips and a little over, which is the least
// that shows what the thing does: one clip, then one extension of it.
export const MOVI_TRIAL_CREDIT_GRANT = 250;

// Work is charged in small amounts many times over — a triage is 20 — so its
// allowance is counted in tasks rather than in renders.
export const WORK_MONTHLY_CREDITS = 4000;
export const WORK_TRIAL_CREDIT_GRANT = 300;

/** Base price for the full Hazelnut desktop app, in USD. */
const HAZELNUT_MONTHLY_USD = 19.99;
const HAZELNUT_YEARLY_USD = 199.0;

const SQUIRREAL_MONTHLY_USD = 29.99;
const SQUIRREAL_YEARLY_USD = 299.0;

// Movi inherits Squirreal's price rather than raising it: the product changed
// hands, and charging the people who lost Squirreal more for its replacement
// would be a poor way to introduce it.
const MOVI_MONTHLY_USD = 29.99;
const MOVI_YEARLY_USD = 299.0;

const WORK_MONTHLY_USD = 14.99;
const WORK_YEARLY_USD = 149.0;

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

  // Movi. `partnerModels` is false on both editions and that is the headline,
  // not a footnote: every model Movi runs is ours, so the trial gets the same
  // engines the paid plan does and what separates them is the allowance.
  'movi-trial': {
    id: 'movi-trial',
    product: 'movi',
    name: 'Hazelnut Movi Trial',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: MOVI_TRIAL_CREDIT_GRANT,
    ai: true,
    partnerModels: false,
    blurb: 'All three Hazelnut 3.0 models, both modes, no deadline and no card '
      + '— until the opening credits run out.',
  },
  'movi-pro': {
    id: 'movi-pro',
    product: 'movi',
    name: 'Hazelnut Movi',
    monthlyUsd: MOVI_MONTHLY_USD,
    yearlyUsd: MOVI_YEARLY_USD,
    credits: MOVI_MONTHLY_CREDITS,
    ai: true,
    partnerModels: false,
    blurb: 'Moving pictures on Hazelnut 3.0. Simple decides for you; Advanced '
      + 'builds it eight seconds at a time.',
  },

  // Work is the one product whose trial cannot include the thing it does,
  // because the thing it does is read your mail: there is nothing to try until
  // a connector is attached, and attaching one is the decision the trial is
  // there to help you make. So the trial connects and reads, and the paid plan
  // is what keeps it running past the opening grant.
  'work-trial': {
    id: 'work-trial',
    product: 'work',
    name: 'Hazelnut Work Trial',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: WORK_TRIAL_CREDIT_GRANT,
    ai: true,
    partnerModels: true,
    blurb: 'Connect one mailbox and put it to work, no deadline and no card, '
      + 'until the opening credits run out.',
  },
  'work-pro': {
    id: 'work-pro',
    product: 'work',
    name: 'Hazelnut Work',
    monthlyUsd: WORK_MONTHLY_USD,
    yearlyUsd: WORK_YEARLY_USD,
    credits: WORK_MONTHLY_CREDITS,
    ai: true,
    partnerModels: true,
    blurb: 'Your coworker, on every mailbox and calendar you connect. It drafts '
      + 'and files; it never sends without showing you first.',
  },
};

/** Plans nobody may buy any more. Kept because people still hold them. */
export const RETIRED_PLANS = new Set(['squirreal-trial', 'squirreal-pro']);

export function isRetired(planId) {
  return RETIRED_PLANS.has(planId);
}

/** The plans a new account can actually be sold, in the order they are shown. */
export const SELLABLE_PLAN_IDS = Object.keys(PLANS)
  .filter((id) => !RETIRED_PLANS.has(id) && PLANS[id].monthlyUsd > 0);

/**
 * Which plan a product/edition pair means.
 *
 * `photo` and `hazelnut` are the same family and both resolve to it: the
 * editor was called Hazelnut for as long as Hazelnut meant the editor, and
 * every stored licence, bridge and saved preference from before the service
 * existed still says `hazelnut`. Accepting both is what stops the rename from
 * logging people out of their own app.
 */
const FAMILIES = {
  hazelnut: 'hazelnut', photo: 'hazelnut',
  mini: 'mini', movi: 'movi', work: 'work', squirreal: 'squirreal',
};

export function planFor(product, edition) {
  // The browser build is the editor only, and only ever the local half.
  if (edition === 'web') return PLANS['hazelnut-web'];
  const family = FAMILIES[product] || 'hazelnut';
  return PLANS[edition === 'pro' ? `${family}-pro` : `${family}-trial`];
}

/** May this product/edition send a picture to a partner model? */
export function allowsPartnerModels(product, edition) {
  return Boolean(planFor(product, edition)?.partnerModels);
}

export function formatUsd(n) {
  return n === 0 ? 'Free' : `$${n.toFixed(2)}`;
}
