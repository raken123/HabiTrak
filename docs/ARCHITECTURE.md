# Architecture

```
packages/core/          the engine, shared by both apps
  pricing.js            plans and prices — Mini is half of Hazelnut, by arithmetic
  tools.js              the tool registry, the cost model, the edition gate
  license.js            edition and the trial that does not end
  models.js             Hazelnut's own image models: prices, limits, who thinks
  imagine-plan.js       prompt -> scene. Pure: no canvas, testable in Node
  imagine-paint.js      scene -> pixels. Two renderers over one geometry
  credits.js            balances, the ledger, charge-on-success
  store.js              durable JSON state (Node)
  keystore.js           where the API key comes from (Node)
  gemini.js             the Gemini client — fetch only, runs in Node and browsers
  prompts.js            every prompt the product sends, in one file
  engine.js             one method per AI tool: gate, quote, run, charge
  gif.js                a dependency-free GIF89a encoder
  imaging.js            data URLs and image header parsing, no Node built-ins
  video-tools.js        the same registry for clips — length is most of the price
  video.js              the video client: start an operation, poll it, take the
                        clip out. UNVERIFIED against the real API, and says so
  video-prompts.js      the prompts a clip needs, including holding still
  video-engine.js       gate, quote, run, charge — for moving pictures

apps/hazelnut/
  electron/main.js      window, menus, IPC, file dialogs, the custom protocol
  electron/preload.cjs  the only bridge into the page
  renderer/             the editor: document, layers, history, viewport, tools

apps/hazelnut-squirreal/
  electron/main.js      the video app's main process. It serves Hazelnut's
                        renderer rather than a copy: same editor, different
                        engine behind the same IPC channel names
  web/bridge.js         the standalone build's bridge, video engine behind it

apps/hazelnut-mini/
  electron/             the desktop build, same shape as Hazelnut's
  www/                  the page — shared by desktop and Android
  www/js/web-bridge.js  the browser implementation of the same bridge
  scripts/sync-core.mjs copies the browser-safe core into www/vendor/core
```

## How Squirreal is the same app

The renderer reads `product` out of the state its bridge returns. When it is
`squirreal` it adds a playhead, renames itself, and hands the tools an
`app.isVideo` flag; everything else — layers, history, the viewport, the
confirm-before-you-spend rule — is the code Hazelnut runs. There is no second
editor to keep in step, and no `if (video)` scattered through the drawing code:
the clip lives in the document's background layer, so a tool that knows nothing
about video still works on the frame the playhead is parked on.

## Three rules the rest of the code leans on

**1. The renderer is not trusted.** `contextIsolation` on, `nodeIntegration`
off, and a Content-Security-Policy with `default-src 'none'`. The page cannot
read a file, open a socket, or see the API key — it only learns whether one is
configured. Everything privileged is a named IPC channel in `preload.cjs`.

**2. Credits move only when a result exists.** `Credits.charge()` takes the work
as a callback, runs it, and debits only after it resolves. A model error, a
network failure or a cancellation costs the user nothing, and there is no code
path that can charge twice for one run.

**3. One place decides what an edition may do.** `tools.availability()` answers
for the toolbar, the menus, the engine and both apps. Adding a tool means adding
one registry entry, not touching five gates.

## Why the renderer is served over `hazelnut://`

Chromium refuses to load ES module scripts from `file://` — such pages have an
opaque origin, so the module fetch fails CORS. Both apps register a privileged
scheme and serve the renderer from it, which gives the page a real origin,
makes the CSP meaningful, and lets `apps/hazelnut-mini` reuse the same page on
Android where the origin is `https://localhost` instead.

The handler refuses any path that resolves outside the directory it serves.

## Why the GIF encoder is hand-written

`GIF Animate` has to produce a real `.gif`. A native encoder means a build
toolchain per platform for one feature. The encoder in `gif.js` is plain
JavaScript: median-cut quantisation to a shared palette across all frames,
Floyd–Steinberg dithering, and GIF's variable-width LZW.

LZW code-size growth is easy to get wrong by one code in either direction, and
the failure mode is a file that some decoders read and others do not. The tests
round-trip the encoder's output through a **separately written decoder**,
including a 120,000-symbol random input that fills the dictionary and forces the
reset at 4096.

## Where the two apps diverge

Hazelnut's main process owns the engine and the key. Mini does the same on the
desktop — but on Android there is no main process, so `www/js/web-bridge.js`
runs the identical `@hazelnut/core` engine in the page and keeps the key in
`localStorage`. Both bridges expose the same methods, so `www/js/app.js` cannot
tell which one it is talking to.

That is only possible because `gemini.js`, `engine.js` and their dependencies
import nothing from `node:`. `sync-core.mjs` enforces it: the copy step fails if
a module it is about to ship to the browser has picked up a Node import.

## State on disk

| | Windows | macOS | Linux |
|---|---|---|---|
| State | `%APPDATA%\Hazelnut\state.json` | `~/Library/Application Support/Hazelnut/` | `~/.config/hazelnut/` |
| Key | `gemini.json` in the same directory, mode 600 | | |

Writes go through a temp file and a rename, so a crash cannot truncate a credit
balance. A corrupt file is moved aside rather than blocking startup.

## Why Imagine is split in two

Everything else in `engine.js` is one method that gates, quotes, calls a model
and charges. Imagine could not be, because its model runs on the user's canvas
and there is no canvas in the Electron main process.

So it is split along a different seam. `imagine-plan.js` turns a prompt into a
scene and touches nothing — no canvas, no DOM — which is why the planner is
tested in Node with no browser, including the arithmetic on a generated
worksheet. `imagine-paint.js` takes that scene and a 2D context, and runs
unchanged in the Electron renderer, in the browser build, and in the ad
harness. That last one is why the Imagine film could show real output instead
of a stand-in.

The consequence is that the work happens in the renderer and only the money
happens in the main process. Charge-on-success is preserved by keeping the same
order across the boundary: the renderer quotes, draws, and only then asks to be
charged. A generation that throws or is abandoned never reaches the charge.

The two renderers share one geometry deliberately. Objects are written down
once as plain parts, and the models are the two functions that draw a part —
so Hazelnut 2.5's inability to write or draw hands falls out of *how* it draws
rather than being applied to the result afterwards.

## The trial

It does not end. There is no date to reach and no countdown to show; the only
thing that runs out is the opening grant of credits, and when it does the
twelve tools that run on the user's own machine carry on working.

This used to be seven days measured against the local clock, with a check that
noticed the clock being wound back and spent the trial rather than letting it
be extended. That check has been **deleted**, not disabled: a trial with no end
has nothing to steal, so the deterrent protected nothing and its false
positives — which fell on people who travel — were pure cost.

What the licence gates instead is the **partner models**: the eleven tools that
send a picture to Gemini. That is a bill somebody has to pay, so it is what the
money is attached to. Hazelnut's own image models run on every edition,
including the browser build, because they run on the user's processor.

Key validation is still shape-only. A real licence server would be the answer,
and `License.activate()` is where that call belongs.
