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
import { PLANS, TRIAL_DAYS } from '../vendor/core/pricing.js';
import { parseDataUrl } from '../vendor/core/imaging.js';
import { LocalStore } from './localstore.js';

const KEY_STORAGE = 'hazelnut-mini-api-key';

export function createWebBridge() {
  const store = new LocalStore('hazelnut-mini-state', { ...LICENSE_DEFAULTS, ...CREDIT_DEFAULTS, product: 'mini' });
  const license = new License(store, { product: 'mini' });
  const credits = new Credits(store);
  const client = new GeminiClient({ apiKey: readKey() });
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
    trialDays: TRIAL_DAYS,
    removalCost: 20,
  });

  return {
    kind: 'web',

    async getState() { return state(); },

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

      // On Android, hand the file to the platform so it lands in the gallery.
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

    remove(opts, onProgress) {
      const controller = new AbortController();
      const promise = engine.miniRemove({ ...opts, onProgress, signal: controller.signal });
      promise.cancel = () => controller.abort();
      return promise;
    },
  };
}
