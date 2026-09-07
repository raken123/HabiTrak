// Bridges for the ad recording.
//
// The apps are the real ones, running their real code — but a recording must
// not depend on a live API key, and every AI call must stop at the point where
// the model would answer. These bridges therefore serve real state and real
// files, and deliberately leave the AI calls pending for ever: the ad shows the
// genuine progress UI and cuts away, rather than inventing a result.

import { demoPhoto } from './demo-image.js';
import { streetScene } from './street-scene.js';
import { deskScene } from './desk-scene.js';
import { carFrame } from './car-scene.js';

const TOOLS = {
  draw: { id: 'draw', name: 'Draw', shortcut: 'B', icon: 'brush', ai: false, cost: 0, group: 'paint', tagline: 'Draw what you want, in colour.', help: 'A plain brush. Pick a colour and a size and paint on the active layer. Nothing leaves your machine and nothing is charged.' },
  'magic-draw': { id: 'magic-draw', name: 'Magic Draw', shortcut: 'M', icon: 'sparkle-brush', ai: true, cost: { min: 5, max: 20 }, group: 'paint', tagline: 'Sketch in 2D, submit, get the real thing.', help: 'Draw as you would with Draw, then press Submit. Hazelnut renders a photoreal version of your sketch, keeping your composition, colours and proportions.' },
  realtouch: { id: 'realtouch', name: 'Realtouch', shortcut: 'R', icon: 'eraser-magic', ai: true, cost: 20, group: 'repair', tagline: 'Remove an object — and rebuild what was actually behind it.', help: 'Paint over the thing you want gone. Realtouch works out where the photo was taken, looks the place up, and reasons about what the object is hiding before it paints the gap back in.' },
  'gif-animate': { id: 'gif-animate', name: 'GIF Animate', shortcut: 'G', icon: 'film', ai: true, cost: 600, group: 'motion', tagline: 'Up to five seconds of movement, encoded as a GIF.', help: 'Describe the motion. Hazelnut generates a run of frames and encodes them into a looping GIF.' },
  expand: { id: 'expand', name: 'Expand', shortcut: 'E', icon: 'expand', ai: false, cost: 0, group: 'canvas', tagline: 'Grow the canvas. Never costs a credit.', help: 'Pull the canvas out in any direction. The new margin is filled by mirroring the edge pixels. Local, instant, free on every edition.' },
  aiscope: { id: 'aiscope', name: 'AIScope', shortcut: 'Z', icon: 'scope', ai: false, cost: 0, learnCost: 15, group: 'inspect', minZoom: 80, maxZoom: 60000, tagline: 'Zoom 80× to 60,000× and let the AI learn what it is looking at.', help: 'Drag a box to dive into it. Zoom runs locally and is free at any magnification.' },
};
const ORDER = ['draw', 'magic-draw', 'realtouch', 'gif-animate', 'expand', 'aiscope'];

const PLANS = {
  'hazelnut-free': { id: 'hazelnut-free', product: 'hazelnut', name: 'Hazelnut Free', monthlyUsd: 0, yearlyUsd: 0, credits: 0, ai: false, blurb: 'Everything in Hazelnut that does not need a model. No AI, no credits, no expiry.' },
  'hazelnut-pro': { id: 'hazelnut-pro', product: 'hazelnut', name: 'Hazelnut', monthlyUsd: 19.99, yearlyUsd: 199, credits: 5000, ai: true, blurb: 'The full editor, every tool, and a monthly credit allowance.' },
  'mini-pro': { id: 'mini-pro', product: 'mini', name: 'Hazelnut Mini', monthlyUsd: 9.99, yearlyUsd: 99.5, credits: 1500, ai: true, blurb: 'One chat bar that removes things. Half the price of Hazelnut.' },
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
      const tool = TOOLS[toolId];
      const cost = toolId === 'aiscope' ? (params.learn ? 15 : 0)
        : toolId === 'magic-draw' ? 12
        : typeof tool.cost === 'number' ? tool.cost : tool.cost.min;
      return { cost, balance: state.credits, affordable: state.credits >= cost, allowed: state.ai || !tool.ai, reason: null, message: null };
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
  const state = { ...baseState('trial'), product: 'mini', plan: PLANS['mini-pro'], credits: 300, removalCost: 20, plans: { mini: PLANS['mini-pro'], full: PLANS['hazelnut-pro'] } };
  window.hazelnutMini = {
    kind: 'desktop',
    getState: async () => state,
    startTrial: async () => state,
    activate: async () => ({ ok: true, state }),
    saveApiKey: async () => ({ configured: true }),
    openImage: async () => ({
      name: 'sofa-outside.jpg',
      dataUrl: (new URLSearchParams(location.search).get('scene') === 'street'
        ? streetScene({ width: 1000, height: 1250, sofa: true })
        : (() => { const c = document.createElement('canvas'); const i = new Image(); i.src = demoPhoto(1200, 750); return c; })()
      ).toDataURL?.('image/jpeg', 0.9) || demoPhoto(1200, 750),
    }),
    saveImage: async () => ({ path: '~/Pictures/ridgeline.png' }),
    openExternal: async () => true,
    remove: (_opts, onProgress) => pending(onProgress, [
      { after: 250, stage: 'reading', message: 'Reading your message…' },
      { after: 2200, stage: 'examining', message: 'Looking up where this was taken…' },
      { after: 5200, stage: 'rebuilding', message: 'Found 3 references. Rebuilding what was behind it…' },
    ]),
  };
}


