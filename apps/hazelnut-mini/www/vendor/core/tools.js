// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// The Hazelnut tool registry.
//
// One entry per tool in the toolbar. `cost` is either a fixed number of AI
// credits or a { min, max } band plus an `estimate` function that the UI calls
// before the user commits, so the confirm dialog can quote a real number
// instead of a range.

// 'web' is the browser build: the local half of the toolbox, no key, no
// account, nothing uploaded. It is an edition rather than a separate app so
// every gate in here keeps working unchanged.
export const EDITIONS = ['free', 'trial', 'pro', 'web'];

/** Tools flagged `ai: false` run entirely on the local canvas. Free keeps those. */
export const TOOLS = {
  draw: {
    id: 'draw',
    name: 'Draw',
    shortcut: 'B',
    icon: 'brush',
    ai: false,
    cost: 0,
    group: 'paint',
    tagline: 'Draw what you want, in colour.',
    help: 'A plain brush. Pick a colour and a size and paint on the active layer. Nothing leaves your machine and nothing is charged.',
  },
  'magic-draw': {
    id: 'magic-draw',
    name: 'Magic Draw',
    shortcut: 'M',
    icon: 'sparkle-brush',
    ai: true,
    cost: { min: 5, max: 20 },
    group: 'paint',
    tagline: 'Sketch in 2D, submit, get the real thing.',
    help: 'Draw as you would with Draw, then press Submit. Hazelnut renders a photoreal version of your sketch, keeping your composition, colours and proportions. Trial or full only.',
  },
  realtouch: {
    id: 'realtouch',
    name: 'Realtouch',
    shortcut: 'R',
    icon: 'eraser-magic',
    ai: true,
    cost: 20,
    group: 'repair',
    tagline: 'Remove an object — and rebuild what was actually behind it.',
    help: 'Paint over the thing you want gone. Realtouch first works out where the photo was taken, looks the place up, and reasons about what the object is hiding before it paints the gap back in.',
  },
  'gif-animate': {
    id: 'gif-animate',
    name: 'GIF Animate',
    shortcut: 'G',
    icon: 'film',
    ai: true,
    cost: 600,
    group: 'motion',
    tagline: 'Up to five seconds of movement, encoded as a GIF.',
    help: 'Describe the motion. Hazelnut generates a run of frames from your image and encodes them into a looping GIF, up to five seconds long.',
  },
  expand: {
    id: 'expand',
    name: 'Expand',
    shortcut: 'E',
    icon: 'expand',
    ai: false,
    cost: 0,
    group: 'canvas',
    tagline: 'Grow the canvas. Never costs a credit.',
    help: 'Pull the canvas out in any direction. The new margin is filled by mirroring the edge pixels, so it stays seamless. Local, instant, free on every edition.',
  },
  aiscope: {
    id: 'aiscope',
    name: 'AIScope',
    shortcut: 'Z',
    icon: 'scope',
    ai: false, // the optical zoom is local; only Learn is billed
    cost: 0,
    learnCost: 15,
    group: 'inspect',
    minZoom: 80,
    maxZoom: 60000,
    tagline: 'Zoom 80× to 60,000× and let the AI learn what it is looking at.',
    help: 'Drag a box to dive into it. Zoom runs locally and is free at any magnification. Press Learn and Hazelnut studies the magnified crop, writes down what the thing is, and remembers it for the rest of the session.',
  },

  // ── the fifteen ──────────────────────────────────────────────────────────
  //
  // Eight of these never leave the machine and cost nothing. The seven that do
  // call the model are deliberately cheap: the tools above pay for a search
  // pass or a run of frames, and none of these do.

  crop: {
    id: 'crop', name: 'Crop', shortcut: 'C', icon: 'crop', ai: false, cost: 0, group: 'canvas',
    tagline: 'Take the edges off. Free, on every edition.',
    help: 'Drag a box, or type the numbers. Crop trims the canvas and every layer in it — local, instant, and never charged.',
  },
  straighten: {
    id: 'straighten', name: 'Straighten', shortcut: 'K', icon: 'straighten', ai: false, cost: 0, group: 'canvas',
    tagline: 'Level a horizon by eye.',
    help: 'Rotate the picture a fraction of a degree at a time. Hazelnut trims the corners the rotation exposes, so you are left with a rectangle rather than a diamond.',
  },
  levels: {
    id: 'levels', name: 'Levels', shortcut: 'L', icon: 'levels', ai: false, cost: 0, group: 'adjust',
    tagline: 'Black point, white point, gamma.',
    help: 'The three controls that fix most flat photographs, with a histogram drawn from the picture as it is now. Every move is applied on your machine.',
  },
  colour: {
    id: 'colour', name: 'Colour', shortcut: 'U', icon: 'droplet', ai: false, cost: 0, group: 'adjust',
    tagline: 'Warmth, tint and saturation.',
    help: 'Push the picture warmer or cooler, correct a green or magenta cast, and take the colour up or down. Local, free, and reversible until you apply it.',
  },
  sharpen: {
    id: 'sharpen', name: 'Sharpen', shortcut: 'H', icon: 'sharpen', ai: false, cost: 0, group: 'adjust',
    tagline: 'An unsharp mask, with a radius you control.',
    help: 'Real unsharp masking: the picture, minus a blurred copy of itself, added back at the strength you pick. It cannot invent detail — only make what is there read more clearly.',
  },
  denoise: {
    id: 'denoise', name: 'Denoise', shortcut: 'N', icon: 'denoise', ai: false, cost: 0, group: 'adjust',
    tagline: 'Take the speckle out of a dark frame.',
    help: 'A median filter mixed back into the original at the strength you choose, so the grain goes without the picture turning to plastic. Runs here, costs nothing.',
  },
  vignette: {
    id: 'vignette', name: 'Vignette', shortcut: 'V', icon: 'vignette', ai: false, cost: 0, group: 'adjust',
    tagline: 'Darken the corners. Add grain if you want it.',
    help: 'A soft radial darkening with a feather you control, and an optional layer of monochrome grain. Both are drawn locally and cost nothing.',
  },
  text: {
    id: 'text', name: 'Text', shortcut: 'T', icon: 'text', ai: false, cost: 0, group: 'paint',
    tagline: 'Put words on the picture.',
    help: 'Click where the line should start and type. Size, colour and weight are yours; the text is drawn onto the layer when you apply it.',
  },

  erase: {
    id: 'erase', name: 'Erase', shortcut: 'X', icon: 'eraser', ai: true, cost: 5, group: 'repair',
    tagline: 'Paint over something small and it goes. Five credits.',
    help: 'Realtouch for things that need no research: no location lookup, no reasoning about what is behind — just a clean fill from the pixels around it. A quarter of the price, and right for wires, litter, spots and strangers in the distance.',
  },
  upscale: {
    id: 'upscale', name: 'Upscale', shortcut: 'I', icon: 'upscale', ai: true, cost: 8, group: 'adjust',
    tagline: 'Twice the size, with the detail rebuilt.',
    help: 'Doubles the picture and reconstructs the edges and texture the extra pixels need. Eight credits, whatever the size of the original.',
  },
  restore: {
    id: 'restore', name: 'Restore', shortcut: 'O', icon: 'restore', ai: true, cost: 8, group: 'repair',
    tagline: 'Scratches, creases, fading, damp.',
    help: 'For scanned prints and negatives: takes out the scratches and the dust, flattens the creases, and pulls the colour back where it has faded — without redrawing faces.',
  },
  colourise: {
    id: 'colourise', name: 'Colourise', shortcut: 'Y', icon: 'palette', ai: true, cost: 6, group: 'adjust',
    tagline: 'Black and white, in colour.',
    help: 'Adds plausible colour to a monochrome photograph, keeping every tone where it was. It is an interpretation, not a recovery: the colour was never in the negative.',
  },
  background: {
    id: 'background', name: 'Background', shortcut: 'J', icon: 'cutout', ai: true, cost: 5, group: 'repair',
    tagline: 'Cut the subject out, or put it somewhere else.',
    help: 'Separates the subject from what is behind it, then either leaves it on transparency or replaces the background with what you describe. Five credits.',
  },
  sky: {
    id: 'sky', name: 'Sky', shortcut: 'S', icon: 'cloud', ai: true, cost: 6, group: 'repair',
    tagline: 'A new sky, lit like the old one.',
    help: 'Replaces the sky and relights the picture underneath, so the horizon does not read as a paste. Six credits.',
  },
  caption: {
    id: 'caption', name: 'Caption', shortcut: 'D', icon: 'caption', ai: true, cost: 3, group: 'inspect',
    tagline: 'A caption, an alt text and some keywords. Three credits.',
    help: 'Reads the picture and writes a one-line caption, a short alt text for the web, and a handful of keywords. The cheapest thing Hazelnut does, because nothing is generated.',
  },
};

