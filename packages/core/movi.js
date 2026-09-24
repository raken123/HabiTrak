// Hazelnut Movi: the models, the two modes, and the money.
//
// Movi replaces Squirreal, and the difference that matters is whose model it
// is. Squirreal sent your frames to somebody else's video service and billed
// you for the round trip. Movi runs on Hazelnut 3.0 — ours — in three sizes.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS AND IS NOT HERE.
//
// This file is the product: which models exist, what they cost, how long a
// clip may be, how a Simple render is planned, and when credits may be handed
// back. It performs no render. The engine that would turn a plan into pixels
// is video-engine.js, and against Hazelnut 3.0 it has never run, because
// nothing in this repository hosts those models. `planSimple` returning a
// plan is not a promise that a clip comes back.
// ─────────────────────────────────────────────────────────────────────────────

/** A generation covers at most this many seconds. Advanced mode's whole unit. */
export const MAX_CLIP_SECONDS = 8;

/**
 * The 3.0 family.
 *
 * Lite and Lite Fast draw the same picture. What you buy with Fast is the
 * wait, not the quality — which is why it costs more per second and says so
 * rather than implying it looks better.
 */
export const VIDEO_MODELS = {
  'hazelnut-3.0-lite': {
    id: 'hazelnut-3.0-lite',
    name: 'Hazelnut 3.0 Lite',
    height: 720,
    creditsPerSecond: 12,
    /** Roughly how long a second of footage takes to make, in seconds. */
    secondsPerSecond: 9,
    blurb: 'The everyday model. 720p, and cheap enough to be wrong twice.',
  },
  'hazelnut-3.0-lite-fast': {
    id: 'hazelnut-3.0-lite-fast',
    name: 'Hazelnut 3.0 Lite Fast',
    height: 720,
    creditsPerSecond: 15,
    secondsPerSecond: 3,
    blurb: 'Lite, three times quicker. The same picture — you are paying for '
      + 'the wait, not the quality.',
  },
  'hazelnut-3.0-pro': {
    id: 'hazelnut-3.0-pro',
    name: 'Hazelnut 3.0 Pro',
    height: 1080,
    creditsPerSecond: 40,
    secondsPerSecond: 14,
    blurb: '1080p, and it holds a face and a camera move across the whole clip.',
  },
};

export const MODEL_ORDER = [
  'hazelnut-3.0-lite', 'hazelnut-3.0-lite-fast', 'hazelnut-3.0-pro',
];

export const DEFAULT_MODEL = 'hazelnut-3.0-lite';

export function modelFor(id) {
  return VIDEO_MODELS[id] || VIDEO_MODELS[DEFAULT_MODEL];
}

// ── the two modes ──────────────────────────────────────────────────────────

export const MODES = {
  simple: {
    id: 'simple',
    name: 'Simple',
    blurb: 'Type what you want. Movi decides how long it runs, how good it '
      + 'looks and what it costs — then makes it.',
    /** The part people need warning about, in the words the UI must use. */
    warning: 'Simple spends your credits before it asks. If the video is not '
      + 'what you wanted you can put them back.',
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    blurb: `You make ${MAX_CLIP_SECONDS}-second clips and extend them in the `
      + 'Editor. Every clip is quoted before it runs.',
    warning: null,
  },
};

export const MODE_ORDER = ['simple', 'advanced'];

// ── what a render costs ────────────────────────────────────────────────────

/** Credits for `seconds` of `modelId`. Rounded up: a part-second is a second. */
export function costOfSeconds(modelId, seconds) {
  const model = modelFor(modelId);
  const s = Math.max(1, Math.ceil(Number(seconds) || 0));
  return model.creditsPerSecond * s;
}

/** What one Advanced clip costs — the unit the Editor is built out of. */
export function costOfClip(modelId) {
  return costOfSeconds(modelId, MAX_CLIP_SECONDS);
}

/**
 * An extension is a fresh clip stitched onto the end, so it costs a fresh
 * clip. Nothing about the first one is reused, and pricing it as though it
 * were would be quoting a discount that does not exist.
 */
export const costOfExtension = costOfClip;

/** Roughly how long the render takes, in seconds, for a progress estimate. */
export function estimateSeconds(modelId, seconds) {
  return Math.round(modelFor(modelId).secondsPerSecond * Math.max(1, Math.ceil(seconds)));
}

// ── Simple mode's planner ──────────────────────────────────────────────────

/** Words that lengthen a video, and by how much. */
const LONGER = [
  [/\b(montage|story|journey|documentary|film|trailer)\b/i, 32],
  [/\b(sequence|scenes?|chapters?|tour|walkthrough)\b/i, 24],
  [/\b(long|full|extended|detailed)\b/i, 20],
];
const SHORTER = /\b(quick|short|brief|snippet|loop|gif|clip|moment|instant)\b/i;

/** Words that ask for the good model, and words that say not to bother. */
const WANTS_PRO = /\b(cinematic|film|4k|1080p?|hd|high[- ]quality|crisp|sharp|portrait|face|closeu?p|professional)\b/i;
const WANTS_DRAFT = /\b(draft|rough|sketch|test|preview|quick|fast|hurry|now)\b/i;

