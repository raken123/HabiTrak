# Hazelnut

**An advanced AI photo generator for Windows and Mac.** Free for ever, with no
deadline — and with two image models of our own that run on your machine.

Four products, one codebase:

| | What it is | Platforms | Price |
|---|---|---|---|
| **Hazelnut** | The full editor: twenty-three tools, layers, history, a Photoshop-style workspace | Windows, Mac | $19.99 / month |
| **Hazelnut Squirreal** | The same editor, pointed at moving pictures. Sketch a frame, say how it moves, get a clip | Windows, Mac | $29.99 / month |
| **Hazelnut Mini** | A chat bar that removes things, and thirteen tools above it — six free, plus Imagine on the phone itself | Windows, Mac, **Android** | $9.99 / month — half of Hazelnut |
| **Hazelnut for the Web** | The same editor in a browser tab, fixed to the local set — Imagine included. No download, no account, no key | Any browser | Free |

Everyone starts on a **trial that never expires**. It has no deadline and no
card, it opens with 700 credits that are never topped up, and it keeps the
twelve tools that run on your machine — including both of Hazelnut's own image
models. What it does not include is the **partner models**: the eleven tools
that send your picture to Gemini. Those are what the licence pays for.

> **Hazelnut Free has been removed.** It was the edition the seven-day trial
> lapsed into: the whole editor, minus anything that needed a model. The
> unlimited trial keeps that promise better — the local tools never stop, and
> now the generator is among them — so Free is gone rather than sitting
> alongside it.

### Hazel the Squirrel

The mascot, and the one holding the acorn. She turns up over an empty canvas,
in the welcome dialog, and beside the explanation when a tool is behind the
licence. Eight poses are cut from one character sheet by `npm run mascot`; see
`docs/MASCOT.md` for how, and for the rule that she is decoration — everything
she appears beside reads the same with images turned off.

### Imagine — our own image models

The twenty-third tool, and the first that makes a picture rather than changing
one. There is no diffusion model in here and no weights to download: Hazelnut
2.5 and Hazelnut 5 Pro are synthesisers that read a prompt, decide what is in
the picture and draw it, on your own processor, with no key and no account.

| | What it is | Trial | Hazelnut |
|---|---|---|---|
| **Hazelnut 2.5** | Soft, round and unmistakably generated. Cannot write; cannot draw hands | 25 credits | **Unlimited** |
| **Hazelnut 5 Pro** | Real edges, real type, five fingers — and it thinks before it draws | 350 credits | 120 credits |

Prices are per picture. The two failures in 2.5 are structural rather than
styled: everything it draws is built from soft radial gradients, so a letter
comes out as a letter-shaped mark and a hand comes out with six or seven
fingers fused into a mitten.

**5 Pro thinks only on Hazelnut**, and that is the difference worth
understanding. The planning pass generates content and then checks it — a
worksheet's arithmetic is solved, and anything that does not come out whole is
rejected and drawn again. Without it the sheet is set beautifully and nothing is
verified: divisions by zero, roots of negative numbers, and answers that were
never computed. That is more dangerous than 2.5's gibberish, because it looks
*more* correct while being less correct — so any picture that asserts something
unchecked carries a **NOT CHECKED** band drawn into the image itself, not into
the window around it.

Eco Mode does not touch Imagine and does not discount it. Eco Mode's whole
argument is that a smaller request burns less in somebody else's datacentre;
there is no datacentre here, so there is no saving, and charging less for it
would be claiming one nobody made.

**Eco Mode** is in all three apps. It asks the model for less — pictures sent at
1,024px, Realtouch's location lookup skipped, half the GIF keyframes, shorter
clips, and Magic Text sent a crop around the words rather than the whole
photograph — which is less electricity and less water drawn by the datacentre
that serves it, and 40% off the price (Magic Text, which gives up the most,
drops from 12 credits to 4). The results are worse, and every dialog says
so. There is no figure in litres anywhere in the app: that number depends on the
datacentre and the grid, neither of which is visible from your machine.

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

### And a twenty-second: Magic Text

| Tool | What it does | Cost |
|---|---|---|
| **Magic Text** | Paint over the lettering in the photograph, type what it should say instead, press Generate. | 12 credits · 4 in Eco Mode |

It is a masked edit like Erase, pointed at words rather than at something you
want gone: the new lettering is set in the typeface that is already there, on
the same baseline, at the same angle, under the same light, and fitted to the
space rather than allowed to run off the sign. Nothing outside the mask changes.
It refuses to run without both a mask and words, so it cannot spend 12 credits
putting the same sign back.

In Eco Mode it is sent a crop around the mask instead of the whole photograph —
a much smaller request, which is why it costs 4 rather than the 8 the flat
discount would give. The model is then matching a typeface it can only see a few
centimetres of, and the dialog says so before you spend anything.

Twelve of the twenty-three never leave your machine. That set is what the trial
keeps for ever, and what **Hazelnut for the Web** ships:

```sh
node scripts/stage-payload.mjs hazelnut-web dist/web
cd dist/web && python3 -m http.server 8080     # then open http://localhost:8080
```

The browser build is fixed to the `web` edition: the twelve local tools work —
Imagine among them, so a browser tab with no account can generate a picture —
the eleven that call a partner model are locked and say so, and nothing is
uploaded. There is no key and no account.

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

The twelve local tools work with no key at all, Imagine included.

### Building installers

```bash
npm run dist:aab        # dist/HazelnutMini.aab — the Play Store bundle
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

128 tests over the parts that can be tested without a screen: the credit and
trial rules, the tool gating and pricing (Eco Mode included), the engine's
orchestration against a fake model, the image header parsing, the video pricing
and client, the local adjustments, and the GIF encoder —
which is round-tripped through an independently written decoder to prove the
LZW code-size handling is right.

## Licence

UNLICENSED — all rights reserved.
