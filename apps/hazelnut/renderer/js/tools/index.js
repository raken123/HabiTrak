import { createDrawTool } from './draw.js';
import { createMagicDrawTool } from './magicdraw.js';
import { createRealtouchTool } from './realtouch.js';
import { createGifAnimateTool } from './gifanimate.js';
import { createExpandTool } from './expand.js';
import { createAIScopeTool } from './aiscope.js';
import { createCropTool } from './crop.js';
import { createStraightenTool } from './straighten.js';
import { createTextTool } from './text.js';
import { createCaptionTool } from './caption.js';
import {
  createLevelsTool, createColourTool, createSharpenTool,
  createDenoiseTool, createVignetteTool,
} from './adjust.js';
import {
  createEraseTool, createUpscaleTool, createRestoreTool,
  createColouriseTool, createBackgroundTool, createSkyTool,
} from './transform.js';

export function createTools() {
  return {
    // The six the app shipped with.
    draw: createDrawTool(),
    'magic-draw': createMagicDrawTool(),
    realtouch: createRealtouchTool(),
    'gif-animate': createGifAnimateTool(),
    expand: createExpandTool(),
    aiscope: createAIScopeTool(),

    // The fifteen that came after: eight local, seven that call the model and
    // cost between three and eight credits.
    crop: createCropTool(),
    straighten: createStraightenTool(),
    levels: createLevelsTool(),
    colour: createColourTool(),
    sharpen: createSharpenTool(),
    denoise: createDenoiseTool(),
    vignette: createVignetteTool(),
    text: createTextTool(),
    erase: createEraseTool(),
    upscale: createUpscaleTool(),
    restore: createRestoreTool(),
    colourise: createColouriseTool(),
    background: createBackgroundTool(),
    sky: createSkyTool(),
    caption: createCaptionTool(),
  };
}
