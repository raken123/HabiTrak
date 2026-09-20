# Plans, credits and the trial

## Plans

| Plan | Monthly | Yearly | Credits | AI | Platforms |
|---|---|---|---|:--:|---|
| Hazelnut Free | $0 | $0 | — | ✗ | Windows, Mac |
| Hazelnut | $19.99 | $199.00 | 5,000 / month | ✓ | Windows, Mac |
| Squirreal Free | $0 | $0 | — | ✗ | Windows, Mac |
| Hazelnut Squirreal | $29.99 | $299.00 | 3,000 / month | ✓ | Windows, Mac |
| Hazelnut Mini | $9.99 | $99.50 | 1,500 / month | ✓ | Windows, Mac, Android |

Mini's price is not a second number that can drift — `pricing.js` derives it as
half of Hazelnut's, so changing the base changes both.

Squirreal is dearer and carries fewer credits at once, and both follow from the
same fact: a generation there is a clip rather than a frame. The allowance is
sized against heavier work, not shrunk.

## The 7-day trial

Every tool unlocked, 1,200 credits, no card, no account. It starts when the user
presses the button, not at install, so nothing is burned by someone who opened
the app once.

When it ends the app does **not** lock. It becomes **Hazelnut Free**: the same
editor, the same layers, the same history, with the eleven local tools — Draw,
Text, Crop, Straighten, Levels, Colour, Sharpen, Denoise, Vignette, Expand and
the AIScope zoom — still working, and the ten model-backed tools showing a
padlock.

**Hazelnut for the Web** is that same half in a browser tab: no download, no
account, no key, nothing uploaded.

The trial is measured against the local clock, and a clock wound backwards
spends it rather than extending it. That is a speed bump, not a licence server —
see `docs/ARCHITECTURE.md`.

## Credits

| Tool | Cost |
|---|---|
| Draw | 0 |
| Expand | 0 — on every edition, always |
| AIScope zoom | 0, at any magnification |
| AIScope Learn | 15 |
| Magic Draw | 5–20, quoted before you commit |
| Realtouch | 20 |
| GIF Animate | 600 for five seconds, pro-rated down to a floor of 60 |

### In Squirreal

| Tool | Cost |
|---|---|
| Draw, Expand, AIScope zoom | 0, as in Hazelnut |
| GIF Animate | **0** — the motion already exists, so the encode is local |
| AIScope Learn | 15 |
| Magic Draw | 40–120, quoted before you commit. Length carries 0.55 of the weight; coverage, palette and output size carry the rest |
| Realtouch | 150 a clip, pro-rated down to a floor of 45 for a short one |

At 3,000 credits a month that is about 40 short clips, or 20 clip-wide removals.
Squirreal's trial grants 900.

At 5,000 credits a month, Hazelnut is 250 removals, or 8 full-length GIFs, or
around 330 Magic Draws. Mini's 1,500 is 75 removals.

Squirreal's ledger is priced from the video registry rather than the still one:
`Credits` takes its cost function by injection, so a clip can never be billed at
a frame's price by accident.

**Nothing is charged until a result exists.** Every movement is written to a
ledger the Plans dialog shows, so "where did my credits go" has an answer in the
app.

Licence keys are `HZL-XXXXX-XXXXX-XXXXX-XXXXX` over an alphabet with no I, L, O
or U, so nothing can be mistyped for 1, 0 or V.


---

## Eco Mode

A generation is not free of the world. The datacentre that serves it burns
electricity, and the machines doing it are cooled — in many places with water.
Eco Mode asks for less of all of it:

| | |
|---|---|
| Pictures sent | no more than **1,024px** on the longest side |
| Realtouch | **no location lookup** — one model call instead of two |
| GIF Animate | **half** the keyframes |
| Squirreal | up to **4 seconds** at **12 fps** |
| Price | **40% off** everything that needs the model |

The results are worse, and the app says so at the point of use rather than
once in a settings screen: every confirm dialog carries the line for that
particular tool — *"Eco Mode: no location lookup, so the gap is filled from the
pixels around it"* — and every price badge changes the moment the switch does.

**There is no figure in litres anywhere in this app, and there will not be
one.** How much water a request draws depends on the datacentre, the season and
the grid behind it; none of that is visible from the machine Hazelnut is
running on. An invented number would be worth less than nothing. What Hazelnut
can tell you is the mechanism — fewer pixels, fewer passes, fewer frames — and
it does.

Eco Mode is hidden where it would be meaningless: on Hazelnut Free and in the
browser build, nothing calls a model, so there is nothing to save.
