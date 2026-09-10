// Mini's toolbar.
//
// Mini was one chat bar and one skill. It still is — Remove is the composer,
// and it is the reason Mini exists — but the twelve tools below sit above it
// as a strip of chips, because "rotate this" and "the colour is flat" are not
// sentences worth typing.
//
// Six of them run on the phone and are free on every edition, trial or not.
// The other six call the model at the same prices Hazelnut charges: nothing
// here is a Mini-only price, and nothing here is dearer because it is on a
// phone.

export const TOOLS = [
  // ── free, on the device ──────────────────────────────────────────────────
  {
    id: 'enhance',
    name: 'Enhance',
    local: 'enhance',
    icon: 'M4 18 9 9l3.5 5.2L15 11l5 7Z|M7.2 6.4h.01M11 4.6h.01M9.2 2.9h.01',
    blurb: 'Opens up the range the photograph is actually using, and puts a little colour back.',
  },
  {
    id: 'rotate',
    name: 'Rotate',
    local: 'rotate',
    params: { turns: 1 },
    icon: 'M20 11a8 8 0 1 1-2.6-5.9|M20 4v5h-5',
    blurb: 'A quarter turn to the right.',
  },
  {
    id: 'sharpen',
    name: 'Sharpen',
    local: 'sharpen',
    icon: 'm12 4 7 15H5l7-15Z|M12 9.5v6',
    blurb: 'An unsharp mask. It cannot invent detail — only make what is there read more clearly.',
    sliders: [{ key: 'amount', label: 'Amount', min: 10, max: 200, value: 80, suffix: '%' }],
  },
  {
    id: 'denoise',
    name: 'Denoise',
    local: 'denoise',
    icon: 'M4.5 4.5h15v15h-15z|M8 8.5h.01M11.5 11h.01M16 8h.01M9 15h.01M13.5 16h.01M17 13h.01',
    blurb: 'A median filter, mixed back in, that leaves edges where they are.',
    sliders: [{ key: 'strength', label: 'Strength', min: 10, max: 100, value: 60, suffix: '%' }],
  },
  {
    id: 'vignette',
    name: 'Vignette',
    local: 'vignette',
    icon: 'M3 5h18v14H3z|M12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6',
    blurb: 'Darkens the corners, with grain if you want it.',
    sliders: [
      { key: 'amount', label: 'Darken', min: 0, max: 90, value: 45, suffix: '%' },
      { key: 'grain', label: 'Grain', min: 0, max: 40, value: 0 },
    ],
  },
  {
    id: 'mono',
    name: 'Black & white',
    local: 'mono',
    icon: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z|M12 3.5v17',
    blurb: 'The Rec. 601 luma — the weighting the eye actually uses.',
    sliders: [{ key: 'warmth', label: 'Tone', min: -30, max: 30, value: 0 }],
  },

  // ── the model, at Hazelnut's prices ──────────────────────────────────────
  {
    id: 'restore',
    name: 'Restore',
    tool: 'restore',
    icon: 'M3.5 4.5h17v15h-17z|m5 16 4.5-4.5 3 2.6 3.2-3.4L20 15|m7 4 3.5 16',
    blurb: 'Scratches, creases, fading and damp on a scanned print — without redrawing faces.',
    field: { key: 'note', label: 'Anything I should know?', placeholder: 'optional — “the crease runs through the roof”' },
  },
  {
    id: 'colourise',
    name: 'Colourise',
    tool: 'colourise',
    icon: 'M12 3.5c-4.7 0-8.5 3.6-8.5 8 0 3 2.3 4.6 4.6 4.6h1.5c1 0 1.8.8 1.8 1.8 0 1.4 1 2.6 2.4 2.6 3.9 0 6.7-3.6 6.7-8 0-4.9-3.8-9-8.5-9Z',
    blurb: 'Colour for a black-and-white photograph. An interpretation, not a recovery.',
    field: { key: 'era', label: 'Era or place', placeholder: 'optional — “a 1955 English seaside”' },
  },
  {
    id: 'upscale',
    name: 'Upscale',
    tool: 'upscale',
    icon: 'M3 7h9v9H3z|M14 5h6v6|m20 5-7.5 7.5',
    blurb: 'Twice the width and height, with the detail rebuilt rather than smeared.',
  },
  {
    id: 'sky',
    name: 'Sky',
    tool: 'sky',
    icon: 'M7.5 18h9.2a3.8 3.8 0 0 0 .3-7.6 5.2 5.2 0 0 0-10-1.6A3.6 3.6 0 0 0 7.5 18Z',
    blurb: 'A new sky, with the light underneath relit to match it.',
    field: { key: 'want', label: 'What sky?', placeholder: 'a clear evening sky, low sun off to the left' },
  },
  {
    id: 'background',
    name: 'Background',
    tool: 'background',
    icon: 'M4 8V4h4M20 16v4h-4M16 4h4v4M8 20H4v-4|M9.5 15.5a3.5 3.5 0 1 1 5-5|m14.5 15.5-5-5',
    blurb: 'Cuts the subject out — or puts it somewhere else.',
    field: { key: 'replacement', label: 'Replace it with', placeholder: 'leave empty to cut it out' },
  },
  {
    id: 'caption',
    name: 'Caption',
    tool: 'caption',
    reads: true,
    icon: 'M3 5h18v14H3z|M7 14.5h5M14.5 14.5H17M7 10.5h10',
    blurb: 'A caption, an alt text and some keywords. Nothing is generated, which is why it is the cheapest thing here.',
  },
];

export const byId = (id) => TOOLS.find((t) => t.id === id);
