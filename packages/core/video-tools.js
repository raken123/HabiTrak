// Hazelnut Squirreal's tool registry.
//
// The same six tools as Hazelnut, pointed at moving pictures instead of still
// ones. Two things change with the medium:
//
//   - A generation is a clip, so it costs more. Squirreal's plan carries fewer
//     credits than Hazelnut's for that reason, not because it does less.
//   - GIF Animate stops being a generation. In Hazelnut it has to invent the
//     motion; here the motion already exists, so exporting a loop is local
//     work and costs nothing.

import { EDITIONS } from './tools.js';

export { EDITIONS };

/** Seconds a single generation may cover. */
export const MAX_CLIP_SECONDS = 8;

export const VIDEO_TOOLS = {
  draw: {
    id: 'draw',
    name: 'Draw',
    shortcut: 'B',
    icon: 'brush',
    ai: false,
    cost: 0,
    group: 'paint',
    tagline: 'Draw what you want, in colour.',
    help: 'A plain brush, on the frame you are parked on. Nothing leaves your machine and nothing is charged.',
  },
  'magic-draw': {
    id: 'magic-draw',
    name: 'Magic Draw',
    shortcut: 'M',
    icon: 'sparkle-brush',
    ai: true,
    cost: { min: 40, max: 120 },
    group: 'paint',
    tagline: 'Sketch a shot. Get the shot, moving.',
    help: 'Sketch the frame you want and describe the movement in a line. Squirreal renders it as a clip, keeping your composition, and holds it steady across every frame.',
  },
  realtouch: {
    id: 'realtouch',
    name: 'Realtouch',
    shortcut: 'R',
    icon: 'eraser-magic',
    ai: true,
    cost: 150,
    group: 'repair',
    tagline: 'Remove something from every frame at once.',
    help: 'Paint over it once. Squirreal works out where the shot was filmed, looks the place up, and rebuilds what was behind it — then holds that answer steady as the camera moves.',
  },
  'gif-animate': {
    id: 'gif-animate',
    name: 'GIF Animate',
    shortcut: 'G',
    icon: 'film',
    ai: false,
    cost: 0,
    group: 'motion',
    tagline: 'Turn the clip into a looping GIF.',
    help: 'The motion is already there, so this is local work: pick the seconds you want and Squirreal encodes them into a looping GIF. Free, on every edition.',
  },
  expand: {
    id: 'expand',
    name: 'Expand',
    shortcut: 'E',
    icon: 'expand',
    ai: false,
    cost: 0,
    group: 'canvas',
    tagline: 'Grow the frame. Never costs a credit.',
    help: 'Pull the frame out in any direction. The new margin is filled by mirroring the edge, on every frame of the clip. Local, instant, free.',
  },
  aiscope: {
    id: 'aiscope',
    name: 'AIScope',
    shortcut: 'Z',
    icon: 'scope',
    ai: false,
    learnCost: 15,
    cost: 0,
    group: 'inspect',
    minZoom: 80,
    maxZoom: 60000,
    tagline: 'Zoom 80× to 60,000× into any frame.',
    help: 'Park on a frame and dive into it. Zoom runs locally and is free at any magnification; Learn studies the crop and writes down what the thing is.',
  },
};

export const VIDEO_TOOL_ORDER = ['draw', 'magic-draw', 'realtouch', 'gif-animate', 'expand', 'aiscope'];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n) => clamp(n, 0, 1);

/**
 * Magic Draw costs 40–120. Length dominates — a clip twice as long is twice
 * the work — with the sketch's own complexity and the output size behind it.
 *
 * @param {{seconds:number, coveragePct:number, colorCount:number, megapixels:number}} sketch
 */
export function estimateVideoMagicDraw({ seconds = 4, coveragePct = 0, colorCount = 1, megapixels = 1 } = {}) {
  const { min, max } = VIDEO_TOOLS['magic-draw'].cost;
  const length = clamp01((clamp(seconds, 1, MAX_CLIP_SECONDS) - 1) / (MAX_CLIP_SECONDS - 1));
  const coverage = clamp01(coveragePct / 60);
  const palette = clamp01((colorCount - 1) / 11);
  const size = clamp01((megapixels - 0.5) / 3.5);
  const weight = 0.55 * length + 0.2 * coverage + 0.1 * palette + 0.15 * size;
  return Math.round(min + weight * (max - min));
}

/** Realtouch is flat per clip, but a short clip should not cost a long one. */
export function estimateVideoRealtouch({ seconds = 4 } = {}) {
  const full = VIDEO_TOOLS.realtouch.cost;
  const s = clamp(seconds, 1, MAX_CLIP_SECONDS);
  return Math.max(45, Math.round((0.4 + 0.6 * (s / MAX_CLIP_SECONDS)) * full));
}

export function videoCostOf(toolId, params = {}) {
  const tool = VIDEO_TOOLS[toolId];
  if (!tool) throw new Error(`Unknown tool: ${toolId}`);
  if (toolId === 'magic-draw') return estimateVideoMagicDraw(params);
  if (toolId === 'realtouch') return estimateVideoRealtouch(params);
  if (toolId === 'aiscope') return params.learn ? tool.learnCost : 0;
  return typeof tool.cost === 'number' ? tool.cost : tool.cost.min;
}

export function videoNeedsAi(toolId, params = {}) {
  const tool = VIDEO_TOOLS[toolId];
  if (!tool) return false;
  if (toolId === 'aiscope') return Boolean(params.learn);
  return tool.ai;
}

export function videoAvailability(toolId, edition, params = {}) {
  const tool = VIDEO_TOOLS[toolId];
  if (!tool) return { allowed: false, reason: 'unknown-tool' };
  if (!videoNeedsAi(toolId, params)) return { allowed: true };
  if (edition === 'free') {
    return {
      allowed: false,
      reason: 'no-ai-on-free',
      message: `${tool.name} needs the AI. Squirreal Free runs everything local — upgrade to bring it back.`,
    };
  }
  if (!EDITIONS.includes(edition)) return { allowed: false, reason: 'unlicensed' };
  return { allowed: true };
}
