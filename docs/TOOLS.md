# The tools

Twenty-one tools. Eleven of them never touch a model, which is why they survive
into Hazelnut Free — and why they are exactly what the browser build ships.

The six below came first and are described in full. The fifteen that followed
are listed after them: eight local and free, seven that call the model and cost
between three and eight credits.

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
**Erase** is the only one that takes a mask.

### Erase or Realtouch?

Erase is a quarter of Realtouch's price because it does a quarter of the work:
it fills the hole from what surrounds it. Realtouch works out where the
photograph was taken, looks the place up with Google Search grounding, and
reasons about what is physically behind the object before it paints. Use Erase
for wires, litter, spots and strangers in the distance; use Realtouch when what
is behind the thing is a real place that can be looked up.

---

# Hazelnut for the Web

The browser build is the same renderer and the same bridge, fixed to the `web`
edition. The eleven local tools work; the ten that need a model are locked and
say why. There is no key, no account, and nothing is uploaded — the picture is
decoded in the page and stays there.

```sh
node scripts/stage-payload.mjs hazelnut-web dist/web
```
