# Hazelnut

**An advanced AI photo generator for Windows and Mac.** Free for 7 days, then it
keeps working — without the AI — as Hazelnut Free.

Five products, one codebase:

| | What it is | Platforms | Price |
|---|---|---|---|
| **Hazelnut** | The full editor: twenty-one tools, layers, history, a Photoshop-style workspace | Windows, Mac | $19.99 / month |
| **Hazelnut Squirreal** | The same editor, pointed at moving pictures. Sketch a frame, say how it moves, get a clip | Windows, Mac | $29.99 / month |
| **Hazelnut Mini** | A chat bar that removes things, and twelve tools above it — six of them free | Windows, Mac, **Android** | $9.99 / month — half of Hazelnut |
| **Hazelnut Free** | Hazelnut with **no AI**. The eleven tools that run locally, forever, at no cost | Windows, Mac | Free |
| **Hazelnut for the Web** | The same editor in a browser tab, fixed to that local half. No download, no account, no key | Any browser | Free |

Everyone starts on a **7-day trial** with every tool unlocked and 1,200 AI
credits. When it ends the editor does not lock: it becomes Hazelnut Free.

---

## The tools

| Tool | What it does | Cost |
|---|---|---|
| **Draw** | A plain brush. Pick a colour and paint. Nothing leaves the machine. | Free |
| **Magic Draw** | Sketch in 2D, press Submit, and the realistic version of your drawing comes to life. Trial or full only. | 5–20 credits |
| **Realtouch** | An object remover that works out *where the photo was taken*, looks the place up, and reasons about what is physically behind the thing before it paints the gap. | 20 credits |
| **GIF Animate** | Up to five seconds of generated frames, encoded into a looping GIF. | 600 credits |
| **Expand** | Grows the canvas, mirroring the edges so the new margin blends in. | **Never costs a credit** |
| **AIScope** | Zooms 80× to 60,000×. The zoom is free at any magnification; *Learn* studies the magnified crop and writes down what the thing is. | Free · Learn 15 |

### The fifteen that came after

Eight run on your machine and cost nothing; seven call the model and are priced
well under the tools above, because none of them buys a search pass or a run of
frames — each is one edit to a photograph that already exists.

| Tool | What it does | Cost |
|---|---|---|
| **Crop** | Drag a box, or type the numbers. Trims the canvas and every layer. | Free |
| **Straighten** | Rotate by eye; the corners the rotation exposes are trimmed off. | Free |
| **Levels** | Black point, white point, gamma. | Free |
| **Colour** | Warmth, tint and saturation, with the luma held. | Free |
| **Sharpen** | A real unsharp mask, with a radius and a threshold. | Free |
| **Denoise** | A median filter mixed back in, edge-aware. | Free |
| **Vignette** | Radial darkening, and monochrome grain if you want it. | Free |
| **Text** | Click, type, apply. | Free |
| **Caption** | A caption, an alt text and keywords. Nothing is generated. | 3 credits |
| **Erase** | Realtouch without the research: a clean fill from what is around the mask. | 5 credits |
| **Background** | Cut the subject out, or replace what is behind it. | 5 credits |
| **Sky** | A new sky, with the light underneath relit to match. | 6 credits |
| **Colourise** | Colour for a black-and-white photograph — an interpretation, not a recovery. | 6 credits |
| **Upscale** | Twice the size, with the detail rebuilt. | 8 credits |
| **Restore** | Scratches, creases, fading and damp on a scanned print. | 8 credits |

Eleven of the twenty-one never call a model. That half is what Hazelnut Free
keeps, and what **Hazelnut for the Web** ships:

```sh
node scripts/stage-payload.mjs hazelnut-web dist/web
cd dist/web && python3 -m http.server 8080     # then open http://localhost:8080
```

The browser build is fixed to the `web` edition: the eleven local tools work,
the ten that need a model are locked and say so, and nothing is uploaded —
there is no key and no account.

Magic Draw's price moves inside its band with how much of the canvas you painted,
how many colours you used and how large the output is — the Submit button quotes
the real number before you commit. See [`docs/TOOLS.md`](docs/TOOLS.md) for the
detail.

**Credits are only taken when a result comes back.** A failed or cancelled
generation costs nothing.

