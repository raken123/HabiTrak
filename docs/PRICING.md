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
editor, the same layers, the same history, with Draw, Expand and the AIScope
zoom still working and the model-backed tools showing a padlock.

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
