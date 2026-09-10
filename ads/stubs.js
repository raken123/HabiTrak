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
import { TOOLS, TOOL_ORDER as ORDER, costOf } from '/core/tools.js';
import { VIDEO_TOOLS, VIDEO_TOOL_ORDER as VIDEO_ORDER, videoCostOf } from '/core/video-tools.js';
import { PLANS as CORE_PLANS } from '/core/pricing.js';

import { demoPhoto } from './demo-image.js';
import { streetScene } from './street-scene.js';
import { deskScene } from './desk-scene.js';
import { carFrame } from './car-scene.js';


const PLANS = {
  'hazelnut-free': CORE_PLANS['hazelnut-free'],
  'hazelnut-pro': CORE_PLANS['hazelnut-pro'],
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
  const ai = edition !== 'free';
  return {
    product: 'hazelnut',
    edition,
    plan: edition === 'pro' ? PLANS['hazelnut-pro'] : edition === 'trial' ? { ...PLANS['hazelnut-pro'], name: 'Hazelnut Trial' } : PLANS['hazelnut-free'],
    ai,
    trialStarted: true,
    trialUsed: edition === 'free',
    trialDaysLeft: edition === 'trial' ? 7 : 0,
    trialCreditGrant: 1200,
    licensed: edition === 'pro',
    credits: edition === 'free' ? 0 : 1200,
    ledger: [],
    apiKeyConfigured: true,
    apiKeySource: 'this machine',
    platform: 'darwin',
    version: '1.0.0',
    tools: ORDER.map((id) => TOOLS[id]),
    plans: PLANS,
    trialDays: 7,
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
    transform: (_toolId, _opts, onProgress) => pending(onProgress, [
      { after: 300, stage: 'render', message: 'Sending the picture…' },
    ]),
    describe: (_opts, onProgress) => pending(onProgress, [
      { after: 300, stage: 'read', message: 'Reading the picture…' },
    ]),

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
      if (window.__AD_PLATE) return { name: 'tomato-stem.jpg', path: 'tomato-stem.jpg', dataUrl: window.__AD_PLATE };
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
    plan: PLANS['mini-pro'],
    credits: 300,
    costs,
    removalCost: costs.realtouch,
    plans: { mini: PLANS['mini-pro'], full: PLANS['hazelnut-pro'] },
  };
  window.hazelnutMini = {
    kind: 'desktop',
    getState: async () => state,
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
  'squirreal-free': CORE_PLANS['squirreal-free'],
  'squirreal-pro': CORE_PLANS['squirreal-pro'],
  'hazelnut-pro': CORE_PLANS['hazelnut-pro'],
  'mini-pro': CORE_PLANS['mini-pro'],
};

export function installSquirrealStub() {
  const state = {
    product: 'squirreal',
    edition: 'trial',
    plan: { ...SQUIRREAL_PLANS['squirreal-pro'], name: 'Squirreal Trial' },
    ai: true,
    trialStarted: true, trialUsed: false, trialDaysLeft: 7, trialCreditGrant: 900,
    licensed: false,
    credits: 900,
    ledger: [],
    apiKeyConfigured: true,
    apiKeySource: 'this machine',
    platform: 'darwin',
    version: '1.0.0',
    tools: VIDEO_ORDER.map((id) => VIDEO_TOOLS[id]),
    plans: SQUIRREAL_PLANS,
    trialDays: 7,
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
