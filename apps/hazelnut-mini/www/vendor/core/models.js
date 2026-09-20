// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// Hazelnut's own image models.
//
// Everything else in this app is a partner model: a picture goes up to Gemini,
// a picture comes back. These two are ours, and they are a different kind of
// thing — they run on the machine in front of you. No key, no account, no
// upload, no network. A prompt goes in and pixels come out of your own CPU.
//
// That is worth being precise about, because "image AI" has come to mean one
// specific thing and this is not it. There is no diffusion model in here and
// no weights to download. Hazelnut 2.5 and Hazelnut 5 Pro are *synthesisers*:
// they read a prompt, decide what is in the picture, and draw it. The whole
// pipeline is in imagine-plan.js (what to draw) and imagine-paint.js (drawing
// it), and you can read all of it in an afternoon.
//
// What you give up is obvious and large: they can only draw things they know
// how to draw. What you get is that they are free of the two costs that make
// the rest of the toolbox expensive — somebody else's datacentre, and your
// photographs leaving your machine.
//
//
// The two of them
// ───────────────
//
// Hazelnut 2.5 is the old one and it looks like it. Everything it draws is
// built out of soft overlapping blobs, so the result is round and rubbery in a
// way that reads instantly as machine-made. It has no glyph engine and no hand
// model, which is not an oversight — those were the two things 2.5 could never
// do, and the shipped model still cannot. It writes letter-shaped marks that
// are not letters, and it draws hands with the wrong number of fingers.
//
// Hazelnut 5 Pro is the new one. Real geometry, real type, and a hand that has
// five fingers because the hand model counts them. It also *thinks* before it
// draws: a planning pass that works out what the picture actually has to be
// right about, and checks it.
//
// The thinking is the part that is held back. On the trial, 5 Pro draws but
// does not think, and the failure mode is specific and worth naming: ask it
// for a worksheet and the typography is immaculate, the layout is convincing,
// and the arithmetic is wrong. Some of the questions cannot be solved at all.
// It looks more correct than 2.5 while being less correct, which is the most
// dangerous thing a generator can do — so the app labels it, every time, on
// the picture itself. See `WARNS_UNTHOUGHT` below and the banner it drives.

/**
 * `price` is per generation, in credits, per edition. Zero means the model is
 * unlimited on that edition — not that the generation is skipped.
 *
 * `null` means the model will not run on that edition at all.
 */
export const IMAGE_MODELS = {
  'hazelnut-2.5': {
    id: 'hazelnut-2.5',
    name: 'Hazelnut 2.5',
    tagline: 'Soft, round and unmistakably generated. Unlimited once you are paying.',
    generation: 2.5,
    price: { trial: 25, pro: 0 },
    maxEdge: { trial: 1024, pro: 1536 },
    // What the renderer is actually capable of. These drive both the pictures
    // and the warnings, so the two can never disagree.
    draws: { text: false, hands: false, thinks: false },
    limits: [
      'Cannot write. Letters come out as letter-shaped marks.',
      'Cannot draw hands. Expect the wrong number of fingers.',
      'Everything is built from blobs, so nothing has a hard edge.',
    ],
    help: 'The first Hazelnut model. It composes a picture out of soft overlapping shapes, which gives it a consistent, slightly rubbery look — pleasant for scenery and hopeless for anything that needs a straight line. Twenty-five credits on the trial; unlimited on Hazelnut.',
  },

  'hazelnut-5-pro': {
    id: 'hazelnut-5-pro',
    name: 'Hazelnut 5 Pro',
    tagline: 'Real edges, real type, real hands. It only thinks on Hazelnut.',
    generation: 5,
    price: { trial: 350, pro: 120 },
    maxEdge: { trial: 1024, pro: 2048 },
    draws: { text: true, hands: true, thinks: 'pro-only' },
    limits: [
      'On the trial it does not think: text is rendered perfectly and can still be wrong.',
      'Still a synthesiser — it draws from a library of things it knows, not from photographs.',
    ],
    help: 'The current model. Hard edges, a real typeface, and a hand that is counted rather than guessed. On Hazelnut it plans the picture before drawing it and checks anything it claims to be a fact; on the trial it skips that step, so a worksheet will be beautifully set and wrong. Three hundred and fifty credits on the trial, a hundred and twenty on Hazelnut.',
  },
};

