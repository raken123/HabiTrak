// Where the Gemini API key comes from, on a desktop install.
//
// Kept apart from gemini.js so that the client itself stays free of Node
// imports: Hazelnut Mini's Android build runs the very same GeminiClient in a
// browser, where there is no filesystem to read a key from.

import fs from 'node:fs';
import path from 'node:path';
import { defaultStateDir } from './store.js';

/**
 * Find an API key, in order of precedence:
 *   1. HAZELNUT_GEMINI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY
 *   2. `.env` next to the app, for people running from source
 *   3. `gemini.json` in the per-user app directory, written by Settings
 */
export function resolveApiKey({ appName = 'Hazelnut', cwd = process.cwd() } = {}) {
  const fromEnv = process.env.HAZELNUT_GEMINI_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY;
  if (fromEnv && fromEnv.trim()) return { key: fromEnv.trim(), source: 'env' };

  for (const dir of [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '..', '..'), path.resolve(cwd, '..', '..', '..')]) {
    const envFile = path.join(dir, '.env');
    try {
      const match = /^\s*(?:HAZELNUT_)?GEMINI_API_KEY\s*=\s*"?([^"\n\r]+)"?/m.exec(fs.readFileSync(envFile, 'utf8'));
      if (match && match[1].trim()) return { key: match[1].trim(), source: envFile };
    } catch { /* no .env here, keep looking */ }
  }

  const configFile = path.join(defaultStateDir(appName), 'gemini.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (cfg.apiKey && String(cfg.apiKey).trim()) return { key: String(cfg.apiKey).trim(), source: configFile };
  } catch { /* not configured yet */ }

  return { key: null, source: null };
}

export function saveApiKey(apiKey, { appName = 'Hazelnut' } = {}) {
  const dir = defaultStateDir(appName);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'gemini.json');
  fs.writeFileSync(file, JSON.stringify({ apiKey: String(apiKey || '').trim() }, null, 2), 'utf8');
  // Owner-only, so another account on a shared machine cannot read it.
  try { fs.chmodSync(file, 0o600); } catch { /* windows has no chmod */ }
  return file;
}
