// Assemble what the launcher embeds and serves.
//
//   node scripts/stage-payload.mjs hazelnut launcher/payload
//   node scripts/stage-payload.mjs hazelnut-web dist/web
//
// Kept in Node rather than inline in the shell script: the rewrites below are
// full of quotes and backslashes, and shell quoting mangles them silently.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [app = 'hazelnut', outArg = 'launcher/payload'] = process.argv.slice(2);
const OUT = path.resolve(ROOT, outArg);

// Same-origin for everything: the app, the heartbeat and the Gemini proxy.
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; "
  + "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'";

const CSP_RE = /<meta http-equiv="Content-Security-Policy"[\s\S]*?\/>/;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function patchIndex(file, extraBody, extraHead) {
  let html = fs.readFileSync(file, 'utf8');

  if (!CSP_RE.test(html)) throw new Error(`no CSP meta found in ${file}`);
  html = html.replace(CSP_RE, `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);

  const marker = '<script type="module"';
  if (!html.includes(marker)) throw new Error(`no module script found in ${file}`);
  html = html.replace(marker, `${extraBody}${extraHead}${marker}`);

  fs.writeFileSync(file, html);
  return html;
}

// hazelnut-web is the hosted browser build: the same renderer and the same
// bridge, fixed to the `web` edition — the eleven local tools work, the ten
// that need the model are locked, and nothing leaves the page.
const source = app === 'hazelnut-web' ? 'hazelnut' : app;
const limited = app === 'hazelnut-web';

if (app === 'hazelnut' || app === 'hazelnut-squirreal' || app === 'hazelnut-web') {
  // Squirreal is the same renderer; only the bridge behind it differs.
  fs.cpSync(path.join(ROOT, 'apps/hazelnut/renderer'), OUT, { recursive: true });

  fs.mkdirSync(path.join(OUT, 'core'), { recursive: true });
  for (const name of fs.readdirSync(path.join(ROOT, 'packages/core'))) {
    if (name.endsWith('.js')) {
      fs.copyFileSync(path.join(ROOT, 'packages/core', name), path.join(OUT, 'core', name));
    }
  }

  // The bridge sits at the payload root, so its imports of the shared core have
  // to be rewritten from the repository's layout to this one. It also installs
  // itself: the CSP has no 'unsafe-inline', so the page cannot carry a one-line
  // inline module to call it — the file has to do it on load.
  const bridge = fs.readFileSync(path.join(ROOT, `apps/${source}/web/bridge.js`), 'utf8')
    .replaceAll('../../../packages/core/', './core/');
  fs.writeFileSync(
    path.join(OUT, 'bridge.js'),
    `${bridge}\n// Installed on load: this build has no inline scripts.\n`
    + `installWebBridge(${limited ? '{ limited: true }' : ''});\n`,
  );

  patchIndex(
    path.join(OUT, 'index.html'),
    source === 'hazelnut-squirreal'
      ? '<input type="file" id="file-input" accept="image/*,video/*" hidden />\n  '
      : '<input type="file" id="file-input" accept="image/*" hidden />\n  ',
    // Relative, not rooted: the launcher serves the payload at /, but a hosted
    // build can sit in a subdirectory, and this resolves in both.
    '<script type="module" src="bridge.js"></script>\n  ',
  );
} else if (app === 'hazelnut-mini') {
  // Mini's page already picks its own bridge; it only needs the tightened CSP.
  fs.cpSync(path.join(ROOT, 'apps/hazelnut-mini/www'), OUT, { recursive: true });
  patchIndex(path.join(OUT, 'index.html'), '', '');
} else {
  throw new Error(`unknown app: ${app}`);
}

const count = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`payload: ${count(OUT)} files for ${app}`);
