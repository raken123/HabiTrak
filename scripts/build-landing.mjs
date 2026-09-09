// Build the download page.
//
// Sizes and checksums are read from the files in dist/ rather than typed, so
// the page cannot drift from what it is offering. Screenshots and icons are
// inlined as data URIs, so the page is one self-contained file that works from
// a disk, a web server or an email attachment.
//
//   node scripts/build-landing.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');

const { TOOLS: CORE_TOOLS, TOOL_ORDER, LOCAL_TOOLS, costOf } = await import(
  pathToFileURL(path.join(ROOT, 'packages/core/tools.js')).href
);

const dataUri = (file, mime) =>
  `data:${mime};base64,${fs.readFileSync(path.join(SITE, file)).toString('base64')}`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fileInfo(name) {
  const file = path.join(DIST, name);
  if (!fs.existsSync(file)) return null;
  const bytes = fs.statSync(file).size;
  return {
    name,
    bytes,
    size: `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  };
}

const DOWNLOADS = [
  { os: 'src', icon: 'WEB', title: 'Hazelnut for the Web', file: 'Hazelnut-web.html',
    meta: 'Any browser · one file · the eleven local tools, no key, nothing uploaded' },
  { os: 'win', icon: 'WIN', title: 'Hazelnut for Windows', file: 'Hazelnut.exe',
    meta: 'Windows 10 or 11, 64-bit · one file, nothing to install' },
  { os: 'win', icon: 'WIN', title: 'Hazelnut Squirreal for Windows', file: 'HazelnutSquirreal.exe',
    meta: 'Windows 10 or 11, 64-bit · the video app · one file, nothing to install' },
  { os: 'win', icon: 'WIN', title: 'Hazelnut Mini for Windows', file: 'HazelnutMini.exe',
    meta: 'Windows 10 or 11, 64-bit · one file, nothing to install' },
  { os: 'mac', icon: 'MAC', title: 'Hazelnut for macOS', file: 'Hazelnut-macos.zip',
    meta: 'Apple silicon · unzip and drag Hazelnut.app to Applications' },
  { os: 'mac', icon: 'MAC', title: 'Hazelnut Squirreal for macOS', file: 'HazelnutSquirreal-macos.zip',
    meta: 'Apple silicon · unzip and drag Hazelnut Squirreal.app to Applications' },
  { os: 'mac', icon: 'MAC', title: 'Hazelnut Mini for macOS', file: 'HazelnutMini-macos.zip',
    meta: 'Apple silicon · unzip and drag to Applications' },
  { os: 'mac', icon: 'MAC', title: 'Hazelnut for macOS (Intel)', file: 'Hazelnut-macos-intel',
    meta: 'Intel Macs · run from Terminal, or drop into an app bundle' },
  { os: 'mac', icon: 'MAC', title: 'Hazelnut Squirreal for macOS (Intel)', file: 'HazelnutSquirreal-macos-intel',
    meta: 'Intel Macs' },
  { os: 'mac', icon: 'MAC', title: 'Hazelnut Mini for macOS (Intel)', file: 'HazelnutMini-macos-intel',
    meta: 'Intel Macs' },
  { os: 'linux', icon: 'LNX', title: 'Hazelnut for Linux', file: 'Hazelnut-linux-x64',
    meta: 'x86-64 · chmod +x and run' },
  { os: 'linux', icon: 'LNX', title: 'Hazelnut Squirreal for Linux', file: 'HazelnutSquirreal-linux-x64',
    meta: 'x86-64 · chmod +x and run' },
  { os: 'linux', icon: 'LNX', title: 'Hazelnut Mini for Linux', file: 'HazelnutMini-linux-x64',
    meta: 'x86-64 · chmod +x and run' },
  { os: 'linux', icon: 'AND', title: 'Hazelnut Mini for Android', file: 'HazelnutMini.apk',
    meta: 'Android 5.0 and up · sideload — allow installs from your browser or files app' },
  { os: 'src', icon: 'SRC', title: 'Source', file: 'Hazelnut-source.zip',
    meta: 'Every platform · npm install && npm start' },
];

// The tool cards come from the registry the app itself reads, so a price on
// this page and a price in the toolbar cannot disagree.
const priceLabel = (id) => {
  const tool = CORE_TOOLS[id];
  if (id === 'aiscope') return `Free · Learn ${tool.learnCost}`;
  if (!tool.ai) return 'Free';
  if (typeof tool.cost === 'object') return `${tool.cost.min}–${tool.cost.max} credits`;
  return `${tool.cost} credits`;
};

const TOOLS = TOOL_ORDER.map((id) => [
  CORE_TOOLS[id].name,
  CORE_TOOLS[id].help,
  priceLabel(id),
  !CORE_TOOLS[id].ai,
]);

const PLANS = [
  { name: 'Hazelnut Free', price: 'Free', per: '', lead: false,
    blurb: 'What is left when the model is taken away — which is most of the editor.',
    points: ['All eleven local tools', 'Layers, history, the whole workspace', 'No expiry, no account', 'Windows, Mac — and the browser'] },
  { name: 'Hazelnut', price: '$19.99', per: '/ month', lead: true,
    blurb: 'The full app. Twenty-one tools, and a monthly allowance of credits.',
    points: ['Every tool unlocked', '5,000 credits a month', 'A thousand Erases, or 250 Realtouches', 'Windows and Mac'] },
  { name: 'Hazelnut Squirreal', price: '$29.99', per: '/ month', lead: false,
    blurb: 'The same editor, pointed at moving pictures. A generation is a clip, so it costs more — and the allowance is sized for that, not shrunk.',
    points: ['3,000 credits a month', 'About 40 short clips, or 20 removals', 'Turning a clip into a GIF is free', 'Windows and Mac'] },
  { name: 'Hazelnut Mini', price: '$9.99', per: '/ month', lead: false,
    blurb: 'The remover on its own, behind one chat bar. Exactly half the price.',
    points: ['1,500 credits a month', 'About 75 removals', 'Say what should go, in words', 'Windows, Mac and Android'] },
];

// Squirreal's prices for the same six tools. A clip is not a frame, and two of
// the tools stop being generations altogether.
const VIDEO_TOOLS_PRICES = [
  ['Draw', 'Free'],
  ['Magic Draw', '40–120 credits'],
  ['Realtouch', '150 credits'],
  ['GIF Animate', 'Free — the motion is already there'],
  ['Expand', 'Never costs a credit'],
  ['AIScope', 'Free · Learn 15'],
];

const rows = DOWNLOADS.map((d) => ({ ...d, info: fileInfo(d.file) })).filter((d) => d.info);
const missing = DOWNLOADS.filter((d) => !fileInfo(d.file)).map((d) => d.file);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Hazelnut — downloads</title>
<meta name="description" content="Hazelnut is an advanced AI photo generator for Windows and Mac. Free for seven days, then it keeps working without the AI. Hazelnut Squirreal is the same editor for moving pictures, and Hazelnut Mini removes things from photos on Windows, Mac and Android for half the price." />
<link rel="icon" href="${dataUri('icon.png', 'image/png')}" />
<style>
${fs.readFileSync(path.join(SITE, 'page.css'), 'utf8')}
</style>
</head>
<body>

<header class="top">
  <div class="wrap top__in">
    <a class="brand" href="#top"><img src="${dataUri('icon.png', 'image/png')}" alt="" /> Hazelnut</a>
    <nav>
      <a href="#tools">Tools</a>
      <a href="#web">In a browser</a>
      <a href="#squirreal">Squirreal</a>
      <a href="#apps">The three apps</a>
      <a href="#pricing">Pricing</a>
      <a href="#downloads">Downloads</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="hero">
  <div class="wrap hero__in">
    <p class="eyebrow">Windows · Mac · Android</p>
    <h1>An advanced AI<br />photo generator.</h1>
    <p class="lede">Twenty-one tools in a workspace built like a photo editor should be. Eleven of them never touch a model, so they keep working for ever — free, and in a browser tab. And the core six, pointed at video, in <a href="#squirreal">Squirreal</a>.</p>
    <div class="cta" id="cta">
      <a class="btn btn--primary" href="#downloads" id="cta-primary">Download Hazelnut <small id="cta-os"></small></a>
      <a class="btn" href="#film">Watch the 3-minute film</a>
    </div>
    <p class="trial-note"><b>Free for 7 days</b>, every tool unlocked, 1,200 credits, no card. Then it becomes Hazelnut Free rather than locking.</p>
  </div>
  <div class="wrap">
    <div class="shot"><img src="${dataUri('s-editor.jpg', 'image/jpeg')}" alt="The Hazelnut editor with a photograph open, AIScope magnifying a detail at 240×." width="1800" /></div>
  </div>
</section>

<section id="tools" class="alt">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">The toolbar</p>
      <h2>Twenty-one tools. Eleven never touch a model.</h2>
      <p>Every price is quoted before anything is spent, and credits are only taken once a result actually comes back. A generation that fails, is refused, or that you cancel costs you nothing.</p>
    </div>
    <div class="tools">
      ${TOOLS.map(([name, line, cost, free]) => `<div class="tool">
        <div class="tool__top"><h3>${esc(name)}</h3><span class="cost${free ? ' cost--free' : ''}">${esc(cost)}</span></div>
        <p>${line}</p>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section id="web" class="alt">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">No download</p>
      <h2>Half of Hazelnut, in a browser tab.</h2>
      <p>The same editor — the same layer stack, the same history, the same panels — fixed to the half of the toolbox that runs on your own machine. Eleven tools work; the ten that need a model are locked and say so.</p>
    </div>
    <div class="tools">
      <div class="tool">
        <div class="tool__top"><h3>What works</h3><span class="cost cost--free">Free</span></div>
        <p>${LOCAL_TOOLS.map((id) => esc(CORE_TOOLS[id].name)).join(', ')} — and the whole workspace around them.</p>
      </div>
      <div class="tool">
        <div class="tool__top"><h3>What does not</h3><span class="cost">Desktop</span></div>
        <p>${TOOL_ORDER.filter((id) => CORE_TOOLS[id].ai).map((id) => esc(CORE_TOOLS[id].name)).join(', ')}. They need a model and a key, and both live in the desktop app.</p>
      </div>
      <div class="tool">
        <div class="tool__top"><h3>What it sends</h3><span class="cost cost--free">Nothing</span></div>
        <p>No account, no key, no upload. The picture you open is decoded in the page and stays there; there is nothing to charge and nothing to leak.</p>
      </div>
    </div>
    <p style="color:var(--muted);font-size:14px;margin-top:22px">
      Two shapes, same build. <a href="Hazelnut-web.html">Hazelnut-web.html</a> is the whole editor folded into one
      file — open it straight from your disk, or drop it on any host. The <code>web/</code> folder beside this page is
      the same thing unfolded, for hosting as a normal static site (<code>python3 -m http.server</code> inside it is
      enough; a browser will not load an ES-module app off the filesystem, which is why the single file exists).
    </p>
  </div>
</section>

<section id="apps">
  <div class="wrap apps">
    <div>
      <p class="eyebrow">Three apps</p>
      <h2>The whole editor, moving pictures, or just the one thing.</h2>
      <ul>
        <li><b>Hazelnut</b> is the full workspace: a layer stack, an undo history, dockable panels and all twenty-one tools. Windows and Mac.</li>
        <li><b>Hazelnut Squirreal</b> is that same workspace with a playhead: the core six tools, pointed at clips instead of stills. Windows and Mac.</li>
        <li><b>Hazelnut Mini</b> is the remover on its own, behind a single chat bar. Attach a photo, say what should go, and the picture that comes back becomes the one you are working on. Windows, Mac and <b>Android</b>.</li>
        <li><b>Hazelnut Free</b> is what the trial becomes. The same editor, minus anything that needs a model — the eleven tools that run locally stay, for ever.</li>
        <li><b>Hazelnut for the Web</b> is the same editor in a browser tab, limited to that same local half. No download, no account, no key.</li>
      </ul>
      <div class="note" style="margin-top:26px">
        <h4>You bring the key</h4>
        <p>The AI tools call Google’s Gemini API with your own API key, entered in Settings. It is stored on your machine and is sent nowhere but Google. The eleven local tools need no key at all.</p>
      </div>
    </div>
    <div class="mini-shot"><img src="${dataUri('s-mini.jpg', 'image/jpeg')}" alt="Hazelnut Mini: a chat bar with a photo attached and the message “remove the litter bin by the path”." width="760" /></div>
  </div>
</section>

<section id="squirreal">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">New · Windows and Mac</p>
      <h2>Hazelnut Squirreal: the same editor, for moving pictures.</h2>
      <p>Sketch one frame, say how it moves in a line, and get the shot back as a clip you can scrub. It is not a second application to learn — it is Hazelnut with a playhead under the canvas, and it runs on Gemini Omni 1.1 Flash.</p>
    </div>
    <div class="shot"><img src="${dataUri('s-squirreal.jpg', 'image/jpeg')}" alt="Hazelnut Squirreal with a two-second clip open, the transport bar under the canvas and Magic Draw quoting its price." width="1560" /></div>
    <div class="apps" style="margin-top:36px">
      <div>
        <h3 style="font-family:var(--display);font-size:26px;margin-bottom:14px">What changes</h3>
        <ul>
          <li><b>A clip costs more than a frame</b>, so Magic Draw is priced 40–120 by length, and Realtouch is 150 for the whole clip rather than 20 for one picture.</li>
          <li><b>GIF Animate stops being a generation.</b> The motion already exists, so turning a clip into a looping GIF is local work and free on every edition — including Squirreal Free.</li>
          <li><b>Realtouch removes it from every frame</b>, not just the one you painted on: it looks the place up once, then holds that answer steady as the camera moves.</li>
          <li><b>Everything else is the editor you already know</b> — layers, history, Expand, AIScope, and the same confirm-before-you-spend rule.</li>
        </ul>
      </div>
      <div>
        <div class="dl" style="gap:0">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="text-align:left">Tool</th><th style="text-align:right">In Squirreal</th></tr></thead>
            <tbody>
              ${VIDEO_TOOLS_PRICES.map(([name, cost]) => `<tr><td>${esc(name)}</td><td style="text-align:right;color:var(--muted)">${esc(cost)}</td></tr>`).join('\n              ')}
            </tbody>
          </table>
        </div>
        <p style="color:var(--muted);font-size:14px;margin-top:14px">Prices are quoted on the Submit button before anything is spent, and nothing is charged unless a clip comes back.</p>
      </div>
    </div>
  </div>
</section>

<section id="film" class="alt">
  <div class="wrap film">
    <div class="head" style="justify-items:center;text-align:center;margin-bottom:0">
      <p class="eyebrow">Three minutes</p>
      <h2>See it work.</h2>
    </div>
    <video controls preload="none" poster="${dataUri('s-poster.jpg', 'image/jpeg')}" src="Hazelnut-ad-3min.mp4"></video>
    <p style="color:var(--muted);font-size:14px;max-width:640px">Every shot is the real application. No output of any model is depicted — where a tool calls Gemini, the film shows the genuine progress and moves on. The five shorts below are the same rule: the editor in them is real, and whatever a model would have produced — the finished picture, the clip, the reading — is a placeholder standing in for it, not a model output.</p>
    <div class="shorts">
      ${[
        ['Hazelnut-short-sofa.mp4', 'p-short-sofa.jpg', 'Mini looks the place up'],
        ['Hazelnut-short-gamingpc.mp4', 'p-short-gamingpc.jpg', 'Magic Draw, in one sketch'],
        ['Hazelnut-short-car.mp4', 'p-short-car.jpg', 'Squirreal: one frame, one clip'],
        ['Hazelnut-short-van.mp4', 'p-short-van.jpg', 'Realtouch: gone from every frame'],
        ['Hazelnut-short-aiscope.mp4', 'p-short-aiscope.jpg', 'AIScope: what the picture actually holds'],
      ]
        .filter(([file]) => fs.existsSync(path.join(DIST, file)))
        .map(([file, poster, caption]) => `<figure><video controls preload="none" poster="${dataUri(poster, 'image/jpeg')}" src="${esc(file)}"></video><figcaption>${esc(caption)}</figcaption></figure>`)
        .join('\n      ')}
    </div>
  </div>
</section>

<section id="pricing">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Pricing</p>
      <h2>Seven days free. Then it does not lock.</h2>
      <p>Mini is exactly half the price of Hazelnut — in the code as well as on this page, so the two can never drift apart.</p>
    </div>
    <div class="plans">
      ${PLANS.map((p) => `<div class="plan${p.lead ? ' plan--lead' : ''}">
        ${p.lead ? '<span class="tagpill">Most complete</span>' : ''}
        <h3>${esc(p.name)}</h3>
        <div class="price">${esc(p.price)}<span> ${esc(p.per)}</span></div>
        <p style="color:var(--muted);font-size:15px">${esc(p.blurb)}</p>
        <ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section id="downloads" class="alt">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Downloads</p>
      <h2>Version 1.0.0</h2>
      <p>The Windows and macOS builds are unsigned, so both systems will warn on first launch — the steps are below. Put this page in the same folder as the files and every link here works offline.</p>
    </div>

    <div class="dl">
      ${rows.map((d) => `<div class="row" data-os="${d.os}">
        <div class="row__os">${d.icon}</div>
        <div>
          <h3>${esc(d.title)}</h3>
          <div class="meta">${esc(d.meta)}</div>
        </div>
        <div class="size">${esc(d.info.size)}</div>
        <a class="btn" href="${encodeURI(d.file)}" download>Download</a>
      </div>`).join('\n      ')}
    </div>

    <div class="dl sums" style="margin-top:28px">
      <details>
        <summary>Installing, and getting past the warnings</summary>
        <div class="details-body">
          <div>
            <h4>Windows</h4>
            <p style="color:var(--muted);font-size:15px;margin:6px 0 10px">Double-click <code>Hazelnut.exe</code>. There is nothing to install and nothing to unpack. SmartScreen will warn because the build is not code signed — choose <b>More info</b>, then <b>Run anyway</b>.</p>
          </div>
          <div>
            <h4>macOS</h4>
            <p style="color:var(--muted);font-size:15px;margin:6px 0 10px">Unzip and drag the app into Applications. It is not notarised, so Gatekeeper refuses the first launch: right-click the app and choose <b>Open</b>, or run</p>
            <pre>xattr -dr com.apple.quarantine "/Applications/Hazelnut.app"</pre>
          </div>
          <div>
            <h4>Linux</h4>
            <pre>chmod +x Hazelnut-linux-x64
./Hazelnut-linux-x64</pre>
          </div>
          <div>
            <h4>From source</h4>
            <pre>npm install
npm start               # Hazelnut
npm run start:squirreal # Hazelnut Squirreal
npm run start:mini      # Hazelnut Mini
npm test                # 81 tests</pre>
          </div>
        </div>
      </details>

      <details>
        <summary>Checksums</summary>
        <div class="details-body">
          <p style="color:var(--muted);font-size:15px">Verify with <code>sha256sum -c</code> on Linux, or <code>shasum -a 256 -c</code> on macOS.</p>
          <div style="overflow-x:auto">
            <table>
              <thead><tr><th>File</th><th>Size</th><th>SHA-256</th></tr></thead>
              <tbody>
                ${rows.map((d) => `<tr><td>${esc(d.file)}</td><td>${esc(d.info.size)}</td><td class="hash">${d.info.sha256}</td></tr>`).join('\n                ')}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>

    <div class="note" style="margin-top:28px">
      <h4>Six megabytes, not a hundred and ten</h4>
      <p>These builds carry the application and borrow the browser engine your computer already has, opening in a real app window rather than a browser tab. Windows always has one. On macOS and Linux, install Chrome, Edge, Brave or Chromium if you have none — without one the app falls back to opening in your default browser, which works but keeps the browser’s own toolbar.</p>
    </div>

    <div class="note note--warn" style="margin-top:16px">
      <h4>The Android build is signed with a debug key</h4>
      <p>It installs and runs, but Android will show the usual warning for an app from outside the Play Store, and a debug key cannot be used to publish. A release key belongs in the build workflow, not in a download page.</p>
      <p style="margin-top:8px">There is no .dmg or .msi: an installer package needs a Mac and NSIS respectively. The apps above need neither — there is nothing to install.</p>
    </div>
  </div>
</section>

</main>

<footer>
  <div class="wrap">
    <span>Hazelnut 1.0.0 — an advanced AI photo generator. Squirreal 1.0.0 — the same, for video.</span>
    <span>Draw and Expand never leave your machine.</span>
  </div>
</footer>

<script>
  // Point the hero button at the build for whoever is reading, and mark that
  // row, without pretending to know more than the user agent says.
  (function () {
    var ua = navigator.userAgent;
    var os = /Windows/i.test(ua) ? 'win' : /Mac|iPhone|iPad/i.test(ua) ? 'mac' : /Linux|Android/i.test(ua) ? 'linux' : null;
    if (!os) return;
    var label = { win: 'for Windows', mac: 'for macOS', linux: 'for Linux' }[os];
    document.getElementById('cta-os').textContent = label;
    var row = document.querySelector('.row[data-os="' + os + '"]');
    if (!row) return;
    row.classList.add('is-you');
    var link = row.querySelector('a.btn');
    var cta = document.getElementById('cta-primary');
    cta.setAttribute('href', link.getAttribute('href'));
    cta.setAttribute('download', '');
  })();
</script>
</body>
</html>
`;

fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, 'Hazelnut-downloads.html');
fs.writeFileSync(out, html);

console.log(`${path.relative(ROOT, out)} — ${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${rows.length} downloads listed`);
if (missing.length) console.log(`not built, so not listed: ${missing.join(', ')}`);