### The original six tools in Squirreal

A generation there is a clip rather than a frame, so two prices move and two
tools stop being generations at all:

| Tool | In Squirreal | Cost |
|---|---|---|
| **Draw** | Paints on the frame the playhead is parked on | Free |
| **Magic Draw** | Sketch one frame, describe the movement, get the shot back as a clip | 40–120 credits, mostly by length |
| **Realtouch** | Removes the thing from *every* frame, holding one answer steady as the camera moves | 150 credits a clip |
| **GIF Animate** | The motion already exists, so this is a local encoder | **Free, on every edition** |
| **Expand** | Grows the frame, on every frame of the clip | **Never costs a credit** |
| **AIScope** | The still tool, on whichever frame you are parked on | Free · Learn 15 |

Squirreal's plan carries 3,000 credits a month rather than Hazelnut's 5,000: a
clip is heavier work, not less of it. It runs on **Gemini Omni 1.1 Flash**.

> **One caveat, stated plainly.** `packages/core/video.js` is written against an
> *assumed* request shape for the video model — a long-running operation started
> at `:predictLongRunning` and polled until it reports done — because this
> machine cannot reach Google to check. The model name, the call mode and the
> start method are each overridable by environment variable
> (`HAZELNUT_VIDEO_MODEL`, `HAZELNUT_VIDEO_MODE`, `HAZELNUT_VIDEO_START`), so if
> the real endpoint differs it is a configuration change rather than a code
> change. Everything around it — the gating, the pricing, the ledger, the
> editor — is exercised by the test suite.

---

## Running it

Node 20 or newer, then from the repository root:

```bash
npm install          # links the workspace packages
npm start                # Hazelnut
npm run start:squirreal  # Hazelnut Squirreal
npm run start:mini       # Hazelnut Mini
npm test                 # the core test suite
```

### Your API key

The AI tools call Google's **Gemini 2.5 Flash Image** API with **your own key**.
No key ships with the app.

```bash
cp .env.example .env
# then put your key in HAZELNUT_GEMINI_API_KEY
```

Or paste it into **Settings → AI** inside the app, which writes it to the
per-user application directory with owner-only permissions. Either way it stays
on your machine and is sent nowhere but Google.

Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

> **Never commit a key.** Anything that has been pasted into a chat, an issue or
> a commit should be treated as public and revoked. `.env` is git-ignored, and
> nothing in this repository contains a key.

The eleven local tools work with no key at all.

### Building installers

```bash
npm run dist:hazelnut   # .exe (NSIS + portable) and .dmg
npm run dist:squirreal  # the same for Squirreal
npm run dist:mini       # the same for Mini
node scripts/make-icons.mjs   # regenerate the app icons
```

macOS builds are signed and notarised by `electron-builder` when the usual
`CSC_*` and `APPLE_*` environment variables are present; without them you get an
unsigned build that is fine for local use.

### Android (Mini only)

See [`apps/hazelnut-mini/README.md`](apps/hazelnut-mini/README.md).

---

## How it is put together

```
packages/core/        the engine — editions, trial, credits, tools, prompts,
                      the Gemini client and a dependency-free GIF encoder.
                      video-tools.js, video.js and video-engine.js are the
                      same three ideas for clips
apps/hazelnut/        Electron desktop app: main process + renderer
apps/hazelnut-squirreal/  Electron desktop app for video. It has no renderer of
                      its own: it serves Hazelnut's, which notices the product
                      in its state and grows a playhead
apps/hazelnut-mini/   Electron desktop app + Capacitor Android app
scripts/              icons, packaging without electron-builder, the download page
ads/                  the films — they drive the real apps in a headless browser
```

The renderer is sandboxed: no Node, no filesystem, no network. Everything
privileged goes through a named IPC surface, and the API key never crosses into
the page — only the fact that one is configured. More in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tests

```bash
npm test
```

81 tests over the parts that can be tested without a screen: the credit and
trial rules, the tool gating, the engine's orchestration (against a fake model),
the image header parsing, the video pricing and client, and the GIF encoder —
which is round-tripped through an independently written decoder to prove the
LZW code-size handling is right.

## Licence

UNLICENSED — all rights reserved.
