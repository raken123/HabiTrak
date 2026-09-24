// Copy the browser-safe half of @hazelnut/core into www/vendor/core.
//
// Movi's page is served as static files — by the launcher, by Electron, or
// from dist/ — so everything it imports has to sit beside it.
//
// The copying and the import-closure check live in scripts/vendor-core.mjs.
// What is Movi's own is this list.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vendorCore } from '../../../scripts/vendor-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Movi's page touches the product model and the storage model, and nothing
// else: the credits and the licence are the bridge's business, not the page's.
const MODULES = ['movi.js', 'storage.js'];

vendorCore({
  outDir: path.join(HERE, '..', 'www', 'vendor', 'core'),
  modules: MODULES,
  label: "hazelnut-movi's www/vendor/core",
});