export const TOOL_ORDER = [
  'draw', 'text', 'magic-draw',
  'erase', 'realtouch', 'restore', 'background', 'sky',
  'levels', 'colour', 'sharpen', 'denoise', 'vignette', 'colourise', 'upscale',
  'gif-animate',
  'crop', 'straighten', 'expand',
  'aiscope', 'caption',
];

/** The half that never calls a model — which is what the browser build ships. */
export const LOCAL_TOOLS = TOOL_ORDER.filter((id) => !TOOLS[id].ai);

/**
 * Magic Draw costs 5–20 credits. The number depends on how much work the
 * request actually is: how much of the canvas was painted, how many distinct
 * colours the sketch uses, and how large an output was asked for.
 *
 * @param {{coveragePct:number, colorCount:number, megapixels:number}} sketch
 */
export function estimateMagicDraw({ coveragePct = 0, colorCount = 1, megapixels = 1 } = {}) {
  const { min, max } = TOOLS['magic-draw'].cost;
  const coverage = clamp01(coveragePct / 60);          // 60% of the canvas painted = full weight
  const palette = clamp01((colorCount - 1) / 11);       // 12+ colours = full weight
  const size = clamp01((megapixels - 0.5) / 3.5);       // 4 MP = full weight
  const weight = 0.5 * coverage + 0.2 * palette + 0.3 * size;
  return Math.round(min + weight * (max - min));
}

