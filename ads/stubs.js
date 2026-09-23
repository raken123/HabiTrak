// Bridges for the ad recording.
//
// The apps are the real ones, running their real code — but a recording must
// not depend on a live API key, and every AI call must stop at the point where
// the model would answer. These bridges therefore serve real state and real
// files, and deliberately leave the AI calls pending for ever: the ad shows the
// genuine progress UI and cuts away, rather than inventing a result.

// The registries and the prices come from the core itself: a second copy here
// would drift, and an ad that quotes a price the app does not charge is worse
// than no ad. The harness serves the package at /core/.
import { TOOLS, TOOL_ORDER as ORDER, costOf, availability, isPartnerTool } from '/core/tools.js';
import { DEFAULT_MODEL, modelsFor, modelMaxEdge, modelThinks } from '/core/models.js';
import { VIDEO_TOOLS, VIDEO_TOOL_ORDER as VIDEO_ORDER, videoCostOf, videoAvailability } from '/core/video-tools.js';
import { PLANS as CORE_PLANS } from '/core/pricing.js';
import { ECO_SUMMARY } from '/core/eco.js';
import { offerBanner, isWellFormedAccessCode, normalizeAccessCode, activeOffer } from '/core/offers.js';
import { isWellFormedKey } from '/core/license.js';

import { demoPhoto } from './demo-image.js';
import { streetScene } from './street-scene.js';
import { deskScene } from './desk-scene.js';
import { carFrame } from './car-scene.js';


const PLANS = {
  'mini-trial': CORE_PLANS['mini-trial'],
  'mini-pro': CORE_PLANS['mini-pro'],
  'hazelnut-trial': CORE_PLANS['hazelnut-trial'],
  'hazelnut-pro': CORE_PLANS['hazelnut-pro'],
  'hazelnut-web': CORE_PLANS['hazelnut-web'],
  'mini-pro': CORE_PLANS['mini-pro'],
};

/**
 * Never settles on its own — the ad cuts away while the real progress UI is on
 * screen — but cancelling rejects the way a real abort does, so the app tears
 * its overlay down through its own code path rather than being reset.
 */
const pending = (onProgress, stages) => {
  let reject;
  const promise = new Promise((_, rj) => { reject = rj; });
  promise.cancel = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  let delay = 0;
  for (const stage of stages) {
    delay += stage.after;
    setTimeout(() => onProgress?.(stage), delay);
  }
  return promise;
};

function baseState(edition) {
  // 'free' is gone. A film that asks for it gets the trial, which is what
  // replaced it, rather than an undefined plan and a broken page.
  const asked = edition === 'free' ? 'trial' : edition;
  const plan = PLANS[asked === 'pro' ? 'hazelnut-pro' : asked === 'web' ? 'hazelnut-web' : 'hazelnut-trial'];
  return {
    product: 'hazelnut',
    edition: asked,
    plan,
    ai: plan.ai,
    partnerModels: plan.partnerModels,
    trialStarted: true,
    trialEndsAt: null,
    trialCreditGrant: CORE_PLANS['hazelnut-trial'].credits,
    licensed: asked === 'pro',
    credits: asked === 'pro' ? 5000 : CORE_PLANS['hazelnut-trial'].credits,
    ledger: [],
    apiKeyConfigured: true,
    apiKeySource: 'this machine',
    platform: 'darwin',
    version: '1.0.0',
    // The lock has to come from the real gate here too. A film that showed a
    // partner tool unlocked on the trial would be showing something the app
    // does not do, which is the one thing these bridges exist to prevent.
    tools: ORDER.map((id) => {
      const check = availability(id, asked);
      return { ...TOOLS[id], partner: isPartnerTool(id), locked: !check.allowed, lockedMessage: check.message || null };
    }),
    models: modelsFor(asked),
    // The offer comes from the core's own dates, so a film shot after it
    // closes will not show a banner advertising it.
    offer: asked === 'pro' ? null : offerBanner(CORE_PLANS['hazelnut-pro']),
    redeemed: null,
    plans: PLANS,
    settings: {},
  };
}

