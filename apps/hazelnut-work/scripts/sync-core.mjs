// Copy the browser-safe half of @hazelnut/core into www/vendor/core.
// Copying and the import-closure check live in scripts/vendor-core.mjs.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vendorCore } from '../../../scripts/vendor-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Work's page needs the connector and task registry, and the storage pill.
const MODULES = ['work.js', 'storage.js'];

vendorCore({
  outDir: path.join(HERE, '..', 'www', 'vendor', 'core'),
  modules: MODULES,
  label: "hazelnut-work's www/vendor/core",
});
