# Hazel the Squirrel

The mascot. She is the one holding the acorn.

She turns up in three places in the app — over an empty canvas, in the welcome
dialog, and beside the explanation when a tool is behind the licence — and on
the download page, where she has a section of her own.

## Where she comes from

`site/mascot/hazel-sheet.webp` is the master: one character sheet with two
dozen poses on it, supplied by the project owner. It is the only copy of the
artwork in the repository, and everything else is cut from it by
`npm run mascot`.

## How the poses are cut

The poses on the sheet touch — a tail here overlaps an ear there — so they
cannot be found simply by looking for islands of opaque pixels. `POSES` in
`scripts/build-mascot.mjs` names the eight worth having and boxes each one
roughly, by eye, once.

What is *not* done by eye is the edge. Inside each rough box the script labels
the islands, takes the biggest to be Hazel, takes anything close enough to her
to belong to her — the question mark over her head, the sparkles, the little
sign — and tightens the box onto exactly that. So a box only has to be
approximately right, and the sprite that comes out is trimmed to the drawing.

One rule does the rest of the work: **anything but the main island that runs
into the side of the box is somebody else's arm**. A neighbouring pose is
always severed by the box edge, while Hazel's own props sit inside it. Without
that rule half the sprites came out with a slice of the next squirrel in them.

## The three ways she travels

She is carried differently by each surface, and the sizes follow from that:

| Where | Form | Why |
|---|---|---|
| `site/mascot/web/` | WebP, 440px | The download page inlines them at build time |
| `apps/hazelnut/renderer/img/` | WebP, 280px | Served to the app over the `hazelnut://` scheme |
| `apps/hazelnut-mini/www/js/hazel.js` | data URI, 200px | Generated; Mini's Android build ships two files and no image directory |

The masters are PNG and full size. They are not what anybody is shown: a
megabyte of squirrel on a download page is a worse download page.

Two size traps worth knowing about, both of which cost bytes before they were
noticed:

- The single-file browser build inlines every asset path it can find, so an
  unused entry in `HAZEL` in `main.js` is a hundred kilobytes nobody sees. That
  map lists only the poses the app actually draws.
- `MINI_POSES` in the mascot script is the same idea for the APK. Every pose in
  it is bytes in the bundle whether it is drawn or not.

## She is decoration

Everywhere she appears she carries alt text describing the drawing — "Hazel the
Squirrel, asleep with her tail curled over her" — and **nothing is ever said
only by the picture**. Turn images off and every dialog, empty state and
section still reads. She is there to be liked, not to carry meaning.

## Her film

`ads/hazel.html` is a thirty-four-second portrait short built on the same
harness as the other films: `ads/serve.mjs` serves the poses at `/mascot/`,
`ads/record.mjs` steps virtual time and screenshots every frame, and
`ads/music-hazel.mjs` writes the bed. It is shot with

```
AD_SCENE=hazel.html AD_WIDTH=1080 AD_HEIGHT=1920 \
AD_MUSIC=.build/bed-hazel.wav node ads/record.mjs dist/Hazelnut-short-hazel.mp4
```

after `node ads/music-hazel.mjs .build/bed-hazel.wav 36`.

Two things about it are worth keeping true as the product moves:

- **Nothing in it is typed twice.** The credit grant, the local-tool count, the
  discount, both prices and the deadline are read from `pricing.js`, `tools.js`
  and `offers.js` when the frame is drawn. If the fall deal ends, the end card
  stops advertising it and sells the plan at its own price instead — a film
  outlives a promotion, and this one is built to.
- **The picture she draws is real.** It comes from `imagine-plan.js` and
  `imagine-paint.js` at Hazelnut 5 Pro on the Hazelnut edition, at a fixed
  seed. It is not a mock-up, and the landing page says so.

Five of the eight cuts are busts — the drawing stops at the belly — so they are
faded along their bottom edge (`.hazel--bust`) and given no contact shadow. A
contact shadow under a bust reads as a squirrel sunk into the floor.