export function installHazelnutStub() {
  const state = baseState(new URLSearchParams(location.search).get('edition') || 'trial');
  window.__AD_STATE = state;

  window.hazelnut = {
    getState: async () => state,
    saveSettings: async () => state.settings,
    startTrial: async () => state,
    activate: async () => ({ ok: true, state }),
    deactivate: async () => state,
    saveApiKey: async () => ({ configured: true }),

    // The same shape check the real bridge runs, so a film cannot show a code
    // being accepted that the app would refuse.
    redeem: async (code) => {
      const normalized = normalizeAccessCode(code);
      // The same two-way check License.redeem runs: a film must not show a
      // message the app would not give.
      if (isWellFormedKey(normalized)) {
        return { ok: false, error: 'That is a licence key, not an access code. Use “Enter a licence key”.', kind: 'licence-key', state };
      }
      if (!isWellFormedAccessCode(normalized)) {
        return { ok: false, error: 'That does not look like an access code. They read FALL-XXXXX-XXXXX.', state };
      }
      const offer = activeOffer();
      if (!offer) return { ok: false, error: 'There is no offer running.', kind: 'closed', state };
      state.edition = 'pro';
      state.plan = PLANS['hazelnut-pro'];
      state.partnerModels = true;
      state.ai = true;
      state.credits = 5000;
      state.offer = null;
      state.redeemed = { id: offer.id, name: offer.name, redeemedAt: Date.now(), discountPct: offer.discountPct, price: offerBanner(CORE_PLANS['hazelnut-pro'])?.price };
      return { ok: true, offer, state };
    },
    quote: async (toolId, params = {}) => {
      const cost = costOf(toolId, params);
      return {
        cost,
        balance: state.credits,
        affordable: state.credits >= cost,
        allowed: state.ai || !TOOLS[toolId].ai,
        reason: null,
        message: null,
      };
    },
    refund: async () => state.credits,

    // Imagine is the one call these bridges do not have to stub away, because
    // it never reaches a model we cannot run: the renderer draws the picture
    // itself. So the film gets a real generation and a real charge.
    imagineQuote: async (model) => {
      const id = model || DEFAULT_MODEL;
      const cost = costOf('imagine', { model: id, edition: state.edition });
      const check = availability('imagine', state.edition, { model: id });
      return {
        model: id,
        edition: state.edition,
        cost,
        unlimited: cost === 0,
        balance: state.credits,
        affordable: state.credits >= cost,
        allowed: check.allowed,
        message: check.message || null,
        maxEdge: modelMaxEdge(id, state.edition),
        thinks: modelThinks(id, state.edition),
      };
    },
    imagineCharge: async (model) => {
      const cost = costOf('imagine', { model: model || DEFAULT_MODEL, edition: state.edition });
      state.credits = Math.max(0, state.credits - cost);
      return { charged: cost, balance: state.credits };
    },

    magicDraw: (_opts, onProgress) => pending(onProgress, [
      { after: 350, stage: 'render', message: 'Rendering your sketch…' },
    ]),
    realtouch: (_opts, onProgress) => pending(onProgress, [
      { after: 300, stage: 'examining', message: 'Looking up where this was taken…' },
      { after: 2600, stage: 'rebuilding', message: 'Found 3 references. Rebuilding what was behind it…' },
    ]),
    gifAnimate: (_opts, onProgress) => pending(onProgress, [
      { after: 300, stage: 'frames', message: 'Generating keyframe 2 of 8…', done: 1, total: 8 },
      { after: 1500, stage: 'frames', message: 'Generating keyframe 3 of 8…', done: 2, total: 8 },
    ]),
    /**
     * RECORDING ONLY, and driven by the film — see the note in short5.js. The
     * card it resolves with is written by the ad, not read off the picture by
     * any model.
     */
    // The cheap edits, in the same shape as the rest of the bridge: real
    // progress, and a promise the film never lets settle unless it says so.
    //
    // A film that needs to show a result sets `__AD_TRANSFORM` first and then
    // hands one over through `__AD_JOB.finish`. What it hands over is drawn by
    // the film itself — no model runs during a recording — and the film says so
    // at the point it does it.
    transform: (toolId, opts, onProgress) => {
      if (!window.__AD_TRANSFORM) {
        return pending(onProgress, [{ after: 300, stage: 'render', message: 'Sending the picture…' }]);
      }
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      promise.cancel = () => {};
      window.__AD_JOB = {
        progress: (message, stage = 'render') => onProgress?.({ stage, message }),
        finish: (image, { charged = costOf(toolId, { eco: opts?.eco }) } = {}) => {
          state.credits -= charged;
          resolve({ result: { image, note: '' }, charged, balance: state.credits });
        },
      };
      return promise;
    },
    // Caption, on the same terms as `transform`: pending unless the film says
    // otherwise, and what it hands over is written by the film.
    describe: (opts, onProgress) => {
      if (!window.__AD_DESCRIBE) {
        return pending(onProgress, [{ after: 300, stage: 'read', message: 'Reading the picture…' }]);
      }
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      promise.cancel = () => {};
      window.__AD_JOB = {
        progress: (message, stage = 'read') => onProgress?.({ stage, message }),
        finish: (reading, { charged = costOf('caption', { eco: opts?.eco }) } = {}) => {
          state.credits -= charged;
          resolve({ result: reading, charged, balance: state.credits });
        },
      };
      return promise;
    },

    aiscopeLearn: (_opts, onProgress) => {
      if (!window.__AD_CARD) {
        return pending(onProgress, [{ after: 300, stage: 'study', message: 'Studying the crop…' }]);
      }
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      promise.cancel = () => {};
      window.__AD_JOB = {
        progress: (message, stage = 'study') => onProgress?.({ stage, message }),
        finish: (card, { charged = 15 } = {}) => {
          state.credits -= charged;
          resolve({ result: { card, raw: '' }, charged, balance: state.credits });
        },
      };
      return promise;
    },
    openImage: async () => {
      // The film can hand over its own plate; otherwise the scene is picked by
      // the query string, as the earlier ads do.
      if (window.__AD_PLATE) {
        const name = window.__AD_PLATE_NAME || 'tomato-stem.jpg';
        return { name, path: name, dataUrl: window.__AD_PLATE };
      }
      const scene = new URLSearchParams(location.search).get('scene');
      if (scene === 'desk') {
        return { name: 'desk.jpg', path: 'desk.jpg', dataUrl: deskScene({ pc: 'office' }).toDataURL('image/jpeg', 0.92) };
      }
      if (scene === 'street') {
        return { name: 'sofa-outside.jpg', path: 'sofa-outside.jpg', dataUrl: streetScene({ sofa: true }).toDataURL('image/jpeg', 0.92) };
      }
      return { name: 'ridgeline.jpg', path: 'ridgeline.jpg', dataUrl: demoPhoto() };
    },
    openImagePath: async () => null,
    saveImage: async () => ({ path: '~/Pictures/ridgeline.png' }),
    openExternal: async () => true,
    onMenuCommand: () => () => {},
  };
}

