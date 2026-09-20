# Plans, credits and the trial

## Plans

| Plan | Monthly | Yearly | Credits | Partner models | Platforms |
|---|---|---|---|:--:|---|
| Hazelnut Trial | $0 | $0 | 700, once | ✗ | Windows, Mac |
| Hazelnut | $19.99 | $199.00 | 5,000 / month | ✓ | Windows, Mac |
| Hazelnut for the Web | $0 | $0 | 700, once | ✗ | Any browser |
| Squirreal Trial | $0 | $0 | 500, once | ✓ | Windows, Mac |
| Hazelnut Squirreal | $29.99 | $299.00 | 3,000 / month | ✓ | Windows, Mac |
| Hazelnut Mini Trial | $0 | $0 | 200, once | ✓ | Windows, Mac, Android |
| Hazelnut Mini | $9.99 | $99.50 | 1,500 / month | ✓ | Windows, Mac, Android |

The column that used to say "AI" now says **partner models**, because those are
no longer the same question. Every edition has AI: Hazelnut's own image models
run on the trial and in the browser, because they run on the user's machine and
cost us nothing to give away. What the licence buys is the eleven tools that
send a picture to somebody else's model, and the bill that comes with them.

Mini and Squirreal are exceptions, deliberately: every AI tool either has is a
partner model, so withholding them would leave a trial of nothing. There, the
credit grant is the only limit.

Mini's price is not a second number that can drift — `pricing.js` derives it as
half of Hazelnut's, so changing the base changes both.

Squirreal is dearer and carries fewer credits at once, and both follow from the
same fact: a generation there is a clip rather than a frame. The allowance is
sized against heavier work, not shrunk.

## The trial that does not end

No deadline, no card, no account. It opens with 700 credits, granted once and
never topped up, and it keeps the twelve tools that run on the user's own
machine — Draw, Text, Crop, Straighten, Levels, Colour, Sharpen, Denoise,
Vignette, Expand, the AIScope zoom, and **Imagine**.

The eleven tools that call a partner model are visible and locked, because
somebody deciding whether Realtouch is worth paying for cannot decide that if
it is not on the screen.

### Why Hazelnut Free was removed

Free was what the seven-day trial lapsed into: the same editor, minus anything
that needed a model. It existed so that nobody would be locked out of their own
pictures.

An unlimited trial keeps that promise better. When the 700 credits are gone the
local tools carry on exactly as Free did — that *is* Free — and what the trial
adds on top is both of Hazelnut's own image models. Two tiers that differ only
in whether a deadline has passed is one tier and a cliff, so the cliff went.

Removing the deadline also removed the only reason the app watched the system
clock. There used to be a check that noticed time running backwards and treated
the trial as spent; a trial with no end has nothing to steal, so that check is
deleted rather than disabled, along with the false positives it gave people who
travel.

## Imagine, and why it is priced differently

Every other tool is priced against work somebody else does: more pixels up,
more frames back, a search pass. Imagine does its work on the user's processor,
so the size of the job costs us nothing and pricing it that way would be
theatre. It is priced per picture, by model and edition:

| Model | Trial | Hazelnut |
|---|---|---|
| Hazelnut 2.5 | 25 credits | **Unlimited** |
| Hazelnut 5 Pro | 350 credits | 120 credits |

Zero is a real price and means unlimited, which `isUnlimited` is how you tell
apart from "not allowed". Two rules are enforced by the test suite: a fixed
price may never exceed what the same thing costs at full rate, and paying may
never cost more than not paying.

The browser build prices as the trial rather than falling through to Pro's
numbers, and is granted the same 700 credits on first open. Those live in
localStorage and go when the site data goes, which makes them a soft limit
rather than a real one — accepted rather than worked around, because the only
thing they meter is a generator running on the visitor's own processor.

## Credits

| Tool | Cost |
|---|---|
| Draw | 0 |
| Expand | 0 — on every edition, always |
| AIScope zoom | 0, at any magnification |
| AIScope Learn | 15 |
| Magic Draw | 5–20, quoted before you commit |
| Realtouch | 20 |
| Magic Text | 12 — **4** in Eco Mode, which is its own price rather than the flat discount |
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
| Magic Text | **a crop** around the mask instead of the whole photograph |
| Squirreal | up to **4 seconds** at **12 fps** |
| Price | **40% off** everything that needs the model — except Magic Text, which gives up the most and drops from **12 to 4** |

The results are worse, and the app says so at the point of use rather than
once in a settings screen: every confirm dialog carries the line for that
particular tool — *"Eco Mode: no location lookup, so the gap is filled from the
pixels around it"* — and every price badge changes the moment the switch does.

A tool may carry its own Eco price in `ECO_PRICES`, and one does. The rule is
that a fixed Eco price can never exceed what the tool costs at full rate — Eco
Mode must not become the expensive way to buy the same thing — and a test holds
that for every entry.

**There is no figure in litres anywhere in this app, and there will not be
one.** How much water a request draws depends on the datacentre, the season and
the grid behind it; none of that is visible from the machine Hazelnut is
running on. An invented number would be worth less than nothing. What Hazelnut
can tell you is the mechanism — fewer pixels, fewer passes, fewer frames — and
it does.

Eco Mode is hidden where it would be meaningless, and **Imagine is exempt from
it entirely** — neither discounted nor degraded. Eco Mode's argument is that a
smaller request burns less in a datacentre somebody else runs. Imagine has no
datacentre: the electricity it draws is the electricity the user's own machine
draws, which was never ours to discount. Charging less for it in Eco Mode would
be claiming a saving nobody made, which is the one thing this whole section
exists to refuse.
