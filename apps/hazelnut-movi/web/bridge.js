// Movi's browser bridge.
//
// Same job as Mini's and Squirreal's: no main process, so state lives in
// localStorage and the surface it exposes is the one the Electron preload
// exposes, so the app cannot tell which it is talking to.
//
// ─────────────────────────────────────────────────────────────────────────────
// NOTHING IS RENDERED.
//
// There are no Hazelnut 3.0 servers in this repository. `renderSimple` and
// `renderClip` move credits, write a record and hand back `pending: true`; the
// app draws a placard saying NOT RENDERED rather than a black rectangle that
// could be mistaken for a result. When there is a renderer, it fills `frame`
// and the placard disappears on its own.
//
// The money is real, though, in the sense that matters here: it is deducted in
// the order Simple promises — before the render, not after — and the restore
// path genuinely returns it and genuinely refuses the second time.
// ─────────────────────────────────────────────────────────────────────────────

import { License, LICENSE_DEFAULTS } from '../../../packages/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '../../../packages/core/credits.js';
import {
  costOfSeconds, costOfClip, costOfExtension, restorable, restoreRefusal,
  MAX_CLIP_SECONDS,
} from '../../../packages/core/movi.js';
import { tierForNewAccount, quotaBytes } from '../../../packages/core/storage.js';
import { MOVI_TRIAL_CREDIT_GRANT } from '../../../packages/core/pricing.js';

const STATE_KEY = 'movi-state';

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

export function installMoviBridge() {
  const store = new WebStore(STATE_KEY, {
    ...LICENSE_DEFAULTS,
    ...CREDIT_DEFAULTS,
    product: 'movi',
    welcomed: false,
    renders: [],
    clips: [],
    // The tier is decided when the account is opened and kept — the founder
    // deadline is on joining, not on holding. storage.js says why.
    storageTier: null,
    usedBytes: 0,
  });

  const license = new License(store, { product: 'movi' });
  const credits = new Credits(store, { costOf: () => 0 });

  // Opening grant, once. `grant()` is keyed, so this is safe every launch.
  credits.grant('movi-trial', MOVI_TRIAL_CREDIT_GRANT, 'Movi opening credits');

  if (!store.get('storageTier')) {
    // `taken` would come from the service. There is no service, so this client
    // can only speak for itself: it asks for the tier the offer is open for
    // right now, and a real sign-up would have the server decide instead.
    store.set('storageTier', tierForNewAccount({ taken: 0 }).id);
  }

  const state = () => {
    const tier = store.get('storageTier', 'standard');
    return {
      product: 'movi',
      edition: license.edition(),
      credits: credits.balance,
      welcomed: Boolean(store.get('welcomed', false)),
      storage: {
        tier,
        usedBytes: Number(store.get('usedBytes', 0)) || 0,
        // Serialised as a string: a BigInt cannot cross structuredClone into
        // every host, and 48 EB cannot survive being a Number.
        quotaBytes: quotaBytes(tier).toString(),
      },
    };
  };

  const record = (entry) => {
    const renders = store.get('renders', []);
    renders.push(entry);
    store.set('renders', renders.slice(-200));
    return entry;
  };

  const findRender = (id) => store.get('renders', []).find((r) => r.id === id) || null;

  const spend = (amount, note) => {
    if (credits.balance < amount) {
      const err = new Error(`That costs ${amount} credits; you have ${credits.balance}.`);
      err.code = 'INSUFFICIENT_CREDITS';
      throw err;
    }
    store.set('credits', credits.balance - amount);
    const ledger = store.get('ledger', []);
    ledger.push({ type: 'spend', amount: -amount, note, at: Date.now(), balanceAfter: credits.balance });
    store.set('ledger', ledger.slice(-500));
  };

  window.hazelnutMovi = {
    async getState() { return state(); },

    async markWelcomed() { store.set('welcomed', true); return state(); },

    /**
     * Simple: charge, then render. In that order, on purpose — it is the whole
     * difference between the modes, and doing it the safe way round would
     * quietly turn Simple into Advanced.
     */
    async renderSimple(plan) {
      const cost = costOfSeconds(plan.model, plan.seconds);
      spend(cost, `Movi Simple · ${plan.seconds}s`);
      return record({
        id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        mode: 'simple',
        prompt: plan.prompt,
        model: plan.model,
        seconds: plan.seconds,
        charged: cost,
        at: Date.now(),
        restoredAt: null,
        pending: true,
        frame: null,
      });
    },

    /** Advanced: one clip, quoted on the button before it was pressed. */
    async renderClip({ prompt, model, extendOf = null }) {
      const cost = extendOf ? costOfExtension(model) : costOfClip(model);
      spend(cost, extendOf ? 'Movi extension' : 'Movi clip');
      const clip = record({
        id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        mode: 'advanced',
        prompt,
        model,
        seconds: MAX_CLIP_SECONDS,
        charged: cost,
        extendOf,
        at: Date.now(),
        restoredAt: null,
        pending: true,
        frame: null,
      });
      const clips = store.get('clips', []);
      clips.push(clip.id);
      store.set('clips', clips);
      return clip;
    },

    async listClips() {
      const ids = new Set(store.get('clips', []));
      return store.get('renders', []).filter((r) => ids.has(r.id));
    },

    /**
     * Put the credits back.
     *
     * The rules live in movi.js and are checked here rather than in the app,
     * because the app is the thing a determined person edits. A refusal comes
     * back as the sentence movi.js chose, not as a silent no-op.
     */
    async restore(id) {
      const render = findRender(id);
      const check = restorable(render);
      if (!check.ok) {
        const err = new Error(restoreRefusal(check.reason));
        err.code = 'NOT_RESTORABLE';
        throw err;
      }
      credits.refund('movi', check.amount, 'Movi restore');
      const renders = store.get('renders', []).map((r) =>
        (r.id === id ? { ...r, restoredAt: Date.now() } : r));
      store.set('renders', renders);
      store.set('clips', store.get('clips', []).filter((cid) => cid !== id));
      return state();
    },

    async history(limit = 50) { return credits.history(limit); },
  };
}
