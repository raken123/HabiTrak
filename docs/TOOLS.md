# The tools

Twenty-three tools. Twelve of them never leave your machine, which is why the
trial keeps them for ever — and why they are exactly what the browser build
ships.

The split used to be "does this need a model". It is now **whose** model:
Imagine needs one and is still in the local twelve, because the model is ours
and runs on your processor.

The six below came first and are described in full. The fifteen that followed
are listed after them: eight local and free, seven that call a partner model and
cost between three and eight credits. Magic Text and Imagine came last and have
sections of their own.

Everything below describes Hazelnut. **Hazelnut Squirreal** has the original
six, pointed at clips: the prices change (a generation is a clip, not a frame),
and GIF Animate stops being a generation at all because the motion already
exists. The differences are listed at the end.

---

## Draw — free

A brush. Colour, size, hardness, opacity, and an eraser toggle. Strokes are
stamped along the path rather than drawn as a single `lineTo`, which is what
gives a soft edge and an even opacity instead of ink piling up wherever the
pointer slowed down.

`[` and `]` step the brush size. Nothing leaves the machine.

## Magic Draw — 5–20 credits

Sketch with the same brush, describe the scene if you want to, and press
**Submit**. Hazelnut renders a photoreal version of the drawing, keeping the
composition, the layout, the proportions and the colour intent, and drops the
result in as a **new layer** so the sketch underneath survives for comparison.

The price moves inside its band with the actual work:

```
cost = 5 + weight × 15,  rounded

weight = 0.50 × (painted area / 60% of the canvas)
       + 0.20 × (colours used / 12)
       + 0.30 × (megapixels − 0.5 / 3.5)
```

Each term is clamped to 0–1, so a scribble in one colour on a small canvas costs
5 and a dense, many-coloured, 4-megapixel sketch costs 20. The badge on the
Submit button re-quotes as you draw.

Requires the trial or the full app.

## Realtouch — 20 credits

> The world's first AI object remover that looks up the place the photo was
> taken and works out what is behind the thing.

Paint over the object. Hold **Alt** to rub the mask back. Press **Remove**.

It runs in two passes:

1. **Examine.** The masked image goes to Gemini with **Google Search grounding
   turned on**, and the model is asked three questions in order: *where was this
   taken*, *what is under the mask*, and — the one that matters — *what is
   physically behind it*. If the setting is a recognisable place, the search
   brings back photographs of the same spot, so the answer is drawn from what is
   actually there rather than invented. The sources it consulted are listed in
   the result.
2. **Rebuild.** The findings are handed to the image model along with the marked
   photo, with instructions to continue every surface, edge and line that ran
   into the region, match the grain and lighting, and remove the object's shadow
   and reflection as well.

Anonymous scenes still work — the analysis simply says so and reasons from the
surrounding pixels instead of a place name.

## GIF Animate — 600 credits

Describe the motion, choose a length up to **five seconds** and a frame rate,
press **Generate**.

Generating all forty played frames through the model would mean forty round
trips. Instead the engine generates a handful of **keyframes** in a chain, each
conditioned on the one before it so the subject does not drift, and the renderer
cross-fades between them to reach the playback rate. The frames are then encoded
by a GIF89a writer built into `@hazelnut/core` — median-cut quantisation to a
shared 256-colour palette, Floyd–Steinberg dithering, and LZW — so there is no
native encoder to build per platform.

A shorter clip is priced proportionally, with a floor of 60 credits.

## Expand — free, always

Grow the canvas by dragging the handles or typing the margins, with presets for
+25%, 16:9 and square. The new margin is filled by mirroring the edge of each
layer, so it reads as a continuation of the picture rather than a border.

Entirely local. **This tool never costs a credit, on any edition.**

## AIScope — free zoom, 15 credits to Learn

Click a spot and magnify it from **80× to 60,000×**.

The zoom is honest about itself. A document pixel can only fill the scope once;
past that the readout changes from **optical** to **interpolated** and then to
**beyond detail**, and the confirm dialog says so before you spend anything on a
magnification where there is nothing left to see.

**Learn** sends the magnified crop to the model, which identifies the thing and
returns a structured card — subject, category, description, distinguishing
features, material, and how much of what you are looking at is real detail
versus interpolation. The card stays in the panel for the rest of the session.

