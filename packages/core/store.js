// A tiny durable JSON store.
//
// Both apps keep a single state file inside the OS's per-user app directory.
// Writes go through a temp file and a rename so a crash mid-write cannot leave
// a truncated file behind — losing someone's credit balance to a power cut is
// not an acceptable failure mode.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function defaultStateDir(appName = 'Hazelnut') {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), appName.toLowerCase());
}

export class Store {
  /**
   * @param {{dir?:string, file?:string, appName?:string, defaults?:object}} opts
   */
  constructor({ dir, file = 'state.json', appName = 'Hazelnut', defaults = {} } = {}) {
    this.dir = dir || defaultStateDir(appName);
    this.path = path.join(this.dir, file);
    this.defaults = defaults;
    this.data = this.#load();
  }

  #load() {
    try {
      const raw = fs.readFileSync(this.path, 'utf8');
      return { ...structuredClone(this.defaults), ...JSON.parse(raw) };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // A corrupt state file should not stop the app from opening. Keep the
        // damaged copy so it can be looked at, and start clean.
        try { fs.renameSync(this.path, `${this.path}.corrupt-${Date.now()}`); } catch { /* best effort */ }
      }
      return structuredClone(this.defaults);
    }
  }

  get(key, fallback) {
    return key in this.data ? this.data[key] : fallback;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
    return value;
  }

  update(patch) {
    Object.assign(this.data, patch);
    this.save();
    return this.data;
  }

  save() {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.path}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.path);
  }

  /** Test helper: an in-memory store that never touches disk. */
  static memory(defaults = {}) {
    const store = Object.create(Store.prototype);
    store.dir = null;
    store.path = null;
    store.defaults = defaults;
    store.data = structuredClone(defaults);
    store.save = () => {};
    return store;
  }
}
