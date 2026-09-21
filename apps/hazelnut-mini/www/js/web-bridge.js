// The browser half of Mini.
//
// On Android there is no main process to hide the key in, so the app runs the
// same @hazelnut/core engine directly in the page and keeps the key in
// localStorage. It exposes exactly the interface the Electron preload does, so
// app.js is identical on both platforms.

import { License, LICENSE_DEFAULTS } from '../vendor/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '../vendor/core/credits.js';
import { GeminiClient } from '../vendor/core/gemini.js';
import { Engine } from '../vendor/core/engine.js';
import { PLANS } from '../vendor/core/pricing.js';
import { costOf, availability } from '../vendor/core/tools.js';
import { DEFAULT_MODEL, modelsFor, modelMaxEdge, modelThinks } from '../vendor/core/models.js';
import { ECO_SUMMARY } from '../vendor/core/eco.js';
import { parseDataUrl } from '../vendor/core/imaging.js';
import { LocalStore } from './localstore.js';

const KEY_STORAGE = 'hazelnut-mini-api-key';

const PRICED = ['realtouch', 'restore', 'colourise', 'upscale', 'sky', 'background', 'caption'];

/** What Mini's toolbar charges — the same numbers the engine will take. */
const pricesFor = (eco) => Object.fromEntries(PRICED.map((id) => [id, costOf(id, { eco })]));

// Under the desktop launcher the page is served from loopback and Gemini is
// reached through that same origin, so the browser never makes a cross-origin
// request. On Android there is no launcher, and the call goes out directly.
const VIA_LAUNCHER = location.origin.startsWith('http://127.0.0.1');
const API_BASE = VIA_LAUNCHER ? '/api/v1beta' : undefined;

export function createWebBridge() {
  const store = new LocalStore('hazelnut-mini-state', { ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, product: 'mini', eco: false });
  let eco = Boolean(store.get('eco', false));
  const license = new License(store, { product: 'mini' });
  const credits = new Credits(store);
  const client = new GeminiClient({ apiKey: readKey(), ...(API_BASE ? { apiBase: API_BASE } : {}) });
  const engine = new Engine({ client, credits, license });

  function readKey() {
    try { return localStorage.getItem(KEY_STORAGE) || null; } catch { return null; }
  }

  const state = () => ({
    ...license.status(),
    credits: credits.balance,
    apiKeyConfigured: client.configured,
    apiKeySource: client.configured ? 'this device' : null,
    platform: 'web',
    version: '1.0.0',
    plans: { mini: PLANS['mini-pro'], full: PLANS['hazelnut-pro'] },
    // Quoted from the registry rather than typed here, so Mini's toolbar and
    // Hazelnut's cannot disagree about what anything costs.
    eco,
    ecoSummary: ECO_SUMMARY,
    costs: pricesFor(eco),
    removalCost: costOf('realtouch', { eco }),
    models: modelsFor(license.edition()),
  });

  if (VIA_LAUNCHER) {
    // Tell the launcher the window is still open; when these stop arriving it
    // shuts down, so closing the window ends the process.
    const beat = () => { fetch('/__alive', { method: 'POST', keepalive: true }).catch(() => {}); };
    beat();
    setInterval(beat, 2000);
    window.addEventListener('pagehide', () => {
      fetch('/__closing', { method: 'POST', keepalive: true }).catch(() => {});
    });
  }

  /** Give an engine call the `.cancel()` the desktop bridge's jobs carry. */
  const job = (fn, onProgress) => {
    const controller = new AbortController();
    const promise = fn({ signal: controller.signal, onProgress: onProgress || (() => {}) });
    promise.cancel = () => controller.abort();
    return promise;
  };

  return {
    kind: VIA_LAUNCHER ? 'standalone' : 'web',

    async getState() { return state(); },

    /** Eco Mode, remembered on the device. */
    async setEco(next) {
      eco = Boolean(next);
      store.set('eco', eco);
      return state();
    },

    async startTrial() {
      const status = license.startTrial();
      credits.grant('mini-trial-grant', PLANS['mini-trial'].credits, 'Trial credits');
      return { ...status, credits: credits.balance };
    },

    async activate(key) {
      const result = license.activate(key);
      if (result.ok) {
        credits.grant(`mini-pro-${new Date().toISOString().slice(0, 7)}`, PLANS['mini-pro'].credits, 'Hazelnut Mini credits');
      }
      return { ...result, state: state() };
    },

    async saveApiKey(key) {
      const trimmed = String(key || '').trim();
      try { localStorage.setItem(KEY_STORAGE, trimmed); } catch { /* private mode */ }
      client.apiKey = trimmed || null;
      return { configured: client.configured };
    },

    /** The file picker, via a hidden <input type="file"> the page owns. */
    openImage() {
      return new Promise((resolve) => {
        const input = document.getElementById('file-input');
        input.value = '';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        };
        input.click();
      });
    },

    async saveImage(dataUrl) {
      const { mimeType, base64 } = parseDataUrl(dataUrl);
      const name = `hazelnut-mini-${Date.now()}.${mimeType.includes('jpeg') ? 'jpg' : 'png'}`;

      // The Android build writes the bytes itself: a WebView will not act on an
      // <a download>, so the launcher's Java side is handed the base64 instead.
      if (globalThis.HazelnutAndroid?.save) {
        const written = globalThis.HazelnutAndroid.save(base64, name);
        return { path: written || name };
      }

      // A Capacitor build, if one is ever made, has its own filesystem plugin.
      const filesystem = globalThis.Capacitor?.Plugins?.Filesystem;
      if (filesystem) {
        await filesystem.writeFile({ path: name, data: base64, directory: 'DOCUMENTS' });
        return { path: `Documents/${name}` };
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = name;
      link.click();
      return { path: name };
    },

    openExternal(url) {
      window.open(url, '_blank', 'noopener');
      return true;
    },


    // Imagine. The picture is drawn by the page, so only the money comes
    // through the bridge — and in the same order the rest of the app uses:
    // quote, draw, then charge. A generation that is abandoned costs nothing.
    async imagineQuote(model) {
      const edition = license.edition();
      const params = { model: model || DEFAULT_MODEL, edition };
      const check = availability('imagine', edition, params);
      const cost = costOf('imagine', params);
      return {
        model: params.model,
        edition,
        cost,
        unlimited: cost === 0,
        balance: credits.balance,
        affordable: credits.balance >= cost,
        allowed: check.allowed,
        message: check.message || null,
        maxEdge: modelMaxEdge(params.model, edition),
        thinks: modelThinks(params.model, edition),
      };
    },

    async imagineCharge(model) {
      const edition = license.edition();
      const params = { model: model || DEFAULT_MODEL, edition };
      const check = availability('imagine', edition, params);
      if (!check.allowed) {
        const err = new Error(check.message || 'That model is not available on this edition.');
        err.code = 'TOOL_LOCKED';
        throw err;
      }
      const out = await credits.charge('imagine', params, async () => ({ drawn: true }));
      return { charged: out.charged, balance: out.balance };
    },

    remove: (opts, onProgress) => job((ctx) => engine.miniRemove({ ...opts, eco, ...ctx }), onProgress),

    // Mini's toolbar. The same engine call the desktop apps make, so the price
    // and the prompt are the same wherever you run it.
    transform: (toolId, opts, onProgress) =>
      job((ctx) => engine.transform({ toolId, ...opts, eco, ...ctx }), onProgress),
    describe: (opts, onProgress) => job((ctx) => engine.describe({ ...opts, eco, ...ctx }), onProgress),
  };
}
