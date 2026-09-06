# Plans, credits and the trial

## Plans

| Plan | Monthly | Yearly | Credits | AI | Platforms |
|---|---|---|---|:--:|---|
| Hazelnut Free | $0 | $0 | — | ✗ | Windows, Mac |
| Hazelnut | $19.99 | $199.00 | 5,000 / month | ✓ | Windows, Mac |
| Hazelnut Mini | $9.99 | $99.50 | 1,500 / month | ✓ | Windows, Mac, Android |

Mini's price is not a second number that can drift — `pricing.js` derives it as
half of Hazelnut's, so changing the base changes both.

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

At 5,000 credits a month, Hazelnut is 250 removals, or 8 full-length GIFs, or
around 330 Magic Draws. Mini's 1,500 is 75 removals.

**Nothing is charged until a result exists.** Every movement is written to a
ledger the Plans dialog shows, so "where did my credits go" has an answer in the
app.

Licence keys are `HZL-XXXXX-XXXXX-XXXXX-XXXXX` over an alphabet with no I, L, O
or U, so nothing can be mistyped for 1, 0 or V.