export const MODEL_ORDER = ['hazelnut-2.5', 'hazelnut-5-pro'];

/** The one the picker opens on. The cheap one, on every edition. */
export const DEFAULT_MODEL = 'hazelnut-2.5';

/**
 * What one generation costs on this edition. Zero is a real answer — it means
 * unlimited, and `isUnlimited` is how you tell that apart from "not allowed".
 */
export function modelPrice(modelId, edition = 'trial') {
  const model = IMAGE_MODELS[modelId];
  if (!model) throw new Error(`Unknown image model: ${modelId}`);
  const price = model.price[normalizeEdition(edition)];
  return price == null ? null : price;
}

export function isUnlimited(modelId, edition = 'trial') {
  return modelPrice(modelId, edition) === 0;
}

export function modelAllowed(modelId, edition = 'trial') {
  return modelPrice(modelId, edition) != null;
}

/**
 * Does this model plan the picture before it draws it, on this edition?
 *
 * This is the single source of truth for the trial/Pro difference in 5 Pro. The
 * generator reads it to decide whether to run the planning pass, the UI reads
 * it to decide whether to print the warning, and the test suite reads it to
 * check those two never drift apart.
 */
export function modelThinks(modelId, edition = 'trial') {
  const model = IMAGE_MODELS[modelId];
  if (!model) return false;
  const thinks = model.draws.thinks;
  if (thinks === 'pro-only') return normalizeEdition(edition) === 'pro';
  return Boolean(thinks);
}

/**
 * True when this model on this edition will draw something that looks more
 * trustworthy than it is. The app is required to say so on the picture.
 */
export function warnsUnthought(modelId, edition = 'trial') {
  const model = IMAGE_MODELS[modelId];
  if (!model) return false;
  // Only a model that can write is dangerous this way: 2.5 cannot spell, so
  // nobody is going to believe its worksheet.
  return model.draws.text && !modelThinks(modelId, edition);
}

export const UNTHOUGHT_WARNING =
  'Generated without the thinking pass. The words are drawn correctly and the '
  + 'facts in them have not been checked — answers, totals and dates in this '
  + 'picture are likely to be wrong. Hazelnut thinks before it draws.';

/** The longest edge this model will render on this edition. */
export function modelMaxEdge(modelId, edition = 'trial') {
  const model = IMAGE_MODELS[modelId];
  if (!model) return 1024;
  return model.maxEdge[normalizeEdition(edition)] ?? 1024;
}

/** Every model, with this edition's price already worked out. For the picker. */
export function modelsFor(edition = 'trial') {
  const ed = normalizeEdition(edition);
  return MODEL_ORDER.map((id) => {
    const model = IMAGE_MODELS[id];
    const price = modelPrice(id, ed);
    return {
      ...model,
      edition: ed,
      price,
      allowed: price != null,
      unlimited: price === 0,
      thinks: modelThinks(id, ed),
      warns: warnsUnthought(id, ed),
      maxEdge: modelMaxEdge(id, ed),
      priceLabel: priceLabel(id, ed),
    };
  });
}

/** What the button says. 'Unlimited' is not a price, so it is not printed as one. */
export function priceLabel(modelId, edition = 'trial') {
  const price = modelPrice(modelId, edition);
  if (price == null) return 'Not on this edition';
  if (price === 0) return 'Unlimited';
  return `${price} credit${price === 1 ? '' : 's'}`;
}

// The browser build has no edition of its own worth pricing against: it is the
// local half of Hazelnut, and the generator is local, so it prices as a trial.
function normalizeEdition(edition) {
  return edition === 'pro' ? 'pro' : 'trial';
}
