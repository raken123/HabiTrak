// Does every import in the app actually exist?
//
// The apps are not covered by the test suite — they need Electron or a browser
// — so a rename in packages/core can leave a bridge importing a symbol that is
// gone, and nothing notices until the app fails to boot. That happened when the
// seven-day trial was removed and six bridges were still importing TRIAL_DAYS.
//
// This walks every `import { a, b } from './x.js'` in the workspace's own
// source, resolves the target, and checks the named exports are really there.
//
//   node scripts/check-imports.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ROOTS = ['packages/core', 'apps/hazelnut', 'apps/hazelnut-squirreal', 'apps/hazelnut-mini', 'scripts', 'ads'];
const SKIP = /node_modules|[/\\]vendor[/\\]|[/\\]dist[/\\]|\.build/;

/** Files to walk: our own JS, not anything generated or vendored. */
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP.test(full)) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(m?js|cjs)$/.test(entry.name)) yield full;
  }
}

/** The names a module exports, found by reading it rather than importing it. */
const exportCache = new Map();
function exportsOf(file) {
  if (exportCache.has(file)) return exportCache.get(file);
  const names = new Set();
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { exportCache.set(file, null); return null; }

  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || '').trim();
      if (name) names.add(name);
    }
  }
  if (/^export\s+default/m.test(src)) names.add('default');

  // `export * from './x.js'` re-exports everything that module has.
  for (const m of src.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) {
    const target = resolve(file, m[1]);
    const inner = target && exportsOf(target);
    if (inner) for (const n of inner) names.add(n);
  }
  for (const m of src.matchAll(/^export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from/gm)) names.add(m[1]);

  exportCache.set(file, names);
  return names;
}

function resolve(from, spec) {
  if (spec.startsWith('@hazelnut/core/')) {
    return path.join(ROOT, 'packages/core', spec.slice('@hazelnut/core/'.length));
  }
  if (!spec.startsWith('.')) return null;             // a bare dependency
  let target = path.resolve(path.dirname(from), spec);
  // The renderer imports the shared core as ../core/x.js, served from packages.
  if (!fs.existsSync(target) && target.includes(`${path.sep}renderer${path.sep}core${path.sep}`)) {
    target = path.join(ROOT, 'packages/core', path.basename(target));
  }
  if (!fs.existsSync(target) && target.includes(`${path.sep}core${path.sep}`)) {
    const candidate = path.join(ROOT, 'packages/core', path.basename(target));
    if (fs.existsSync(candidate)) target = candidate;
  }
  return fs.existsSync(target) ? target : null;
}

const problems = [];
let checked = 0;

for (const dir of ROOTS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of walk(full)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const spec = m[2];
      const target = resolve(file, spec);
      if (!target) continue;                           // bare or unresolvable: not ours
      const available = exportsOf(target);
      if (!available) continue;
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        checked += 1;
        if (!available.has(name)) {
          problems.push(`${path.relative(ROOT, file)}: imports { ${name} } from '${spec}' — not exported by ${path.relative(ROOT, target)}`);
        }
      }
    }
  }
}

if (problems.length) {
  console.error(`check-imports: ${problems.length} broken import${problems.length === 1 ? '' : 's'}\n`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`check-imports: ${checked} named imports, all resolve`);
