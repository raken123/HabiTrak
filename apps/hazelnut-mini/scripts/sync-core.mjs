// Copy the browser-safe half of @hazelnut/core into www/vendor/core.
//
// Mini's desktop build imports the package from node_modules like any other
// Node app. Its Android build cannot: Capacitor ships `www/` verbatim to the
// device, so the modules the page imports have to live inside it. Rather than
// keep a second copy by hand, this script copies them, and refuses to copy a
// file that has picked up a Node import since the last time it ran.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'www', 'vendor', 'core');

// Everything Mini's web bridge touches, directly or transitively.
const MODULES = [
  'pricing.js', 'tools.js', 'models.js', 'offers.js', 'license.js', 'credits.js',
  'imagine-plan.js', 'imagine-paint.js',
  'gemini.js', 'engine.js', 'prompts.js', 'imaging.js', 'gif.js',
  // The cheap edits and the local adjustments: Mini runs the same kernels and
  // the same prompts as Hazelnut rather than a second implementation.
  'transforms.js', 'adjustments.js', 'eco.js',
];

function coreDir() {
  for (const candidate of [
    path.join(HERE, '..', 'node_modules', '@hazelnut', 'core'),
    path.join(HERE, '..', '..', '..', 'node_modules', '@hazelnut', 'core'),
    path.join(HERE, '..', '..', '..', 'packages', 'core'),
  ]) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  throw new Error('Could not find @hazelnut/core. Run `npm install` from the repository root first.');
}

const src = coreDir();
fs.mkdirSync(OUT, { recursive: true });

const header = '// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.\n';
let copied = 0;

for (const name of MODULES) {
  const body = fs.readFileSync(path.join(src, name), 'utf8');
  if (/from\s+['"]node:/.test(body)) {
    throw new Error(`${name} imports a Node built-in and can no longer run in the browser. Move that code into a Node-only module before syncing.`);
  }
  fs.writeFileSync(path.join(OUT, name), header + body, 'utf8');
  copied += 1;
}

// The list above is maintained by hand, and a hand-maintained list of
// dependencies goes stale silently: a module picks up a new import, the list
// does not, and Mini ships a vendor directory that cannot resolve itself. That
// has already happened twice — models.js and then offers.js. So rather than
// trust the list, check it: every relative import in every copied file must
// point at another file that was also copied.
const missing = [];
for (const name of MODULES) {
  const body = fs.readFileSync(path.join(OUT, name), 'utf8');
  // Every relative specifier in the file, however the clause was written.
  // The first version of this required the import to sit on one line, which
  // missed the multi-line `import { ... } from './offers.js'` it was added to
  // catch — so it matches on the specifier alone.
  const specifiers = [
    ...body.matchAll(/from\s*['"](\.[^'"]+)['"]/g),
    ...body.matchAll(/import\s*['"](\.[^'"]+)['"]/g),
  ];
  for (const match of specifiers) {
    const target = path.basename(match[1]);
    if (!MODULES.includes(target)) missing.push(`${name} imports ${match[1]}`);
  }
}
if (missing.length) {
  throw new Error(
    `sync-core: the vendored copy would not resolve. Add the missing module(s) to MODULES:\n  ${missing.join('\n  ')}`,
  );
}

console.log(`sync-core: copied ${copied} modules from ${path.relative(process.cwd(), src)} to www/vendor/core, imports closed`);
