import { createImagineTool } from './imagine.js';
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
  createMagicTextTool,
} from './transform.js';

export function createTools() {
  return {
    // The twenty-third, and the only one that makes a picture rather than
    // changing one. It is also the only one that never leaves the machine.
    imagine: createImagineTool(),

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

    // And the twenty-second: the same masked-transform machinery, pointed at
    // the lettering in the picture rather than at the thing you want gone.
    'magic-text': createMagicTextTool(),
  };
}