/** GIF Animate is quoted flat, but a shorter clip should not cost a full one. */
export function estimateGifAnimate({ seconds = 5, fps = 8 } = {}) {
  const full = TOOLS['gif-animate'].cost;
  const frames = Math.max(2, Math.round(clamp(seconds, 0.5, 5) * clamp(fps, 4, 12)));
  const fullFrames = 5 * 8;
  return Math.max(60, Math.round((frames / fullFrames) * full));
}

/**
 * What a tool will cost right now, given its parameters. Always returns an
 * integer so the UI never has to quote a fraction of a credit.
 */
export function costOf(toolId, params = {}) {
  const tool = TOOLS[toolId];
  if (!tool) throw new Error(`Unknown tool: ${toolId}`);
  if (toolId === 'magic-draw') return estimateMagicDraw(params);
  if (toolId === 'gif-animate') return estimateGifAnimate(params);
  if (toolId === 'aiscope') return params.learn ? tool.learnCost : 0;
  return typeof tool.cost === 'number' ? tool.cost : tool.cost.min;
}

/** Does this tool need a model call for the given parameters? */
export function needsAi(toolId, params = {}) {
  const tool = TOOLS[toolId];
  if (!tool) return false;
  if (toolId === 'aiscope') return Boolean(params.learn);
  return tool.ai;
}

/**
 * Gate a tool behind the current edition. Free is the whole editor minus the
 * model: local tools stay, AI tools are visible but locked so people can see
 * what they are missing.
 */
export function availability(toolId, edition, params = {}) {
  const tool = TOOLS[toolId];
  if (!tool) return { allowed: false, reason: 'unknown-tool' };
  if (!needsAi(toolId, params)) return { allowed: true };
  if (edition === 'web') {
    return {
      allowed: false,
      reason: 'web-half',
      message: `${tool.name} needs the model. The browser edition is the local half of Hazelnut — ${LOCAL_TOOLS.length} of the ${TOOL_ORDER.length} tools. The desktop app has the rest.`,
    };
  }
  if (edition === 'free') {
    return {
      allowed: false,
      reason: 'no-ai-on-free',
      message: `${tool.name} needs the AI. Hazelnut Free runs everything local — upgrade to bring it back.`,
    };
  }
  if (!EDITIONS.includes(edition)) return { allowed: false, reason: 'unlicensed' };
  return { allowed: true };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n) => clamp(n, 0, 1);