export function installMiniStub() {
  // The toolbar's prices come from the registry, exactly as the real bridges
  // quote them — an ad must not show a number the app would not charge.
  const costs = Object.fromEntries(
    ['realtouch', 'restore', 'colourise', 'upscale', 'sky', 'background', 'caption']
      .map((id) => [id, costOf(id)]),
  );
  const state = {
    ...baseState('trial'),
    product: 'mini',
    plan: PLANS['mini-trial'],
    partnerModels: PLANS['mini-trial'].partnerModels,
    credits: PLANS['mini-trial'].credits,
    trialCreditGrant: PLANS['mini-trial'].credits,
    eco: false,
    ecoSummary: ECO_SUMMARY,
    costs,
    removalCost: costs.realtouch,
    models: modelsFor('trial'),
    plans: { mini: PLANS['mini-pro'], full: PLANS['hazelnut-pro'] },
  };
  window.hazelnutMini = {
    // As in Hazelnut's stub: Imagine is the one call that does not have to be
    // stubbed away, because the page draws the picture itself.
    imagineQuote: async (model) => {
      const id = model || DEFAULT_MODEL;
      const cost = costOf('imagine', { model: id, edition: state.edition });
      const check = availability('imagine', state.edition, { model: id });
      return {
        model: id,
        edition: state.edition,
        cost,
        unlimited: cost === 0,
        balance: state.credits,
        affordable: state.credits >= cost,
        allowed: check.allowed,
        message: check.message || null,
        maxEdge: modelMaxEdge(id, state.edition),
        thinks: modelThinks(id, state.edition),
      };
    },
    imagineCharge: async (model) => {
      const cost = costOf('imagine', { model: model || DEFAULT_MODEL, edition: state.edition });
      state.credits = Math.max(0, state.credits - cost);
      return { charged: cost, balance: state.credits };
    },
    kind: 'desktop',
    getState: async () => state,
    setEco: async (next) => {
      state.eco = Boolean(next);
      state.costs = Object.fromEntries(
        Object.keys(costs).map((id) => [id, costOf(id, { eco: state.eco })]),
      );
      state.removalCost = state.costs.realtouch;
      return state;
    },
    startTrial: async () => state,
    activate: async () => ({ ok: true, state }),
    saveApiKey: async () => ({ configured: true }),
    openImage: async () => (new URLSearchParams(location.search).get('scene') === 'street'
      ? { name: 'sofa-outside.jpg', dataUrl: streetScene({ width: 1000, height: 1250, sofa: true }).toDataURL('image/jpeg', 0.9) }
      : { name: 'ridgeline.jpg', dataUrl: demoPhoto(1200, 750) }),
    saveImage: async () => ({ path: '~/Pictures/ridgeline.png' }),
    openExternal: async () => true,
    remove: (_opts, onProgress) => pending(onProgress, [
      { after: 250, stage: 'reading', message: 'Reading your message…' },
      { after: 2200, stage: 'examining', message: 'Looking up where this was taken…' },
      { after: 5200, stage: 'rebuilding', message: 'Found 3 references. Rebuilding what was behind it…' },
    ]),
    transform: (_toolId, _opts, onProgress) => pending(onProgress, [
      { after: 250, stage: 'render', message: 'Sending the picture…' },
    ]),
    describe: (_opts, onProgress) => pending(onProgress, [
      { after: 250, stage: 'read', message: 'Reading the picture…' },
    ]),
  };
}


