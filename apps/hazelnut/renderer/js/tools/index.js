import { createDrawTool } from './draw.js';
import { createMagicDrawTool } from './magicdraw.js';
import { createRealtouchTool } from './realtouch.js';
import { createGifAnimateTool } from './gifanimate.js';
import { createExpandTool } from './expand.js';
import { createAIScopeTool } from './aiscope.js';

export function createTools() {
  return {
    draw: createDrawTool(),
    'magic-draw': createMagicDrawTool(),
    realtouch: createRealtouchTool(),
    'gif-animate': createGifAnimateTool(),
    expand: createExpandTool(),
    aiscope: createAIScopeTool(),
  };
}
