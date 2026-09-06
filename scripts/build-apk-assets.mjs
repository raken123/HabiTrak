// Assemble the web assets the Android APK carries.
//
// The WebView loads file:///android_asset/index.html, so everything has to be
// inline or a plain relative file: no module scripts, no external stylesheet.
//
//   node scripts/build-apk-assets.mjs <outDir>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '.build', 'apk-assets'));
const WWW = path.join(ROOT, 'apps', 'hazelnut-mini', 'www');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

execFileSync(process.execPath, [
  path.join(ROOT, 'scripts', 'bundle-assets.mjs'),
  path.join(WWW, 'js', 'app.js'),
  path.join(OUT, 'app.js'),
], { stdio: 'inherit' });

const css = fs.readFileSync(path.join(WWW, 'css', 'mini.css'), 'utf8');
let html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');

html = html
  // The page is served from a file: origin, so it talks to Google directly and
  // the WebView is configured to allow it. Everything else stays shut.
  .replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
    '<meta name="theme-color" content="#1a1a1a" />')
  .replace(/[ \t]*<link rel="stylesheet"[^>]*>\n?/g, '')
  .replace('</head>', `  <style>\n${css}\n  </style>\n</head>`)
  .replace(/<script type="module" src="[^"]*"><\/script>/, '<script src="app.js"></script>');

if (html.includes('type="module"')) throw new Error('a module script survived; the WebView cannot load it');

fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`assets: ${fs.readdirSync(OUT).join(', ')} (${(fs.statSync(path.join(OUT, 'index.html')).size / 1024).toFixed(0)} KB html)`);