// ── Squirreal ───────────────────────────────────────────────────────────────

const VIDEO_TOOLS = {
  draw: { id: 'draw', name: 'Draw', shortcut: 'B', icon: 'brush', ai: false, cost: 0, group: 'paint', tagline: 'Draw what you want, in colour.', help: 'A plain brush, on the frame you are parked on. Free.' },
  'magic-draw': { id: 'magic-draw', name: 'Magic Draw', shortcut: 'M', icon: 'sparkle-brush', ai: true, cost: { min: 40, max: 120 }, group: 'paint', tagline: 'Sketch a shot. Get the shot, moving.', help: 'Sketch the frame and describe the movement. Squirreal renders it as a clip and holds it steady across every frame.' },
  realtouch: { id: 'realtouch', name: 'Realtouch', shortcut: 'R', icon: 'eraser-magic', ai: true, cost: 150, group: 'repair', tagline: 'Remove something from every frame at once.', help: 'Paint over it once. Squirreal looks the place up and rebuilds what was behind it, across the whole clip.' },
  'gif-animate': { id: 'gif-animate', name: 'GIF Animate', shortcut: 'G', icon: 'film', ai: false, cost: 0, group: 'motion', tagline: 'Turn the clip into a looping GIF.', help: 'The motion is already there, so this is local work. Free on every edition.' },
  expand: { id: 'expand', name: 'Expand', shortcut: 'E', icon: 'expand', ai: false, cost: 0, group: 'canvas', tagline: 'Grow the frame. Never costs a credit.', help: 'Pull the frame out; the margin is mirrored on every frame of the clip.' },
  aiscope: { id: 'aiscope', name: 'AIScope', shortcut: 'Z', icon: 'scope', ai: false, cost: 0, learnCost: 15, group: 'inspect', minZoom: 80, maxZoom: 60000, tagline: 'Zoom 80× to 60,000× into any frame.', help: 'Park on a frame and dive in. Zooming is free; Learn costs 15.' },
};
const VIDEO_ORDER = ['draw', 'magic-draw', 'realtouch', 'gif-animate', 'expand', 'aiscope'];

const SQUIRREAL_PLANS = {
  'squirreal-free': { id: 'squirreal-free', product: 'squirreal', name: 'Squirreal Free', monthlyUsd: 0, credits: 0, ai: false, blurb: 'Everything that does not need a model, including GIF export.' },
  'squirreal-pro': { id: 'squirreal-pro', product: 'squirreal', name: 'Hazelnut Squirreal', monthlyUsd: 29.99, credits: 3000, ai: true, blurb: 'Hazelnut, for moving pictures.' },
  'hazelnut-pro': PLANS['hazelnut-pro'],
  'mini-pro': PLANS['mini-pro'],
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
      const seconds = Math.min(8, Math.max(1, params.seconds || 4));
      const cost = toolId === 'magic-draw'
        ? Math.round(40 + (0.55 * ((seconds - 1) / 7) + 0.2 * Math.min(1, (params.coveragePct || 0) / 60)
            + 0.1 * Math.min(1, ((params.colorCount || 1) - 1) / 11)
            + 0.15 * Math.min(1, Math.max(0, ((params.megapixels || 1) - 0.5) / 3.5))) * 80)
        : toolId === 'realtouch' ? Math.max(45, Math.round((0.4 + 0.6 * (seconds / 8)) * 150))
        : toolId === 'aiscope' ? (params.learn ? 15 : 0)
        : 0;
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
