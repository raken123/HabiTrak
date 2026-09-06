// A Store-shaped object backed by localStorage.
//
// @hazelnut/core's License and Credits do not care where their state lives —
// they only need get / set / update. On the desktop that is a JSON file; on
// Android it is this.

export class LocalStore {
  constructor(key = 'hazelnut-mini-state', defaults = {}) {
    this.key = key;
    this.defaults = defaults;
    this.data = this.#load();
  }

  #load() {
    try {
      return { ...structuredClone(this.defaults), ...JSON.parse(localStorage.getItem(this.key) || '{}') };
    } catch {
      return structuredClone(this.defaults);
    }
  }

  get(key, fallback) { return key in this.data ? this.data[key] : fallback; }
  set(key, value) { this.data[key] = value; this.save(); return value; }
  update(patch) { Object.assign(this.data, patch); this.save(); return this.data; }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      // A full or disabled storage should not take the app down; the session
      // simply stops being remembered.
    }
  }
}