// ── Squirreal ───────────────────────────────────────────────────────────────


const SQUIRREAL_PLANS = {
  'squirreal-trial': CORE_PLANS['squirreal-trial'],
  'squirreal-pro': CORE_PLANS['squirreal-pro'],
  'hazelnut-pro': CORE_PLANS['hazelnut-pro'],
  'mini-pro': CORE_PLANS['mini-pro'],
};

export function installSquirrealStub() {
  const state = {
    product: 'squirreal',
    edition: 'trial',
    plan: CORE_PLANS['squirreal-trial'],
    ai: true,
    partnerModels: CORE_PLANS['squirreal-trial'].partnerModels,
    trialStarted: true, trialEndsAt: null,
    trialCreditGrant: CORE_PLANS['squirreal-trial'].credits,
    licensed: false,
    credits: CORE_PLANS['squirreal-trial'].credits,
    ledger: [],
    apiKeyConfigured: true,
    apiKeySource: 'this machine',
    platform: 'darwin',
    version: '1.0.0',
    tools: VIDEO_ORDER.map((id) => {
      const check = videoAvailability(id, 'trial');
      return { ...VIDEO_TOOLS[id], partner: Boolean(VIDEO_TOOLS[id].ai), locked: !check.allowed, lockedMessage: check.message || null };
    }),
    plans: SQUIRREAL_PLANS,
    settings: {},
  };

  window.hazelnut = {
    getState: async () => state,
    saveSettings: async () => state.settings,
    startTrial: async () => state,
    activate: async () => ({ ok: true, state }),
    deactivate: async () => state,
    saveApiKey: async () => ({ configured: true }),

    quote: async (toolId, params = {}) => {
      const cost = videoCostOf(toolId, params);
      return { cost, balance: state.credits, affordable: state.credits >= cost, allowed: true, reason: null, message: null };
    },
    refund: async () => state.credits,

    /**
     * RECORDING ONLY, and driven by the film rather than by a timer.
     *
     * A real Magic Draw call returns a clip from the model. This one returns
     * the ad's own placeholder footage — the same drawn street the ad opens
     * with — and it is not a model output and is not presented as one; see the
     * note at the top of short3.js. The film calls progress() and finish() on
     * its own cues, because the recorder steps virtual time and a wall-clock
     * setTimeout would land on an unpredictable frame.
     */
    magicDraw: (_opts, onProgress) => {
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      promise.cancel = () => {};
      window.__AD_JOB = {
        progress: (message, stage = 'rendering') => onProgress?.({ stage, message }),
        finish: (frames, { fps = 12, charged = 62 } = {}) => {
          state.credits -= charged;
          resolve({
            result: { frames, fps, seconds: frames.length / fps },
            charged,
            balance: state.credits,
          });
        },
      };
      return promise;
    },

    /**
     * RECORDING ONLY, and driven by the film — same arrangement as magicDraw
     * above, and the same caveat: what it resolves with is the ad's own
     * footage, not a model output.
     */
    transform: (_toolId, _opts, onProgress) => pending(onProgress, [
      { after: 300, stage: 'render', message: 'That tool edits a still…' },
    ]),
    describe: (_opts, onProgress) => pending(onProgress, [
      { after: 300, stage: 'read', message: 'Reading…' },
    ]),

    realtouch: (_opts, onProgress) => {
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      promise.cancel = () => {};
      window.__AD_JOB = {
        progress: (message, stage = 'rebuilding') => onProgress?.({ stage, message }),
        finish: (payload, { charged = 88 } = {}) => {
          state.credits -= charged;
          resolve({ result: payload, charged, balance: state.credits });
        },
      };
      return promise;
    },
    gifAnimate: (_o, onProgress) => pending(onProgress, [{ after: 300, stage: 'encoding', message: 'Encoding the GIF…' }]),
    aiscopeLearn: (_o, onProgress) => pending(onProgress, [{ after: 300, stage: 'study', message: 'Studying the crop…' }]),

    // The film says what opens: a still it built itself, or — when it hands
    // over __AD_OPEN — a real clip file, which the editor decodes through its
    // own Clip.fromVideo rather than being fed frames from the outside.
    openImage: async () => window.__AD_OPEN || ({
      name: 'high-street.jpg',
      path: 'high-street.jpg',
      dataUrl: window.__AD_PLATE
        || carFrame({ width: 780, height: 975, t: 0.42 }).toDataURL('image/jpeg', 0.9),
    }),
    openImagePath: async () => null,
    saveImage: async () => ({ path: '~/Movies/high-street.mp4' }),
    openExternal: async () => true,
    onMenuCommand: () => () => {},
  };
}
