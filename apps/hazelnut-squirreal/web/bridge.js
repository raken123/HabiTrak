// Squirreal's browser bridge.
//
// The same job as Hazelnut's: no main process here, so the engine runs in the
// page, the key lives in localStorage, and Gemini is reached through the
// launcher's own origin. It exposes exactly the surface the preload does, so
// the renderer cannot tell which one it is talking to.
//
// What differs from Hazelnut's bridge is what sits behind it: the video tool
// registry, the video client and the video engine — and GIF Animate, which
// never reaches this file at all, because in Squirreal the clip is encoded in
// the renderer and costs nothing.

import { License, LICENSE_DEFAULTS } from '../../../packages/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '../../../packages/core/credits.js';
import { GeminiClient } from '../../../packages/core/gemini.js';
import { VideoClient } from '../../../packages/core/video.js';
import { VideoEngine } from '../../../packages/core/video-engine.js';
import { VIDEO_TOOLS, VIDEO_TOOL_ORDER, videoCostOf } from '../../../packages/core/video-tools.js';
import { PLANS, TRIAL_DAYS, SQUIRREAL_TRIAL_CREDIT_GRANT } from '../../../packages/core/pricing.js';

const STATE_KEY = 'squirreal-state';
const API_KEY = 'hazelnut-api-key';

/** The launcher proxies this path straight through to Google. */
const API_BASE = '/api/v1beta';

class WebStore {
  constructor(key, defaults) {
    this.key = key;
    this.defaults = defaults;
    try {
      this.data = { ...structuredClone(defaults), ...JSON.parse(localStorage.getItem(key) || '{}') };
    } catch {
      this.data = structuredClone(defaults);
    }
  }

  get(key, fallback) { return key in this.data ? this.data[key] : fallback; }
  set(key, value) { this.data[key] = value; this.save(); return value; }
  update(patch) { Object.assign(this.data, patch); this.save(); return this.data; }
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch { /* private mode */ }
  }
}

export function installWebBridge() {
  const store = new WebStore(STATE_KEY, { ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, product: 'squirreal', settings: {} });
  const license = new License(store, { product: 'squirreal' });
  // Priced from the video registry: a clip is never billed as a still.
  const credits = new Credits(store, { costOf: videoCostOf });
  const readKey = () => { try { return localStorage.getItem(API_KEY) || null; } catch { return null; } };
  const client = new GeminiClient({ apiKey: readKey(), apiBase: API_BASE });
  const video = new VideoClient({ apiKey: readKey(), apiBase: API_BASE });
  const engine = new VideoEngine({ video, client, credits, license });

  const state = () => ({
    ...license.status(),
    credits: credits.balance,
    ledger: credits.history(20),
    apiKeyConfigured: video.configured,
    apiKeySource: video.configured ? 'this computer' : null,
    platform: navigator.platform?.toLowerCase().includes('mac') ? 'darwin'
      : navigator.platform?.toLowerCase().includes('win') ? 'win32' : 'linux',
    version: '1.0.0',
    tools: VIDEO_TOOL_ORDER.map((id) => VIDEO_TOOLS[id]),
    plans: PLANS,
    trialDays: TRIAL_DAYS,
    trialCreditGrant: SQUIRREAL_TRIAL_CREDIT_GRANT,
    settings: store.get('settings', {}),
  });

  /** Give an engine call the `.cancel()` the IPC version carries. */
  const job = (run, onProgress) => {
    const controller = new AbortController();
    const promise = run({ signal: controller.signal, onProgress: onProgress || (() => {}) });
    promise.cancel = () => controller.abort();
    return promise;
  };

  window.hazelnut = {
    kind: 'standalone',

    async getState() { return state(); },
    async saveSettings(patch) {
      const settings = { ...store.get('settings', {}), ...patch };
      store.set('settings', settings);
      return settings;
    },

    async startTrial() {
      const status = license.startTrial();
      credits.grant('trial-grant', SQUIRREAL_TRIAL_CREDIT_GRANT, 'Trial credits');
      return { ...status, credits: credits.balance };
    },

    async activate(key) {
      const result = license.activate(key);
      if (result.ok) {
        const plan = license.status().plan;
        credits.grant(`plan-${plan.id}-${new Date().toISOString().slice(0, 7)}`, plan.credits, `${plan.name} credits`);
      }
      return { ...result, state: state() };
    },

    async deactivate() { return { ...license.deactivate(), state: state() }; },

    async saveApiKey(key) {
      const trimmed = String(key || '').trim();
      try { localStorage.setItem(API_KEY, trimmed); } catch { /* private mode */ }
      client.apiKey = trimmed || null;
      video.apiKey = trimmed || null;
      return { configured: video.configured, source: 'this computer' };
    },

    async quote(toolId, params) { return engine.quote(toolId, params || {}); },
    async refund(toolId, amount, note) { return credits.refund(toolId, amount, note); },

    magicDraw: (opts, onProgress) => job((ctx) => engine.magicDraw({ ...opts, ...ctx }), onProgress),
    realtouch: (opts, onProgress) => job((ctx) => engine.realtouch({ ...opts, ...ctx }), onProgress),
    aiscopeLearn: (opts, onProgress) => job((ctx) => engine.aiscopeLearn({ ...opts, ...ctx }), onProgress),

    // Here so the surface matches; the renderer encodes the open clip itself
    // and never calls this.
    async gifAnimate() {
      throw new Error('In Squirreal the clip is encoded on this machine — nothing is sent and nothing is charged.');
    },

    openImage() {
      return new Promise((resolve) => {
        const input = document.getElementById('file-input');
        input.value = '';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = () => resolve(file.type.startsWith('video/')
            // A clip comes back under its own key, so the renderer decodes it
            // into frames rather than dropping it in as a still.
            ? { name: file.name, path: file.name, clip: reader.result }
            : { name: file.name, path: file.name, dataUrl: reader.result });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        };
        input.click();
      });
    },

    async saveImage(dataUrl, name) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = name || `squirreal-${Date.now()}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      return { path: `Downloads/${link.download}` };
    },

    async openExternal(url) { window.open(url, '_blank', 'noopener'); return true; },

    onMenuCommand() { return () => {}; },
  };

  // Tell the launcher the window is still open. When these stop arriving it
  // shuts itself down, so closing the window ends the process.
  const beat = () => { fetch('/__alive', { method: 'POST', keepalive: true }).catch(() => {}); };
  beat();
  setInterval(beat, 2000);
  window.addEventListener('pagehide', () => {
    fetch('/__closing', { method: 'POST', keepalive: true }).catch(() => {});
  });
}
