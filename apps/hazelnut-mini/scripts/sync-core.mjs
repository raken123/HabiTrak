// Copy the browser-safe half of @hazelnut/core into www/vendor/core.
//
// Mini's desktop build imports the package from node_modules like any other
// Node app. Its Android build cannot: Capacitor ships `www/` verbatim to the
// device, so the modules the page imports have to live inside it.
//
// The copying and the import-closure check now live in scripts/vendor-core.mjs,
// because Movi and Work need the same thing. What stays here is the one part
// that is Mini's own: which modules Mini actually touches.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vendorCore } from '../../../scripts/vendor-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Everything Mini's web bridge touches, directly or transitively.
const MODULES = [
  'pricing.js', 'tools.js', 'models.js', 'offers.js', 'license.js', 'credits.js',
  'imagine-plan.js', 'imagine-paint.js',
  'gemini.js', 'engine.js', 'prompts.js', 'imaging.js', 'gif.js',
  // The cheap edits and the local adjustments: Mini runs the same kernels and
  // the same prompts as Hazelnut rather than a second implementation.
  'transforms.js', 'adjustments.js', 'eco.js',
];

vendorCore({
  outDir: path.join(HERE, '..', 'www', 'vendor', 'core'),
  modules: MODULES,
  label: "hazelnut-mini's www/vendor/core",
});
