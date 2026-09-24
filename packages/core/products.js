// What Hazelnut is now.
//
// Hazelnut was a photo editor with two siblings. It is now a service with
// three products on it, and one that has been withdrawn:
//
//   Hazelnut Photo       the editor, unchanged — it is the thing that was
//                        simply called Hazelnut until this file existed
//   Hazelnut Movi        moving pictures, on Hazelnut's own 3.0 models
//   Hazelnut Work        a coworker, wired to the mail you already have
//   Hazelnut Squirreal   withdrawn. See CANCELLED below.
//
// The rename matters more than a rename usually does, because "Hazelnut" used
// to mean the editor and now means the account the editor sits in. Everywhere
// the old name meant the app, it has to say Photo; everywhere it means the
// thing you sign in to, it stays Hazelnut. `PRODUCTS.photo.name` is the first
// of those and `SERVICE.name` is the second, so the two cannot be confused by
// whoever writes the next dialog.

/** The service itself — the account, the storage, the sign-in. */
export const SERVICE = {
  id: 'hazelnut',
  name: 'Hazelnut',
  tagline: 'Three apps and your files, on one account.',
};

/**
 * Squirreal is cancelled, and cancelled is not the same as deleted.
 *
 * Every AI tool Squirreal had was a video model somebody else ran, reached
 * over the network. There is nothing left to reach: the account those calls
 * were made against is closed, so they fail, and they will keep failing. What
 * the app can still do — the local half, the frame tools, opening and
 * exporting a clip — it still does, because that never needed a server.
 *
 * So the code does not pretend the app is gone. It tells the truth to anyone
 * who still has it: this is over, here is what still works, here is where the
 * work moved. An app that quietly returned errors would be worse than one that
 * says it has been withdrawn.
 */
export const CANCELLED = {
  squirreal: {
    id: 'squirreal',
    name: 'Hazelnut Squirreal',
    /** The day the servers stopped answering. */
    endedAt: Date.UTC(2026, 8, 24),
    succeededBy: 'movi',
    reason: 'Hazelnut Movi replaces it, and runs on Hazelnut’s own video '
      + 'models instead of somebody else’s.',
    /** What a holder can still do with the copy on their machine. */
    stillWorks: 'Opening, trimming and exporting clips, and every frame tool '
      + 'that ran on your machine. Those never needed a server and still do not.',
  },
};

export const PRODUCTS = {
  photo: {
    id: 'photo',
    name: 'Hazelnut Photo',
    kind: 'Photo Editor',
    blurb: 'The editor. Twenty-three tools, twelve of them on your machine, and '
      + 'two image models of our own.',
    platforms: ['Windows', 'Mac', 'Android', 'Browser'],
  },
  movi: {
    id: 'movi',
    name: 'Hazelnut Movi',
    kind: 'Video',
    blurb: 'Moving pictures, on Hazelnut 3.0. Say what you want and let it '
      + 'decide, or build it eight seconds at a time.',
    platforms: ['Windows', 'Mac'],
    replaces: 'squirreal',
  },
  work: {
    id: 'work',
    name: 'Hazelnut Work',
    kind: 'Coworker',
    blurb: 'Your coworker. Connect the mail and calendars you already have, and '
      + 'hand it the work you would rather not do twice.',
    platforms: ['Windows', 'Mac', 'Browser'],
  },
};

export const PRODUCT_ORDER = ['photo', 'movi', 'work'];

export function productFor(id) {
  return PRODUCTS[id] || null;
}

/** True for a product that has been withdrawn — see CANCELLED. */
export function isCancelled(id) {
  return Object.hasOwn(CANCELLED, id);
}

export function cancellationFor(id) {
  return CANCELLED[id] || null;
}

/**
 * What to tell somebody holding a cancelled product.
 *
 * One function so the dialog, the landing page and the bridge cannot each
 * invent their own wording for the same bad news.
 */
export function cancellationNotice(id) {
  const ended = CANCELLED[id];
  if (!ended) return null;
  const successor = PRODUCTS[ended.succeededBy];
  return {
    title: `${ended.name} has been withdrawn`,
    reason: ended.reason,
    stillWorks: ended.stillWorks,
    moveTo: successor ? successor.name : null,
    endedOn: new Date(ended.endedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }),
  };
}
