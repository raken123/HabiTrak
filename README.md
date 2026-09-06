# Hazelnut

**An advanced AI photo generator for Windows and Mac.** Free for 7 days, then it
keeps working — without the AI — as Hazelnut Free.

Three products, one codebase:

| | What it is | Platforms | Price |
|---|---|---|---|
| **Hazelnut** | The full editor: six tools, layers, history, a Photoshop-style workspace | Windows, Mac | $19.99 / month |
| **Hazelnut Mini** | One chat bar that removes things from photos | Windows, Mac, **Android** | $9.99 / month — half of Hazelnut |
| **Hazelnut Free** | Hazelnut with **no AI**. Everything that runs locally, forever, at no cost | Windows, Mac | Free |

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

Magic Draw's price moves inside its band with how much of the canvas you painted,
how many colours you used and how large the output is — the Submit button quotes
the real number before you commit. See [`docs/TOOLS.md`](docs/TOOLS.md) for the
detail.

**Credits are only taken when a result comes back.** A failed or cancelled
generation costs nothing.

---

## Running it

Node 20 or newer, then from the repository root:

```bash
npm install          # links the workspace packages
npm start            # Hazelnut
npm run start:mini   # Hazelnut Mini
npm test             # the core test suite
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

Draw, Expand and the AIScope zoom work with no key at all.

### Building installers

```bash
npm run dist:hazelnut   # .exe (NSIS + portable) and .dmg
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
                      the Gemini client and a dependency-free GIF encoder
apps/hazelnut/        Electron desktop app: main process + renderer
apps/hazelnut-mini/   Electron desktop app + Capacitor Android app
scripts/              icon generation
```

The renderer is sandboxed: no Node, no filesystem, no network. Everything
privileged goes through a named IPC surface, and the API key never crosses into
the page — only the fact that one is configured. More in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tests

```bash
npm test
```

52 tests over the parts that can be tested without a screen: the credit and
trial rules, the tool gating, the engine's orchestration (against a fake model),
the image header parsing, and the GIF encoder — which is round-tripped through
an independently written decoder to prove the LZW code-size handling is right.

## Licence

UNLICENSED — all rights reserved.