---

## What each edition can run

| Tool | Web | Trial | Hazelnut |
|---|:--:|:--:|:--:|
| Draw | ✅ | ✅ | ✅ |
| Expand | ✅ | ✅ | ✅ |
| AIScope — zoom | ✅ | ✅ | ✅ |
| **Imagine — 2.5** | ✅ | ✅ 25 | ✅ unlimited |
| **Imagine — 5 Pro** | ✅ | ✅ 350 | ✅ 120 |
| AIScope — Learn | — | — | ✅ |
| Magic Draw | — | — | ✅ |
| Realtouch | — | — | ✅ |
| GIF Animate | — | — | ✅ |

There is no Free column any more, because there is no Free edition; see
`docs/PRICING.md`. The trial is what replaced it and does not expire.

Note the row that is easy to get wrong: **AIScope's Learn is a partner call**
even though AIScope is registered `ai: false`, because its zoom is optical and
local. The gate routes that question through `needsAi` rather than reading the
flag, which is the difference between Learn being locked on the trial and
running free on it.

Locked tools stay visible in the toolbar with a padlock, so the trial is a
version of the app rather than a nag screen.

---

## The same six in Squirreal

| Tool | What changes | Cost |
|---|---|---|
| **Draw** | Paints on the frame the playhead is parked on. The clip underneath is untouched. | Free |
| **Magic Draw** | Two more fields: **Seconds** (1–8) and **Movement**. Sketch one frame, say how it moves, and a clip comes back into the transport. | 40–120 — length is 0.55 of the weight |
| **Realtouch** | The location study is done once and then held steady across every frame, so the rebuilt background does not swim as the camera moves. | 150, floored at 45 for a short clip |
| **GIF Animate** | Not a generation any more. The frames already exist, so the app encodes them locally with the same GIF writer. | **Free, on every edition** |
| **Expand** | Mirrors the edge on every frame, not just the one on screen. | Never costs a credit |
| **AIScope** | Unchanged: zoom is local and free; Learn studies the crop you are parked on. | Free · Learn 15 |

The transport bar under the canvas is the only new piece of interface: play,
pause, a scrub bar, and the clip's length and rate. `Space` plays and pauses.

Squirreal runs on **Gemini Omni 1.1 Flash**. The request shape in
`packages/core/video.js` is an assumption, not a verified fact — see the caveat
in the README.


---

# The fifteen

## The eight that run here

Nothing in this group leaves the machine, and nothing in it is ever charged, on
any edition — including the browser build.

- **Crop** (`C`) — drag the box or type the numbers, then Apply. One call to
  `doc.resize()` with a negative offset and no mirroring: the same code path
  Expand uses, pointed the other way.
- **Straighten** (`K`) — rotate every layer about the centre, then trim to the
  largest rectangle of the original aspect that still fits inside the rotated
  frame. The overlay shows both the angle grid and the rectangle you will keep.
- **Levels** (`L`) — black point, white point and gamma, as one lookup table.
- **Colour** (`U`) — warmth, tint and saturation. Saturation is applied around
  the Rec. 601 luma, so moving it does not change how bright anything is.
- **Sharpen** (`H`) — an unsharp mask: the picture minus a blurred copy of
  itself, added back at the amount you set. The threshold leaves flat areas
  alone, so grain is not sharpened along with the detail.
- **Denoise** (`N`) — a 3×3 median mixed back into the original. *Keep detail*
  trusts the original more wherever a pixel is far from its median, which is
  what an edge looks like.
- **Vignette** (`V`) — a radial darkening with a feather, and optional grain.
  The grain is one value per pixel across all three channels: film grain is
  monochrome, and per-channel noise reads as a sensor fault.
- **Text** (`T`) — click where the line starts, type, and Apply draws it onto
  the layer.

All five adjustments share one factory: they snapshot the layer when you pick
the tool, recompute the whole layer from that snapshot on every slider move,
and only touch the history when you press **Apply**. Switching away without
applying puts the snapshot back, so nothing is ever left half-changed.

## The seven that call the model

Each is one edit to a photograph that already exists — no search pass, no run
of frames — which is why they are priced where they are.

