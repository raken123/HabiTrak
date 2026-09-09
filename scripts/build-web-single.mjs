// Fold the browser build into one HTML file.
//
//   node scripts/build-web-single.mjs            -> dist/Hazelnut-web.html
//
// The staged build in dist/web is a normal static site: forty-odd ES modules,
// two stylesheets, one page. That is the right shape for hosting and the wrong
// shape for handing someone a file, because a browser will not load an
// ES-module app off the filesystem. This flattens it: every module is wrapped
// in a function, registered under its path, and executed in dependency order,
// so the whole editor becomes one classic script with no imports left in it.
//
// It changes nothing about the app — the same renderer, the same bridge, the
// same `web` edition with the same eleven tools — only how it is delivered.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(ROOT, process.argv[2] || 'dist/web');
const OUT = path.resolve(ROOT, process.argv[3] || 'dist/Hazelnut-web.html');

if (!fs.existsSync(path.join(SRC, 'index.html'))) {
  throw new Error(`no staged build at ${SRC} — run: node scripts/stage-payload.mjs hazelnut-web dist/web`);
}

// ── the module graph ───────────────────────────────────────────────────────

const modules = new Map();   // path (relative to SRC) -> { source, deps, exports }

const IMPORT_RE = /^import\s+(?:(\{[^}]*\})|(\*\s+as\s+\w+)|(\w+))?\s*(?:from\s*)?['"]([^'"]+)['"];?$/gm;

function read(rel) {
  if (modules.has(rel)) return modules.get(rel);
  const file = path.join(SRC, rel);
  let source = fs.readFileSync(file, 'utf8');
  const deps = [];

  source = source.replace(IMPORT_RE, (line, named, star, dflt, spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      throw new Error(`${rel}: bare import "${spec}" cannot be inlined`);
    }
    const target = normalise(rel, spec);
    deps.push(target);
    if (named) {
      // `{ a, b as c }` becomes a destructure of the module's exports.
      return `const ${named.replace(/\s+as\s+/g, ': ')} = __m[${JSON.stringify(target)}];`;
    }
    if (star) return `const ${star.replace(/\*\s+as\s+/, '')} = __m[${JSON.stringify(target)}];`;
    if (dflt) throw new Error(`${rel}: default import of "${spec}" cannot be inlined`);
    return '';   // side-effect import: the dependency alone is enough
  });

  if (/^export\s+\*/m.test(source)) throw new Error(`${rel}: "export *" cannot be inlined`);
  if (/^export\s+default/m.test(source)) throw new Error(`${rel}: "export default" cannot be inlined`);

  const exports = new Set();
  // `[\w$]` rather than `\w`: dom.js exports `$` and `$$`.
  source = source.replace(/^export\s+(async\s+)?(function|class|const|let|var)\s+([\w$]+)/gm, (line, asy, kind, name) => {
    exports.add(name);
    return `${asy || ''}${kind} ${name}`;
  });
  source = source.replace(/^export\s*\{([^}]*)\};?$/gm, (line, list) => {
    for (const part of list.split(',')) {
      const [local, exported = local] = part.split(/\s+as\s+/).map((x) => x.trim());
      if (local) exports.add(exported === local ? local : `${exported}: ${local}`);
    }
    return '';
  });

  const record = { source, deps, exports: [...exports] };
  modules.set(rel, record);
  for (const dep of deps) read(dep);
  return record;
}

function normalise(fromRel, spec) {
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  if (!fs.existsSync(path.join(SRC, joined))) throw new Error(`${fromRel}: cannot resolve ${spec}`);
  return joined;
}

/** Dependencies first, and loudly if the graph has a cycle. */
function order() {
  const done = new Set();
  const stack = new Set();
  const out = [];
  const visit = (rel) => {
    if (done.has(rel)) return;
    if (stack.has(rel)) throw new Error(`import cycle through ${rel}`);
    stack.add(rel);
    for (const dep of modules.get(rel).deps) visit(dep);
    stack.delete(rel);
    done.add(rel);
    out.push(rel);
  };
  for (const rel of modules.keys()) visit(rel);
  return out;
}

// ── the page ───────────────────────────────────────────────────────────────

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

// Entry points: the bridge installs window.hazelnut, then the editor boots.
const entries = [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)]
  .map((m) => m[1].replace(/^\.?\//, ''));
if (!entries.length) throw new Error('no module scripts in index.html');
for (const entry of entries) read(entry);

const bundle = order().map((rel) => {
  const mod = modules.get(rel);
  return `__m[${JSON.stringify(rel)}] = (function () {\n${mod.source}\n`
    + `return { ${mod.exports.join(', ')} };\n})();`;
}).join('\n\n');

// Styles go inline too, so the file needs nothing beside it.
html = html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g, (line, href) => {
  const css = fs.readFileSync(path.join(SRC, href.replace(/^\.?\//, '')), 'utf8');
  return `<style>\n${css}\n</style>`;
});

// Everything is inline now, and the page has no business on the network: the
// policy says so rather than leaving the door open.
html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
  + 'script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src \'self\' data: blob:; '
  + 'font-src \'self\' data:; connect-src \'none\'" />');

html = html.replace(/<script type="module" src="[^"]+"><\/script>\s*/g, '');
// A function, not a string: `$$` and `$&` in a replacement string are
// substitution patterns, and the bundle is full of `$` — dom.js exports it.
html = html.replace('</body>', () =>
  `  <script>\n(function () {\nconst __m = {};\n${bundle}\n})();\n  </script>\n</body>`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`${path.relative(ROOT, OUT)} — ${(html.length / 1024).toFixed(0)} KB, ${modules.size} modules inlined`);
