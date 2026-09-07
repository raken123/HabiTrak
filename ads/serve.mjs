// Static server for the ad recording.
//
// Serves the two real apps out of the repository, the shared core they import,
// and the ad scene — injecting the recording bridge into each app's page ahead
// of its own entry module, which is the one thing the recording changes.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.AD_PORT || 8732);

// Longest prefix first: the apps import the shared core as `../../core/*`,
// which resolves under their own prefix, not at the root.
const ROOTS = {
  '/hazelnut/core/': path.join(ROOT, 'packages', 'core'),
  '/squirreal/core/': path.join(ROOT, 'packages', 'core'),
  '/mini/core/': path.join(ROOT, 'packages', 'core'),
  '/icons/': path.join(ROOT, 'apps'),
  '/hazelnut/': path.join(ROOT, 'apps', 'hazelnut', 'renderer'),
  // Squirreal is the same renderer; only the bridge differs.
  '/squirreal/': path.join(ROOT, 'apps', 'hazelnut', 'renderer'),
  '/mini/': path.join(ROOT, 'apps', 'hazelnut-mini', 'www'),
  '/core/': path.join(ROOT, 'packages', 'core'),
  // Media the ads build for themselves — kept out of the repository.
  '/assets/': path.join(ROOT, '.build'),
};

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.icns': 'application/octet-stream',
  '.webm': 'video/webm', '.mp4': 'video/mp4',
};

const INSTALL = {
  '/hazelnut/': 'installHazelnutStub',
  '/squirreal/': 'installSquirrealStub',
  '/mini/': 'installMiniStub',
};

function resolveFile(pathname) {
  for (const [prefix, dir] of Object.entries(ROOTS)) {
    if (pathname.startsWith(prefix)) {
      const rest = pathname.slice(prefix.length) || 'index.html';
      return { file: path.join(dir, rest), prefix };
    }
  }
  return { file: path.join(HERE, pathname === '/' ? 'scene.html' : pathname.slice(1)), prefix: null };
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const { file, prefix } = resolveFile(decodeURIComponent(pathname));

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }

    if (file.endsWith('index.html') && prefix) {
      const install = INSTALL[prefix];
      buf = Buffer.from(String(buf)
        // The apps' own CSP forbids the cross-origin module import below; the
        // shipped pages keep it, the recording does not need it.
        .replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '')
        .replace('<script type="module"',
          `<script type="module">import { ${install} } from '/stubs.js'; ${install}();</script>\n  <script type="module"`));
    }

    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`ad harness on http://127.0.0.1:${PORT}`));
