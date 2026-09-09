// The browser build's bridge.
//
// The Electron build hides the engine and the key in a main process and reaches
// them over IPC. The standalone build has no main process: it runs the same
// @hazelnut/core engine in the page, keeps the key in localStorage, and reaches
// Gemini through the launcher's own origin so no cross-origin request is ever
// made from the page.
//
// It exposes exactly the surface the preload does, so renderer/js/main.js
// cannot tell which one it is talking to.

import { License, LICENSE_DEFAULTS } from '../../../packages/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '../../../packages/core/credits.js';
import { GeminiClient } from '../../../packages/core/gemini.js';
import { Engine } from '../../../packages/core/engine.js';
import { TOOLS, TOOL_ORDER } from '../../../packages/core/tools.js';
import { PLANS, TRIAL_DAYS, TRIAL_CREDIT_GRANT } from '../../../packages/core/pricing.js';

const STATE_KEY = 'hazelnut-state';
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

/**
 * @param {{limited?: boolean}} opts — `limited` is the hosted browser build:
 *   the full editor, fixed to the `web` edition, which is the half of the
 *   toolbox that needs no model. No key, no account, nothing uploaded.
 */
export function installWebBridge({ limited = false } = {}) {
  const store = new WebStore(STATE_KEY, { ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, product: 'hazelnut', settings: {} });
  const license = new License(store, { product: 'hazelnut', ...(limited ? { fixedEdition: 'web' } : {}) });
  const credits = new Credits(store);
  const readKey = () => { try { return localStorage.getItem(API_KEY) || null; } catch { return null; } };
  const client = new GeminiClient({ apiKey: readKey(), apiBase: API_BASE });
  const engine = new Engine({ client, credits, license });

  const state = () => ({
    ...license.status(),
    credits: credits.balance,
    ledger: credits.history(20),
    apiKeyConfigured: limited ? false : client.configured,
    apiKeySource: limited ? null : (client.configured ? 'this computer' : null),
    platform: navigator.platform?.toLowerCase().includes('mac') ? 'darwin'
      : navigator.platform?.toLowerCase().includes('win') ? 'win32' : 'linux',
    version: '1.0.0',
    tools: TOOL_ORDER.map((id) => TOOLS[id]),
    plans: PLANS,
    trialDays: TRIAL_DAYS,
    trialCreditGrant: TRIAL_CREDIT_GRANT,
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
      if (limited) return state();
      const status = license.startTrial();
      credits.grant('trial-grant', TRIAL_CREDIT_GRANT, 'Trial credits');
      return { ...status, credits: credits.balance };
    },

    async activate(key) {
      if (limited) {
        return { ok: false, error: 'Licences are for the desktop app — this is the browser edition.', state: state() };
      }
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
      return { configured: client.configured, source: 'this computer' };
    },

    async quote(toolId, params) { return engine.quote(toolId, params || {}); },
    async refund(toolId, amount, note) { return credits.refund(toolId, amount, note); },

    magicDraw: (opts, onProgress) => job((ctx) => engine.magicDraw({ ...opts, ...ctx }), onProgress),
    transform: (toolId, opts, onProgress) => job((ctx) => engine.transform({ toolId, ...opts, ...ctx }), onProgress),
    describe: (opts, onProgress) => job((ctx) => engine.describe({ ...opts, ...ctx }), onProgress),
    realtouch: (opts, onProgress) => job((ctx) => engine.realtouch({ ...opts, ...ctx }), onProgress),
    gifAnimate: (opts, onProgress) => job((ctx) => engine.gifAnimate({ ...opts, ...ctx }), onProgress),
    aiscopeLearn: (opts, onProgress) => job((ctx) => engine.aiscopeLearn({ ...opts, ...ctx }), onProgress),

    openImage() {
      return new Promise((resolve) => {
        const input = document.getElementById('file-input');
        input.value = '';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, path: file.name, dataUrl: reader.result });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        };
        input.click();
      });
    },

    async saveImage(dataUrl, name) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = name || `hazelnut-${Date.now()}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      return { path: `Downloads/${link.download}` };
    },

    async openExternal(url) { window.open(url, '_blank', 'noopener'); return true; },

    // There is no native menu bar in this build; the in-app one drives
    // everything, so this stays a no-op that still returns an unsubscribe.
    onMenuCommand() { return () => {}; },
  };

  // Tell the launcher the window is still open. When these stop arriving it
  // shuts itself down, so closing the window ends the process. The hosted
  // build has no launcher behind it, so it says nothing to anybody.
  if (limited) return;
  const beat = () => { fetch('/__alive', { method: 'POST', keepalive: true }).catch(() => {}); };
  beat();
  setInterval(beat, 2000);
  window.addEventListener('pagehide', () => {
    fetch('/__closing', { method: 'POST', keepalive: true }).catch(() => {});
  });
}
