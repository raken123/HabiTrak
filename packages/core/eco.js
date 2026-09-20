// Eco Mode.
//
// A generation is not free of the world: the datacentre that serves it burns
// electricity, and the machines that do it are cooled — in many places with
// water. Asking for less work means less of both.
//
// So Eco Mode asks for less, and this file is the whole of what "less" means:
//
//   - the picture that goes up is scaled down to `maxEdge` on its longest side,
//     so the model reads and writes fewer pixels;
//   - Realtouch's first pass — the one that looks the place up with a search —
//     is skipped entirely, which removes a whole model call and the search
//     behind it;
//   - GIF Animate generates half as many keyframes;
//   - Squirreal renders shorter clips at a lower frame rate;
//   - and because all of that is less work bought, it costs fewer credits.
//
// The results are worse. That is not a side effect to be buried: a picture
// rebuilt from its surroundings instead of from photographs of the place is a
// worse picture, and half the keyframes is coarser motion. The app says so at
// the point of use, every time.
//
// What this file will not do is print a number. How much water a request draws
// depends on the datacentre, the season and the grid behind it, and none of
// that is visible from the machine Hazelnut is running on. An invented figure
// would be worth less than nothing, so Hazelnut states the mechanism — fewer
// pixels, fewer passes, fewer frames — and leaves the arithmetic to people who
// can actually measure it.

export const ECO = {
  /** The longest edge of what is sent to, and asked back from, the model. */
  maxEdge: 1024,
  /** What a tool costs in Eco Mode, as a fraction of its usual price. */
  discount: 0.6,
  /** Realtouch's search pass, and Mini's. Off: no lookup, no second call. */
  grounding: false,
  /** GIF Animate's keyframes, as a fraction of the usual count. */
  keyframes: 0.5,
  /** Squirreal: the longest clip and the frame rate Eco Mode will render. */
  videoSeconds: 4,
  videoFps: 12,
};

/**
 * The Eco price of a tool. Never free and never rounded down into a lie: a
 * request still costs something, so the floor is one credit.
 */
export function ecoCost(cost) {
  if (!cost) return cost;
  return Math.max(1, Math.ceil(cost * ECO.discount));
}

/**
 * How much to scale a picture by before sending it, or 1 when it is already
 * small enough. The renderer does the resampling — it is the only place with
 * the pixels — and this is the rule it follows.
 */
export function ecoScale(width, height) {
  const longest = Math.max(width || 0, height || 0);
  if (!longest || longest <= ECO.maxEdge) return 1;
  return ECO.maxEdge / longest;
}

/** What each tool actually gives up. Shown wherever Eco Mode is offered. */
export const ECO_NOTES = {
  'magic-draw': 'The sketch goes up smaller, so the picture comes back smaller and softer.',
  realtouch: 'No location lookup: the gap is filled from the pixels around it, the way Erase does it. On a recognisable place, that is a real loss.',
  erase: 'The picture goes up smaller, so the patch is coarser.',
  'gif-animate': 'Half the keyframes, so the motion is coarser and more is left to the cross-fade.',
  upscale: 'Sent smaller, so there is less to work from — the least useful tool to run in Eco Mode.',
  restore: 'Sent smaller: fine scratches and grain may be below what the model can see.',
  colourise: 'Sent smaller, so the colour is broader and less careful at edges.',
  background: 'Sent smaller, so the cut-out edge is rougher — hair and glass suffer first.',
  sky: 'Sent smaller, so the horizon is less precisely followed.',
  caption: 'Sent smaller. A caption of a small picture misses small things.',
  aiscope: 'The crop goes up smaller, which is exactly the detail Learn is being asked about.',
};

/** The one-line summary every app shows next to the switch. */
export const ECO_SUMMARY =
  'Eco Mode asks the model for less: a smaller picture, no location lookup, '
  + 'fewer frames. Less work means less electricity and less water drawn by the '
  + 'datacentre that serves it — we cannot measure how much from here, so we do '
  + 'not print a figure. The results are worse, and cost fewer credits.';
