// Work's browser bridge.
//
// ─────────────────────────────────────────────────────────────────────────────
// NOTHING IS CONNECTED AND NOTHING IS READ.
//
// There is no OAuth client, no token, no redirect and no server to redirect
// to. `connect` writes a connector id into local state. `run` charges credits
// and writes a placeholder draft that says, in its own text, that it was not
// written from your mail.
//
// This is not a stub standing in for a working thing. It is the working thing
// there is, and the app says so across the top of itself — see DISCLOSURE.
// When a real integration exists, the scopes in work.js are what the consent
// screen must ask for, and `run` is where the model call goes.
// ─────────────────────────────────────────────────────────────────────────────

import { License, LICENSE_DEFAULTS } from '../../../packages/core/license.js';
import { Credits, CREDIT_DEFAULTS } from '../../../packages/core/credits.js';
import { TASKS, CONNECTORS, canRun, costOf } from '../../../packages/core/work.js';
import { tierForNewAccount, quotaBytes } from '../../../packages/core/storage.js';
import { WORK_TRIAL_CREDIT_GRANT } from '../../../packages/core/pricing.js';

const STATE_KEY = 'work-state';

export const DISCLOSURE =
  'Nothing is connected. Hazelnut Work has no sign-in to Google or Microsoft '
  + 'yet, so Connect marks a service connected on this machine and reads no '
  + 'mail. Every draft below is a placeholder.';

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
 * What a task produces, until there is something to read.
 *
 * Every one of these says what it is inside its own body, so a screenshot of
 * this app taken out of context still tells the truth.
 */
function placeholderDraft(taskId, connectorId) {
  const task = TASKS[taskId];
  const conn = CONNECTORS[connectorId];
  return {
    id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    title: `${task.name} — ${conn.name}`,
    // The blurb is a sentence of its own; splicing it after "would" produced
    // "would sorts what arrived".
    body: `This is a placeholder, not a result.\n\n`
      + `${task.name}: ${task.blurb}\n`
      + `It would read from ${conn.name} using: ${conn.scopes.join(', ')}.\n\n`
      + `No mail was read, because Hazelnut Work is not connected to anything yet.`,
    at: Date.now(),
    sent: false,
  };
}

export function installWorkBridge() {
  const store = new WebStore(STATE_KEY, {
    ...LICENSE_DEFAULTS,
    ...CREDIT_DEFAULTS,
    product: 'work',
    connected: [],
    drafts: [],
    storageTier: null,
    usedBytes: 0,
  });

  const license = new License(store, { product: 'work' });
  const credits = new Credits(store, { costOf: () => 0 });
  credits.grant('work-trial', WORK_TRIAL_CREDIT_GRANT, 'Work opening credits');
  if (!store.get('storageTier')) store.set('storageTier', tierForNewAccount({ taken: 0 }).id);

  const state = () => {
    const tier = store.get('storageTier', 'standard');
    return {
      product: 'work',
      edition: license.edition(),
      credits: credits.balance,
      connected: store.get('connected', []),
      disclosure: DISCLOSURE,
      storage: {
        tier,
        usedBytes: Number(store.get('usedBytes', 0)) || 0,
        quotaBytes: quotaBytes(tier).toString(),
      },
    };
  };

  window.hazelnutWork = {
    async getState() { return state(); },

    async connect(id) {
      if (!CONNECTORS[id]) throw new Error('No such connection.');
      const connected = new Set(store.get('connected', []));
      connected.add(id);
      store.set('connected', [...connected]);
      return state();
    },

    async disconnect(id) {
      store.set('connected', store.get('connected', []).filter((c) => c !== id));
      return state();
    },

    async run(taskId, connectorId) {
      const check = canRun(taskId, store.get('connected', []));
      if (!check.ok) {
        const err = new Error('That needs a connection first.');
        err.code = 'NOT_CONNECTED';
        throw err;
      }
      const cost = costOf(taskId);
      if (credits.balance < cost) {
        const err = new Error(`That costs ${cost} credits; you have ${credits.balance}.`);
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
      }
      const draft = placeholderDraft(taskId, connectorId || check.using);
      // Charged on producing something, the way every other tool in this
      // repository charges: a failure costs nothing.
      store.set('credits', credits.balance - cost);
      const ledger = store.get('ledger', []);
      ledger.push({
        type: 'spend', amount: -cost, note: `Work · ${TASKS[taskId].name}`,
        at: Date.now(), balanceAfter: credits.balance,
      });
      store.set('ledger', ledger.slice(-500));
      store.set('drafts', [...store.get('drafts', []), draft].slice(-100));
      return draft;
    },

    async listDrafts() { return store.get('drafts', []); },

    async history(limit = 50) { return credits.history(limit); },
  };
}
