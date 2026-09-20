// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// The Hazelnut tool registry.
//
// One entry per tool in the toolbar. `cost` is either a fixed number of AI
// credits or a { min, max } band plus an `estimate` function that the UI calls
// before the user commits, so the confirm dialog can quote a real number
// instead of a range.

import { ecoCost, ecoExempt } from './eco.js';
import { DEFAULT_MODEL, modelAllowed, modelPrice } from './models.js';

// 'web' is the browser build. 'free' was a third edition and has been removed
// for good — see license.js for what replaced it.
export const EDITIONS = ['trial', 'pro', 'web'];

/**
 * Tools flagged `ai: false` run entirely on the local canvas and cost nothing.
 * `partner: false` is a different claim: it means the tool uses a model, and
 * that model is ours and runs here. Imagine is the only one.
 */
export const TOOLS = {
  imagine: {
    id: 'imagine',
    name: 'Imagine',
    shortcut: 'P',
    icon: 'imagine',
    ai: true,
    // Ours, and it runs here. This is the flag that lets the trial and the
    // browser build have it while the partner tools stay behind the licence.
    partner: false,
    cost: { min: 0, max: 350 },
    group: 'create',
    tagline: 'Describe a picture. Hazelnut draws it, on your machine.',
    help: 'Type what you want and pick a model. Hazelnut 2.5 is soft and round and can write neither letters nor hands; Hazelnut 5 Pro can do both, and on Hazelnut it thinks the picture through before it draws. Neither uploads anything — the generator runs on your own processor, with no key and no account. What it costs depends on the model and the edition, and the button always says which.',
  },
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

  'magic-text': {
    id: 'magic-text',
    name: 'Magic Text',
    shortcut: 'A',
    icon: 'text-magic',
    ai: true,
    cost: 12,
    group: 'paint',
    tagline: 'Select the words in the picture. Type different ones.',
    help: 'Paint over the lettering you want changed — a sign, a label, a screen, a price — type what it should say instead, and press Generate. The new words are rendered into the same place in the same typeface, at the same angle, with the same light on them. Twelve credits; four in Eco Mode, which sends only a crop around the words.',
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
  'imagine',
  'draw', 'text', 'magic-text', 'magic-draw',
  'erase', 'realtouch', 'restore', 'background', 'sky',
  'levels', 'colour', 'sharpen', 'denoise', 'vignette', 'colourise', 'upscale',
  'gif-animate',
  'crop', 'straighten', 'expand',
  'aiscope', 'caption',
];

/**
 * Does this tool, with these parameters, send your picture to somebody else's
 * model?
 *
 * Every model-backed tool does unless it says otherwise, so a new AI tool is a
 * partner tool by default and has to opt out on purpose. Only Hazelnut's own
 * generator has.
 *
 * The parameters matter, and getting that wrong is easy: AIScope is registered
 * `ai: false` because its zoom is optical and local, but its Learn button is a
 * partner call. Asking `TOOLS[id].ai` would let Learn run free on the trial.
 * So the question is routed through `needsAi`, which is the one place that
 * knows a tool can be local at one setting and not at another.
 */
export function isPartnerTool(toolId, params = {}) {
  const tool = TOOLS[toolId];
  if (!tool) return false;
  if (tool.partner === false) return false;
  return needsAi(toolId, params);
}

/**
 * The tools that never leave the machine — which is what the browser build
 * ships, and what the trial keeps forever.
 *
 * This is no longer the same set as "the ones that cost nothing": Imagine is
 * in here and is charged for on the trial. Local and free stopped being the
 * same thing when the generator arrived.
 */
export const LOCAL_TOOLS = TOOL_ORDER.filter((id) => !isPartnerTool(id));

/** The ones that do leave. On Hazelnut, these are what the licence buys. */
export const PARTNER_TOOLS = TOOL_ORDER.filter((id) => isPartnerTool(id));

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
  const full = toolId === 'imagine' ? imagineCost(params)
    : toolId === 'magic-draw' ? estimateMagicDraw(params)
    : toolId === 'gif-animate' ? estimateGifAnimate(params)
    : toolId === 'aiscope' ? (params.learn ? tool.learnCost : 0)
    : typeof tool.cost === 'number' ? tool.cost : tool.cost.min;
  // Eco Mode buys less work, so it costs less. The discount is applied last,
  // to whatever the tool would otherwise have charged — except where there is
  // no datacentre to spare, which is the whole of Eco Mode's argument.
  return params.eco && !ecoExempt(toolId) ? ecoCost(full, toolId) : full;
}

/**
 * Imagine is priced by model and edition, not by how hard the request is.
 *
 * That is a deliberate break from every other tool here. The rest are priced
 * against work somebody else does — more pixels up, more frames back, a search
 * pass — so the price tracks the size of the job. Imagine does its work on
 * your processor, so the size of the job costs us nothing, and pricing it that
 * way would be theatre. What you are paying for is which model you are allowed
 * to run and how often, and that is exactly what this returns.
 *
 * Zero is a real price and means unlimited. A model that is not available on
 * the edition also returns zero — `availability` is what refuses it, and
 * quoting a price for something that will not run would be worse than useless.
 */
export function imagineCost({ model = DEFAULT_MODEL, edition = 'trial' } = {}) {
  const price = modelPrice(model, edition);
  return price == null ? 0 : price;
}

/** Does this tool need a model call for the given parameters? */
export function needsAi(toolId, params = {}) {
  const tool = TOOLS[toolId];
  if (!tool) return false;
  if (toolId === 'aiscope') return Boolean(params.learn);
  return tool.ai;
}

/**
 * Gate a tool behind the current edition.
 *
 * The line is no longer "does this need a model" — it is "whose model". A tool
 * that runs on your machine is available on every edition, including the
 * browser build and the trial that never ends. A tool that sends your picture
 * to a partner is what the licence pays for.
 *
 * Locked tools stay visible. Somebody on the trial should be able to see what
 * Realtouch is and decide it is worth paying for, which they cannot do if it
 * is not on the screen.
 */
export function availability(toolId, edition, params = {}) {
  const tool = TOOLS[toolId];
  if (!tool) return { allowed: false, reason: 'unknown-tool' };
  if (!EDITIONS.includes(edition)) return { allowed: false, reason: 'unlicensed' };
  if (!needsAi(toolId, params)) return { allowed: true };

  if (isPartnerTool(toolId, params)) {
    if (edition === 'web') {
      return {
        allowed: false,
        reason: 'web-half',
        message: `${tool.name} sends the picture to a partner model, and the browser edition never sends anything anywhere. It is the local part of Hazelnut — ${LOCAL_TOOLS.length} of the ${TOOL_ORDER.length} tools, Imagine among them. The desktop app has the rest.`,
      };
    }
    if (edition !== 'pro') {
      return {
        allowed: false,
        reason: 'partner-needs-pro',
        message: `${tool.name} calls a partner model, and those come with Hazelnut. The trial never expires and keeps every local tool and both of Hazelnut's own image models — what it does not include is somebody else's.`,
      };
    }
    return { allowed: true };
  }

  // Hazelnut's own generator. Available everywhere; the model within it may
  // still be gated, and the price differs by edition.
  if (toolId === 'imagine') {
    const model = params.model || DEFAULT_MODEL;
    if (!modelAllowed(model, edition)) {
      return {
        allowed: false,
        reason: 'model-needs-pro',
        message: `That model does not run on this edition.`,
      };
    }
  }
  return { allowed: true };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n) => clamp(n, 0, 1);
