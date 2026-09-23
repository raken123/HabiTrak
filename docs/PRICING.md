# Plans, credits and the trial

## Plans

| Plan | Monthly | Yearly | Credits | Partner models | Platforms |
|---|---|---|---|:--:|---|
| Hazelnut Trial | $0 | $0 | 700, once | ✗ | Windows, Mac |
| Hazelnut | $19.99 | $199.00 | 5,000 / month | ✓ | Windows, Mac |
| Hazelnut for the Web | $0 | $0 | 700, once | ✗ | Any browser |
| Squirreal Trial | $0 | $0 | 500, once | ✓ | Windows, Mac |
| Hazelnut Squirreal | $29.99 | $299.00 | 3,000 / month | ✓ | Windows, Mac |
| Hazelnut Mini Trial | $0 | $0 | 700, once | ✗ | Windows, Mac, Android |
| Hazelnut Mini | $9.99 | $99.50 | 1,500 / month | ✓ | Windows, Mac, Android |

The column that used to say "AI" now says **partner models**, because those are
no longer the same question. Every edition has AI: Hazelnut's own image models
run on the trial and in the browser, because they run on the user's machine and
cost us nothing to give away. What the licence buys is the eleven tools that
send a picture to somebody else's model, and the bill that comes with them.

Squirreal is the one exception left, deliberately: every AI tool it has is a
video model somebody else runs, so withholding them would leave a trial of the
GIF encoder. There, the credit grant is the only limit.

Mini used to be an exception for the same reason and is not any more. Imagine
runs on the phone, so Mini's trial has something of its own to offer and is now
Hazelnut's trial exactly — same grant, same rules.

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

## Offers

An offer is a price and a deadline, and both are easy to get quietly wrong — a
discount typed into a banner drifts from the one the app applies, and a
deadline written as prose is still on the page in March. So an offer is
declared once, in `packages/core/offers.js`, and the app's banner, the redeem
dialog, the plan cards and the download page all read from it. None of them
holds a copy of the percentage, the price or the date.

### The fall deal

**98% off Hazelnut**, closing **13 November 2026** (end of day, UTC). Hazelnut
is $0.40 a month instead of $19.99, or $3.98 a year instead of $199 — both
figures computed from the plan's own price and the offer's own percentage, so
a change to either moves every number on every surface at once.

It covers `hazelnut-pro` and nothing else. Mini and Squirreal are not in it,
which the redemption path enforces rather than merely displays: a well-formed
Hazelnut voucher typed into Mini is refused, because every other check —
shape, deadline, not-already-redeemed — would otherwise pass it.

### The deadline is on claiming, not on keeping

Redeem the deal and it is yours. When the offer closes it stops being
redeemable; it does not reach back and take the app away. A deadline that did
that would make this a rental, and it is not sold as one. In the code: the
date is checked in `License.redeem` and nowhere else, and `edition()` returns
`pro` for a redeemed offer without consulting the clock.

The banner does disappear on the 14th, everywhere, without anybody
remembering to remove it — the app asks `activeOffer()` on each render, and the
download page asks it at build time.

### Access codes

`FALL-XXXXX-XXXXX`, in the same unambiguous alphabet the licence keys use — no
I, O or U, so nobody mistypes 1, 0 or V.

An access code is not a licence key, and the two validators will not accept
each other's input; a test holds them to that in both directions. Putting a
voucher in the licence box gets "that is an offer access code, not a licence
key", not "malformed", and vice versa.

**The check is a shape test.** There is no redemption server here, so a
well-formed code is accepted, exactly as `License.activate` accepts any
well-formed key — see `docs/ARCHITECTURE.md`. A real redemption burns the code
so it cannot be used twice, and `License.redeem` is where that call belongs.
The dialog says so on screen rather than implying the code was verified.

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
