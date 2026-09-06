// Pricing and plan definitions.
//
// These are the numbers the UI quotes and the paywall enforces. They live in
// one place so a price change is a one-line edit, and so the "Mini is half the
// price" rule is expressed as arithmetic rather than as two numbers that can
// drift apart.

export const TRIAL_DAYS = 7;

/** Credits granted once, when the 7-day trial starts. */
export const TRIAL_CREDIT_GRANT = 1200;

/** Credits granted each billing period on a paid plan. */
export const PRO_MONTHLY_CREDITS = 5000;
export const MINI_MONTHLY_CREDITS = 1500;

/** Base price for the full Hazelnut desktop app, in USD. */
const HAZELNUT_MONTHLY_USD = 19.99;
const HAZELNUT_YEARLY_USD = 199.0;

/** Mini is exactly half of Hazelnut, by construction. */
const half = (n) => Math.round(n * 50) / 100;

export const PLANS = {
  'hazelnut-free': {
    id: 'hazelnut-free',
    product: 'hazelnut',
    name: 'Hazelnut Free',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: 0,
    ai: false,
    blurb: 'Everything in Hazelnut that does not need a model. No AI, no credits, no expiry.',
  },
  'hazelnut-trial': {
    id: 'hazelnut-trial',
    product: 'hazelnut',
    name: 'Hazelnut Trial',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: TRIAL_CREDIT_GRANT,
    ai: true,
    blurb: `Every tool unlocked for ${TRIAL_DAYS} days. No card required.`,
  },
  'hazelnut-pro': {
    id: 'hazelnut-pro',
    product: 'hazelnut',
    name: 'Hazelnut',
    monthlyUsd: HAZELNUT_MONTHLY_USD,
    yearlyUsd: HAZELNUT_YEARLY_USD,
    credits: PRO_MONTHLY_CREDITS,
    ai: true,
    blurb: 'The full editor, every tool, and a monthly credit allowance.',
  },
  'mini-trial': {
    id: 'mini-trial',
    product: 'mini',
    name: 'Hazelnut Mini Trial',
    monthlyUsd: 0,
    yearlyUsd: 0,
    credits: 300,
    ai: true,
    blurb: `${TRIAL_DAYS} days of the remover, free.`,
  },
  'mini-pro': {
    id: 'mini-pro',
    product: 'mini',
    name: 'Hazelnut Mini',
    monthlyUsd: half(HAZELNUT_MONTHLY_USD),
    yearlyUsd: half(HAZELNUT_YEARLY_USD),
    credits: MINI_MONTHLY_CREDITS,
    ai: true,
    blurb: 'One chat bar that removes things. Half the price of Hazelnut.',
  },
};

export function planFor(product, edition) {
  const key = product === 'mini'
    ? (edition === 'pro' ? 'mini-pro' : 'mini-trial')
    : (edition === 'pro' ? 'hazelnut-pro' : edition === 'trial' ? 'hazelnut-trial' : 'hazelnut-free');
  return PLANS[key];
}

export function formatUsd(n) {
  return n === 0 ? 'Free' : `$${n.toFixed(2)}`;
}
