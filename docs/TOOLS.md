# The tools

Six tools. Two of them never touch a model, which is why they survive into
Hazelnut Free.

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

| Tool | Free | Trial | Full |
|---|:--:|:--:|:--:|
| Draw | ✅ | ✅ | ✅ |
| Expand | ✅ | ✅ | ✅ |
| AIScope — zoom | ✅ | ✅ | ✅ |
| AIScope — Learn | — | ✅ | ✅ |
| Magic Draw | — | ✅ | ✅ |
| Realtouch | — | ✅ | ✅ |
| GIF Animate | — | ✅ | ✅ |

Locked tools stay visible in the toolbar with a padlock, so Free is a version of
the app rather than a nag screen.