| Tool | Cost | What it sends |
|---|---|---|
| **Caption** (`D`) | 3 | The picture. Nothing is generated: it comes back as a caption, an alt text and keywords. |
| **Erase** (`X`) | 5 | The masked copy and the original. Fills from the surrounding pixels only — no location lookup. |
| **Background** (`J`) | 5 | The picture. Cuts the subject out, or replaces what is behind it with what you describe. |
| **Sky** (`S`) | 6 | The picture. Replaces the sky and relights the ground underneath so the horizon is not a paste. |
| **Colourise** (`Y`) | 6 | The picture. An interpretation, not a recovery — the colour was never in the negative. |
| **Upscale** (`I`) | 8 | The picture. Comes back at twice the size, and the document grows with it. |
| **Restore** (`O`) | 8 | The picture. Scratches, creases, fading and damp, without redrawing faces. |

They share one engine call (`Engine#transform`) and one IPC channel, so there
is a single place where the gate, the charge, the cancel and the error live.
**Erase** and **Magic Text** are the two that take a mask.

---

# Magic Text — 12 credits, 4 in Eco Mode

Paint over the lettering in the photograph, type what it should say instead,
press **Generate**. It is the masked-transform machinery Erase uses, pointed at
words rather than at something you want gone, so it shares the same engine call,
the same mask brush and the same confirm dialog.

What the prompt asks for, and what the tool therefore promises:

- the new words **character for character** — no corrected spelling, no
  translation, nothing added that was not typed;
- the lettering that is already there — typeface, weight, spacing, case, colour,
  outline, the angle and perspective of the surface, the light across it, and
  the wear, dirt, reflections and focus it has taken on;
- the same baseline and the same space: a longer replacement is **tightened**
  rather than allowed to run off the sign;
- nothing outside the magenta changes.

It refuses to run without both a mask and words — `TRANSFORMS['magic-text']`
carries `needsMask` and `requires`, and `Engine#transform` checks both before
the gate and the charge, so an empty field cannot spend 12 credits putting the
same sign back.

### Why 4 in Eco Mode, and not 8

Every other tool takes the flat Eco discount. Magic Text has its own price in
`ECO_PRICES`, because Eco Mode takes more away from it than 40% of the work: the
renderer sends only the bounding box of the mask, padded outwards, instead of
the whole photograph, and lands the result back into that rectangle. That is a
far smaller request — and a much rougher match, because the model is matching a
typeface it can only see a few centimetres of. On a plain painted board it
holds; on anything ornate it does not, and the dialog says so before you spend.

---

### Erase or Realtouch?

Erase is a quarter of Realtouch's price because it does a quarter of the work:
it fills the hole from what surrounds it. Realtouch works out where the
photograph was taken, looks the place up with Google Search grounding, and
reasons about what is physically behind the object before it paints. Use Erase
for wires, litter, spots and strangers in the distance; use Realtouch when what
is behind the thing is a real place that can be looked up.

---

# Imagine — our own two models

Describe a picture; Hazelnut draws it. The twenty-third tool, the first that
makes a picture instead of changing one, and the only one that never touches
the network.

It is worth being precise about what this is, because "image AI" has come to
mean one specific thing and this is not it. There is no diffusion model here
and no weights to download. Hazelnut 2.5 and Hazelnut 5 Pro are **synthesisers**:
they read the prompt, decide what is in the picture, and draw it with a canvas.
`imagine-plan.js` decides, `imagine-paint.js` draws, and you can read both in an
afternoon.

What you give up is obvious and large — they can only draw things somebody
taught them to draw, and the tool reports the words it did not understand rather
than dropping them silently. What you get is that they are free of the two costs
that make the rest of the toolbox expensive: somebody else's datacentre, and
your pictures leaving your machine. No key, no account, no upload. It is the one
tool that does not go through the app's API-key check, because it needs none.

## One geometry, two renderers

Every object is written down once, as plain parts: ellipses, rectangles,
polygons, strokes, runs of text. Neither model has its own tree. **The models
are the two functions that turn a part into pixels.**

- **Hazelnut 5 Pro** draws the part. A rectangle is a rectangle.
- **Hazelnut 2.5** approximates it with a cluster of soft radial gradients.

So 2.5's weaknesses are structural rather than a filter applied afterwards.
There is no code path in 2.5 that puts down a hard edge, which is why:

