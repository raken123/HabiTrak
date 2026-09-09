// The cheap half of the AI toolbox: one picture in, one picture out.
//
// Magic Draw, Realtouch and GIF Animate each buy something expensive — a
// composition rendered from scratch, a search pass over the real world, a run
// of frames. These do not. Each is a single edit to a photograph that already
// exists, which is why they are priced at 3–8 credits rather than 20–600, and
// why they can all share one engine call.
//
// Every prompt below says the same three things in its own way: change this,
// change nothing else, and do not invent what you cannot see.

const HOUSE_RULES = [
  'Return the edited photograph itself, at the same aspect ratio and framing.',
  'Do not add a border, a watermark, a caption or a signature.',
  'Do not restyle, relight or re-render anything the instruction did not ask you to change.',
];

/** A named edit, with what the user is allowed to say about it. */
export const TRANSFORMS = {
  erase: {
    needsMask: true,
    field: { key: 'hint', label: 'Hint', placeholder: 'optional — e.g. “there is a kerb behind it”' },
    lines: ({ hint }) => [
      'The first image is the photograph with an area painted over in solid magenta.',
      'The second is the same photograph, unmarked.',
      '',
      'Remove whatever is under the magenta and fill the gap with what the pixels',
      'immediately around it say was there: continue the surfaces, the lines, the',
      'texture and the grain across the hole. Match the noise and the focus of the',
      'surrounding area — a clean patch in a grainy photograph is a giveaway.',
      '',
      'Do not research the place, do not add objects, and do not invent detail that',
      'the surroundings do not imply. If the area is large or the background is',
      'complicated, fill it plainly rather than guessing at something specific.',
      hint ? `The person editing says: ${hint}` : null,
    ],
  },

  upscale: {
    field: {
      key: 'detail', label: 'Detail', type: 'select',
      options: [['faithful', 'Faithful'], ['natural', 'Natural'], ['crisp', 'Crisp']],
    },
    lines: ({ detail = 'faithful' }) => [
      'Enlarge this photograph to twice its width and height.',
      '',
      'Reconstruct the edges, the texture and the fine structure that the extra',
      'pixels need, in the way the original detail implies — sharpen what is there',
      'rather than drawing something new. Keep every object exactly where it is,',
      'keep the grain plausible at the new size, and do not smooth faces, skin,',
      'fabric or foliage into plastic.',
      detail === 'crisp'
        ? 'Err towards a crisp result, but never at the cost of inventing texture.'
        : detail === 'natural'
          ? 'Err towards a soft, natural result rather than an obviously sharpened one.'
          : 'Stay as close to the original rendering as the new size allows.',
    ],
  },

  restore: {
    field: { key: 'note', label: 'Note', placeholder: 'optional — e.g. “the crease runs through the roof”' },
    lines: ({ note }) => [
      'This is a scan of a damaged photographic print.',
      '',
      'Repair it: remove the scratches, dust, spots and stains; flatten the creases',
      'and tears; correct the fading and the colour cast the paper has taken on.',
      'Keep the grain of the original film and the character of the print.',
      '',
      'Do not redraw faces, hands or lettering — where damage crosses them, repair',
      'the damage without changing the features underneath. Do not add sharpness,',
      'people, or detail that the print does not contain.',
      note ? `The person editing says: ${note}` : null,
    ],
  },

  colourise: {
    field: { key: 'era', label: 'Era', placeholder: 'optional — e.g. “a 1955 English seaside”' },
    lines: ({ era }) => [
      'This is a black-and-white photograph. Add colour to it.',
      '',
      'Every tone must stay where it is: the colour goes on top of the existing',
      'luminance, it does not replace it. Use colours that are plausible for the',
      'subject, the materials and the light — skin, foliage, brick, painted metal,',
      'sky — and keep them restrained rather than saturated.',
      '',
      'This is an interpretation and not a recovery: where the original gives no',
      'clue what colour a thing was, choose the most ordinary one rather than the',
      'most interesting.',
      era ? `Context for the period and place: ${era}` : null,
    ],
  },

  background: {
    field: { key: 'replacement', label: 'Replace with', placeholder: 'leave empty to cut out; or “a plain grey studio wall”' },
    lines: ({ replacement }) => [
      'Separate the main subject of this photograph from its background.',
      '',
      'Follow the true edge of the subject, including hair, fur, glass and anything',
      'thin or translucent. Do not shave the outline in or trace it loosely.',
      replacement
        ? `Then replace the background with: ${replacement}. Light the subject to match `
          + 'that background, keep the perspective and the horizon consistent with it, '
          + 'and put a contact shadow where the subject meets the ground.'
        : 'Then return the subject on full transparency, with nothing behind it.',
    ],
  },

  sky: {
    field: { key: 'want', label: 'Sky', placeholder: 'e.g. “a clear evening sky, low sun off to the left”' },
    lines: ({ want }) => [
      'Replace the sky in this photograph.',
      '',
      `The new sky: ${want || 'whatever suits the light already in the picture'}.`,
      '',
      'Match the horizon exactly — every roofline, branch, mast and wire keeps its',
      'own edge. Relight the ground, the buildings and the water underneath so they',
      'agree with the new sky: the direction of the light, its colour temperature,',
      'the reflections, and the haze at the horizon. A sky that does not change the',
      'light beneath it always reads as a paste.',
    ],
  },
};

export function transformPrompt(toolId, params = {}) {
  const spec = TRANSFORMS[toolId];
  if (!spec) throw new Error(`Unknown transform: ${toolId}`);
  return [...spec.lines(params).filter(Boolean), '', ...HOUSE_RULES].join('\n');
}

export const CAPTION_SCHEMA = {
  type: 'object',
  properties: {
    caption: { type: 'string', description: 'One sentence a person would write under this picture.' },
    alt: { type: 'string', description: 'Alt text: what a reader who cannot see it needs, in under 125 characters.' },
    keywords: { type: 'array', items: { type: 'string' }, description: 'Five to eight single words or short phrases.' },
    note: { type: 'string', description: 'Anything you are unsure of, or nothing.' },
  },
  required: ['caption', 'alt', 'keywords'],
};

export function captionPrompt() {
  return [
    'Describe this photograph for someone cataloguing it.',
    '',
    'The caption is one plain sentence — what is happening, where, and when if the',
    'picture says so. The alt text is shorter and written for a screen reader: the',
    'subject and what matters about it, no "image of".',
    '',
    'Say only what you can see. If you cannot tell where it is or who is in it, do',
    'not guess — leave it out, and put the uncertainty in the note.',
  ].join('\n');
}
