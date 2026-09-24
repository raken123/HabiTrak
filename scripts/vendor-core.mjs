// Copy the browser-safe half of @hazelnut/core into an app's vendor directory.
//
// Three apps now need this — Mini ships `www/` verbatim to an Android device,
// and Movi and Work are served as static pages — so the logic lives here once
// instead of three times. Each app keeps its own module list, because each one
// touches a different part of the core, and passes it in.
//
// The check at the end is the reason this is worth sharing at all. A
// hand-maintained list of dependencies goes stale silently: a module picks up
// a new import, the list does not, and the app ships a vendor directory that
// cannot resolve itself. That has already happened twice in Mini alone
// (models.js, then offers.js). So the list is not trusted — it is verified.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const HEADER =
  '// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.\n';

export function coreDir(from = ROOT) {
  for (const candidate of [
    path.join(from, 'node_modules', '@hazelnut', 'core'),
    path.join(ROOT, 'node_modules', '@hazelnut', 'core'),
    path.join(ROOT, 'packages', 'core'),
  ]) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  throw new Error('Could not find @hazelnut/core. Run `npm install` from the repository root first.');
}

/**
 * @param {{outDir:string, modules:string[], label?:string}} options
 * @returns {{copied:number, src:string}}
 */
export function vendorCore({ outDir, modules, label = 'vendor/core' }) {
  const src = coreDir();
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of modules) {
    const body = fs.readFileSync(path.join(src, name), 'utf8');
    if (/from\s+['"]node:/.test(body)) {
      throw new Error(
        `${name} imports a Node built-in and can no longer run in the browser. `
        + 'Move that code into a Node-only module before syncing.',
      );
    }
    fs.writeFileSync(path.join(outDir, name), HEADER + body, 'utf8');
  }

  // Every relative import in every copied file must point at another file that
  // was also copied. Matching on the specifier alone rather than on a whole
  // import clause is deliberate: the first version of this required the import
  // to sit on one line, which missed the multi-line import it was written to
  // catch.
  const missing = [];
  for (const name of modules) {
    const body = fs.readFileSync(path.join(outDir, name), 'utf8');
    const specifiers = [
      ...body.matchAll(/from\s*['"](\.[^'"]+)['"]/g),
      ...body.matchAll(/import\s*['"](\.[^'"]+)['"]/g),
    ];
    for (const match of specifiers) {
      const target = path.basename(match[1]);
      if (!modules.includes(target)) missing.push(`${name} imports ${match[1]}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `vendor-core: the vendored copy would not resolve. Add the missing module(s):\n  ${missing.join('\n  ')}`,
    );
  }

  console.log(
    `vendor-core: copied ${modules.length} modules from `
    + `${path.relative(process.cwd(), src)} to ${label}, imports closed`,
  );
  return { copied: modules.length, src };
}