/** Simple never spends more than this on one render without being told to. */
export const SIMPLE_MAX_SECONDS = 32;
export const SIMPLE_DEFAULT_SECONDS = 16;

/**
 * Decide everything about a Simple render from the words alone.
 *
 * Deterministic on purpose: the same sentence has to produce the same plan and
 * therefore the same price every time, because Simple charges before it asks
 * and a price that moved between the quote and the charge would be indefensible.
 *
 * `budget` is the balance, and it is a ceiling rather than a suggestion: a plan
 * is trimmed to what the account can pay, shortest-first, and says so in
 * `trimmed`. Simple is not allowed to plan something unaffordable and then fail.
 */
export function planSimple(prompt, { budget = Infinity, model = null } = {}) {
  const text = String(prompt || '');

  let seconds = SIMPLE_DEFAULT_SECONDS;
  for (const [re, value] of LONGER) {
    if (re.test(text)) { seconds = value; break; }
  }
  if (SHORTER.test(text)) seconds = MAX_CLIP_SECONDS;
  seconds = Math.min(SIMPLE_MAX_SECONDS, seconds);

  let chosen = model;
  if (!chosen) {
    if (WANTS_DRAFT.test(text)) chosen = 'hazelnut-3.0-lite-fast';
    else if (WANTS_PRO.test(text)) chosen = 'hazelnut-3.0-pro';
    else chosen = DEFAULT_MODEL;
  }

  let cost = costOfSeconds(chosen, seconds);
  let trimmed = null;

  // Too expensive: shorten before downgrading. A shorter clip of what was
  // asked for is nearer the ask than a longer one of something cheaper.
  if (cost > budget) {
    const perSecond = modelFor(chosen).creditsPerSecond;
    const affordable = Math.floor(budget / perSecond);
    if (affordable >= MAX_CLIP_SECONDS) {
      seconds = Math.min(seconds, affordable);
      trimmed = 'shortened';
    } else if (chosen !== DEFAULT_MODEL
        && Math.floor(budget / VIDEO_MODELS[DEFAULT_MODEL].creditsPerSecond) >= MAX_CLIP_SECONDS) {
      chosen = DEFAULT_MODEL;
      seconds = Math.min(seconds, Math.floor(budget / VIDEO_MODELS[chosen].creditsPerSecond));
      trimmed = 'downgraded';
    } else {
      // Not even one clip of the cheapest model. Say so; do not plan.
      return {
        prompt: text, model: DEFAULT_MODEL, seconds: MAX_CLIP_SECONDS,
        height: modelFor(DEFAULT_MODEL).height,
        cost: costOfClip(DEFAULT_MODEL), affordable: false, trimmed: null,
        estimateSeconds: estimateSeconds(DEFAULT_MODEL, MAX_CLIP_SECONDS),
      };
    }
    cost = costOfSeconds(chosen, seconds);
  }

  return {
    prompt: text,
    model: chosen,
    seconds,
    height: modelFor(chosen).height,
    cost,
    affordable: true,
    trimmed,
    estimateSeconds: estimateSeconds(chosen, seconds),
  };
}

// ── putting the credits back ───────────────────────────────────────────────

/**
 * How long a finished Simple render may be handed back.
 *
 * There has to be a window, and it has to be written down. "You can restore
 * credits if you did not like it" with no limit is a free video service, and
 * the first person to notice would never pay for anything again. Fifteen
 * minutes is long enough to watch a thirty-second clip twice and decide.
 */
export const RESTORE_WINDOW_MS = 15 * 60 * 1000;

/**
 * May this render be restored, and if not, why not?
 *
 * The reason is returned rather than a bare false, because "you already got
 * these back" and "that was an hour ago" are different things to be told and
 * the UI should not have to guess which happened.
 */
export function restorable(render, now = Date.now()) {
  if (!render) return { ok: false, reason: 'missing' };
  if (render.mode !== 'simple') {
    return { ok: false, reason: 'advanced' };
  }
  if (render.restoredAt) return { ok: false, reason: 'already' };
  if (!render.charged) return { ok: false, reason: 'free' };
  const age = now - (render.at || 0);
  if (age > RESTORE_WINDOW_MS) return { ok: false, reason: 'expired' };
  return { ok: true, amount: render.charged, msLeft: RESTORE_WINDOW_MS - age };
}

/** The sentence to show for each refusal, in one place so they cannot drift. */
export const RESTORE_REASONS = {
  missing: 'There is nothing to put back.',
  advanced: 'Advanced quotes every clip before it runs, so there is nothing to '
    + 'put back — only Simple spends first.',
  already: 'You have already had these credits back.',
  free: 'That one did not cost anything.',
  expired: `Credits can be put back for ${RESTORE_WINDOW_MS / 60000} minutes `
    + 'after a render. That window has closed.',
};

export function restoreRefusal(reason) {
  return RESTORE_REASONS[reason] || RESTORE_REASONS.missing;
}
