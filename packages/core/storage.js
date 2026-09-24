// Cloud storage: the quota, and the founder offer that sets it.
//
// ─────────────────────────────────────────────────────────────────────────────
// THERE IS NO SERVER.
//
// Nothing in this repository stores a byte for anybody. This file is the
// client's model of a quota — what the account is entitled to, how much of it
// is used, and what to say when it is full — and every app reads it so that
// they cannot each invent a different number. When there is a real backing
// store, `usedBytes` comes from it instead of from the local tally in
// store.js, and nothing else here has to change.
//
// This is said out loud for the same reason license.js says it about the
// redemption server: a quota drawn in a progress bar looks equally real
// whether or not anything is behind it, and the place to admit which it is, is
// the file that draws it.
// ─────────────────────────────────────────────────────────────────────────────
//
// Sizes are BigInt, not Number, and that is not fussiness. The founder tier is
// 48 exabytes — 4.8e19 bytes — and JavaScript's Number stops counting whole
// integers at 9.007e15. Forty-eight exabytes in a double is a number that is
// merely near the truth, and a quota that is near the truth will one day
// subtract wrongly. Everything below counts in BigInt and converts to Number
// only to draw a percentage.

/** Storage vendors count in powers of ten, so this file does too. */
const KB = 1000n;
const MB = KB * 1000n;
const GB = MB * 1000n;
const TB = GB * 1000n;
const PB = TB * 1000n;
const EB = PB * 1000n;

/** How many accounts the founder tier is open to. */
export const FOUNDER_PLACES = 50;

/** What those accounts get. */
export const FOUNDER_BYTES = 48n * EB;

/** What everybody else gets, and what the founders' tier falls back to. */
export const STANDARD_BYTES = 200n * GB;

/**
 * The end of 30 September 2026, UTC — so the offer is open *through* the last
 * day of September and shut on the 1st of October, which is what "goes down to
 * 200 GB after October 1st" means to a reader and what a deadline has to mean
 * to a clock.
 */
export const FOUNDER_ENDS = Date.UTC(2026, 8, 30, 23, 59, 59, 999);

export const TIERS = {
  founder: {
    id: 'founder',
    name: 'Founder',
    bytes: FOUNDER_BYTES,
    blurb: 'The first fifty accounts, and only those.',
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    bytes: STANDARD_BYTES,
    blurb: 'Every account opened once the founder places are gone.',
  },
};

/**
 * Is the founder tier still open?
 *
 * Two conditions, not one: the places have to be left *and* the date has to be
 * in range. Either running out closes it. Both are injected rather than read
 * from a global, so a test can stand on either side of either line without
 * touching the system clock.
 */
export function founderOpen({ taken = 0, now = Date.now() } = {}) {
  return taken < FOUNDER_PLACES && now <= FOUNDER_ENDS;
}

/** Places left, never negative. */
export function placesLeft(taken = 0) {
  return Math.max(0, FOUNDER_PLACES - taken);
}

/** Whole days left on the offer, rounded up: the last day is "1 day", not 0. */
export function daysLeft(now = Date.now()) {
  return Math.max(0, Math.ceil((FOUNDER_ENDS - now) / 86_400_000));
}

/** Why the founder tier is shut, when it is — for a banner that has to say. */
export function founderClosedBecause({ taken = 0, now = Date.now() } = {}) {
  if (founderOpen({ taken, now })) return null;
  if (taken >= FOUNDER_PLACES) return 'places';
  return 'deadline';
}

/**
 * The tier an account opened now would get.
 *
 * A founder keeps the founder quota: the deadline is on *joining*, not on
 * keeping, exactly as the fall deal's deadline is on claiming. An offer that
 * reached back and took the storage away would make it a loan.
 */
export function tierForNewAccount(opts = {}) {
  return founderOpen(opts) ? TIERS.founder : TIERS.standard;
}

export function tierById(id) {
  return TIERS[id] || TIERS.standard;
}

export function quotaBytes(tierId) {
  return tierById(tierId).bytes;
}

// ── what the apps draw ─────────────────────────────────────────────────────

const UNITS = [
  [EB, 'EB'], [PB, 'PB'], [TB, 'TB'], [GB, 'GB'], [MB, 'MB'], [KB, 'kB'],
];

/**
 * Bytes as people read them: "48 EB", "200 GB", "1.4 GB", "912 kB".
 *
 * Takes a BigInt or a Number, because callers hold both — a quota is a BigInt
 * and a file size off disk is a Number, and making every call site convert
 * would mean every call site could forget to.
 */
export function formatBytes(bytes) {
  let n = typeof bytes === 'bigint' ? bytes : BigInt(Math.max(0, Math.round(Number(bytes) || 0)));
  if (n < 0n) n = 0n;
  if (n < KB) return `${n} B`;
  for (const [unit, label] of UNITS) {
    if (n < unit) continue;
    // One decimal, computed in BigInt so the division never rounds through a
    // double: 48 EB has to print as "48 EB" and not "48.000000000000004 EB".
    const tenths = (n * 10n) / unit;
    const whole = tenths / 10n;
    const rest = tenths % 10n;
    // Above a thousand of anything there is no room for a decimal anyway, and
    // below ten the decimal is the only thing distinguishing 1.2 from 1.9.
    return rest === 0n || whole >= 100n ? `${whole} ${label}` : `${whole}.${rest} ${label}`;
  }
  return `${n} B`;
}

/** 0..1, for a bar. Number, because that is what a width wants. */
export function usedFraction(usedBytes, tierId) {
  const quota = quotaBytes(tierId);
  if (quota <= 0n) return 0;
  const used = typeof usedBytes === 'bigint' ? usedBytes : BigInt(Math.max(0, Math.round(Number(usedBytes) || 0)));
  if (used >= quota) return 1;
  // Scale before dividing: used/quota in BigInt is 0 for anything short of the
  // whole quota, which would draw an empty bar for 199 GB of 200.
  return Number((used * 1_000_000n) / quota) / 1_000_000;
}

/** Bytes left, floored at zero. */
export function remainingBytes(usedBytes, tierId) {
  const quota = quotaBytes(tierId);
  const used = typeof usedBytes === 'bigint' ? usedBytes : BigInt(Math.max(0, Math.round(Number(usedBytes) || 0)));
  return used >= quota ? 0n : quota - used;
}

/** May this account take another `bytes`? */
export function fits(usedBytes, bytes, tierId) {
  const want = typeof bytes === 'bigint' ? bytes : BigInt(Math.max(0, Math.round(Number(bytes) || 0)));
  return want <= remainingBytes(usedBytes, tierId);
}

/**
 * One line for the storage pill: "1.4 GB of 200 GB".
 *
 * On the founder tier the second half is a number nobody can picture, which is
 * the point of it, so it is printed exactly as it is rather than softened into
 * "unlimited". It is not unlimited. It is 48 exabytes.
 */
export function storageLine(usedBytes, tierId) {
  return `${formatBytes(usedBytes)} of ${formatBytes(quotaBytes(tierId))}`;
}
