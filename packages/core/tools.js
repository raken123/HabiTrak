// The Hazelnut tool registry.
//
// One entry per tool in the toolbar. `cost` is either a fixed number of AI
// credits or a { min, max } band plus an `estimate` function that the UI calls
// before the user commits, so the confirm dialog can quote a real number
// instead of a range.

export const EDITIONS = ['free', 'trial', 'pro'];

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
};

export const TOOL_ORDER = ['draw', 'magic-draw', 'realtouch', 'gif-animate', 'expand', 'aiscope'];

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