- **It cannot write.** A letter drawn as a cluster of blobs is not a letter. It
  produces letter-shaped marks with the rhythm and the line breaks of real text
  and none of the letters — deterministically, so the same string always gives
  the same wrong marks rather than reshuffling its gibberish on every redraw.
- **It cannot do hands.** It puts six or seven fingers on one, and drawn this
  way they merge into a mitten. `fingerCount` is exported so the test suite can
  hold the app to that over hundreds of seeds, rather than somebody squinting at
  a screenshot.

Both models plan a picture identically, which is what makes a side-by-side
comparison of them fair: same prompt, same seed, same scene, and every visible
difference is the renderer.

## The thinking pass, and why it is held back

**Hazelnut 5 Pro thinks only on Hazelnut.** The planning pass generates content
and then checks it: a worksheet's arithmetic is solved, and anything that does
not come out whole is rejected and generated again. Every answer on the sheet is
computed rather than guessed.

Without it, the sheet is built to look right and nothing is verified. That is
not a stub standing in for the real behaviour — it *is* the behaviour of an
unthinking generator: immaculate typography wrapped around content nobody
checked, including divisions by zero and square roots of negative numbers
sitting in a primary-school worksheet.

This is the most dangerous thing in the app, because it looks **more** correct
than 2.5 while being **less** correct — nobody is fooled by 2.5's gibberish. So
a picture that asserts something unchecked carries a `NOT CHECKED` band drawn
**into the image**, sized to its own text, rather than into the window around
it. The screenshot is what gets sent to somebody else, so the screenshot has to
carry the warning.

The band follows the picture, not the model: a drawing of a hillside from the
same model on the same edition asserts nothing and gets no band. A warning
printed on everything is a warning nobody reads.

## Prices, and Eco Mode

| Model | Trial | Hazelnut |
|---|---|---|
| Hazelnut 2.5 | 25 credits | **Unlimited** |
| Hazelnut 5 Pro | 350 credits | 120 credits |

Per picture. The trial also caps the longest edge at 1,024px against Hazelnut's
2,048px, and the tool says so in the toast when a request is clamped.

**Eco Mode does nothing here and the price does not change.** Eco Mode exists
because a request burns electricity and water in a datacentre somebody else
runs. Imagine has no datacentre, so there is no saving to pass on, and
discounting it would be claiming one that nobody made.

---

# Hazelnut for the Web

The browser build is the same renderer and the same bridge, fixed to the `web`
edition. The eleven local tools work; the ten that need a model are locked and
say why. There is no key, no account, and nothing is uploaded — the picture is
decoded in the page and stays there.

```sh
node scripts/stage-payload.mjs hazelnut-web dist/web
```


---

# Mini's toolbar

Mini was one chat bar and one skill. It still is — Remove is the composer, and
it is the reason Mini exists — but twelve tools sit above it as a strip of
chips, because *rotate this* and *the colour is flat* are not sentences worth
typing on a phone.

| Tool | Cost | Where it runs |
|---|---|---|
| **Enhance** | Free | The phone. Auto levels from the picture's own histogram, plus a little saturation. |
| **Rotate** | Free | The phone. A quarter turn. |
| **Sharpen** | Free | The phone. One slider. |
| **Denoise** | Free | The phone. One slider. |
| **Vignette** | Free | The phone. Darken and grain. |
| **Black & white** | Free | The phone. Rec. 601 luma, with a tone slider. |
| **Caption** | 3 | The model. Words, not pixels — the answer lands in the transcript. |
| **Background** | 5 | The model. |
| **Sky** | 6 | The model. |
| **Colourise** | 6 | The model. |
| **Restore** | 8 | The model. |
| **Upscale** | 8 | The model. |
| **Remove** | 20 | The model, through the composer — Realtouch, with a sentence instead of a mask. |

The six local tools run the kernels in `@hazelnut/core/adjustments.js` — the
same code Hazelnut's toolbar runs, so a photograph adjusted on a phone and the
same photograph adjusted on a desktop come out identical. They cost nothing on
every edition, including after the trial ends.

The six model-backed ones are the same engine call at the same prices Hazelnut
charges. Nothing in Mini is dearer because it is on a phone.

Anything a tool needs to know is asked once, in one sheet, with the price on
the button — so a run is one tap and one sheet, never two.
