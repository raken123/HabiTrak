// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// Every prompt Hazelnut sends, in one file.
//
// Keeping them together means the wording of a tool can be tuned without
// hunting through the engine, and it makes it obvious at a glance what the app
// asks a model to do on the user's behalf.

export function magicDrawPrompt({ userPrompt, style = 'photograph' }) {
  return [
    'You are given a rough hand-drawn 2D sketch on a plain canvas.',
    `Render it as a believable ${style}.`,
    '',
    'Hold to the sketch exactly:',
    '- Keep every object in the same position, at the same relative size.',
    '- Keep the composition, horizon and camera angle the sketch implies.',
    '- Treat the drawn colours as the intended colours of the real objects.',
    '- Do not add objects, text, captions, watermarks or borders that are not drawn.',
    '- Do not leave the result looking like a drawing, a painting or a render.',
    '',
    'Interpret the strokes generously: a wobbly line is a straight edge, a scribble',
    'is texture, and a flat shape is a solid three-dimensional object seen from the',
    'angle the sketch implies. Light the scene consistently and give surfaces real',
    'material properties.',
    userPrompt ? `\nThe artist describes the scene as: "${userPrompt}"` : '',
    '\nReturn the finished image only.',
  ].filter(Boolean).join('\n');
}

export function realtouchScenePrompt() {
  return [
    'You are the analysis stage of an object-removal tool.',
    '',
    'The image contains a region marked in solid magenta. Something is being',
    'removed from there and the gap has to be rebuilt convincingly.',
    '',
    'Work out, in this order:',
    '1. WHERE this photograph was taken. If the setting is a recognisable place —',
    '   a landmark, a named street, a specific building, a known interior — search',
    '   for it and say which place it is. If it is anonymous, say so plainly',
    '   rather than guessing at a name.',
    '2. WHAT the magenta region is covering, judging from the object\'s shape,',
    '   its shadow, and what it interrupts.',
    '3. WHAT IS PHYSICALLY BEHIND IT. This is the important part. Continue the',
    '   surfaces that run into the region: describe the wall, floor, foliage,',
    '   skyline, tiling, brickwork, road markings or horizon that must resume,',
    '   including their colour, texture, scale, perspective and lighting. If you',
    '   identified the place, use what you found about it — a photograph of the',
    '   same spot from another angle tells you what the object is hiding.',
    '',
    'Answer in three short labelled paragraphs: PLACE, OBJECT, BEHIND.',
    'Be concrete and visual. No preamble, no caveats about being an AI.',
  ].join('\n');
}

export function realtouchInpaintPrompt({ scene, userHint }) {
  return [
    'Remove the object covered by the magenta region from this photograph and',
    'paint back what belongs there, so the result looks like a photograph that',
    'was taken with the object simply not present.',
    '',
    'A separate analysis of the scene found the following. Follow it:',
    '---',
    scene,
    '---',
    '',
    'Requirements:',
    '- No magenta may remain anywhere in the output.',
    '- Continue every surface, edge and line that ran into the region.',
    '- Match grain, focus, colour grading and lighting to the surrounding pixels.',
    '- Remove the object\'s shadow, reflection and any contact darkening too.',
    '- Change nothing outside the region. Same framing, same dimensions.',
    userHint ? `- The user adds: "${userHint}"` : '',
    '',
    'Return the finished image only.',
  ].filter(Boolean).join('\n');
}

export function gifFramePrompt({ motion, index, total, isFirst }) {
  const progress = total > 1 ? Math.round((index / (total - 1)) * 100) : 100;
  return [
    isFirst
      ? 'This is the opening frame of a short looping animation.'
      : `This is frame ${index + 1} of ${total} in a short looping animation. The previous frame is supplied.`,
    '',
    `The motion is: "${motion}"`,
    `This frame sits about ${progress}% of the way through that motion.`,
    '',
    'Rules:',
    '- Keep the subject, camera, framing, palette and style identical between frames.',
    '- Advance only what the motion describes. Everything else holds still.',
    '- Move by a small, even step, so the frames play back smoothly.',
    '- Exactly the same image dimensions as the input.',
    '',
    'Return the finished frame only.',
  ].join('\n');
}

export function aiscopePrompt({ zoom }) {
  return [
    `This is a crop of a photograph, magnified about ${formatZoom(zoom)}.`,
    'Identify what is in it and describe it so precisely that the description',
    'could be used to recognise the same thing in another photograph.',
    '',
    'At high magnification you are looking at surface structure — weave, grain,',
    'pores, crystal faces, print rosettes, sensor noise, tool marks. Say which of',
    'those you are seeing, and say when the magnification has passed the point',
    'where real detail exists and you are describing interpolation artefacts',
    'rather than the subject.',
  ].join('\n');
}

export const AISCOPE_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: 'A short name for the thing, 1-4 words.' },
    category: { type: 'string', description: 'Its broad kind, e.g. textile, mineral, circuitry, skin, print.' },
    description: { type: 'string', description: 'Two or three sentences on what it is and what it is made of.' },
    features: { type: 'array', items: { type: 'string' }, description: 'Three to five distinguishing visual features.' },
    material: { type: 'string' },
    scaleNote: { type: 'string', description: 'Whether the detail shown is real or interpolated at this magnification.' },
    confidence: { type: 'number', description: '0 to 1.' },
  },
  required: ['subject', 'category', 'description', 'features', 'confidence'],
};

export function miniIntentPrompt({ message }) {
  return [
    'You are the parser for a one-line photo-editing app whose only skill is',
    'removing things from a picture.',
    '',
    `The user typed: "${message}"`,
    '',
    'Decide what they want removed and answer as JSON.',
    'If they asked for something the app cannot do — adding, restyling, cropping,',
    'colour changes — set `removable` to false and explain in one friendly',
    'sentence that this app only removes things.',
  ].join('\n');
}

export const MINI_INTENT_SCHEMA = {
  type: 'object',
  properties: {
    removable: { type: 'boolean' },
    target: { type: 'string', description: 'What to remove, as a short noun phrase.' },
    reply: { type: 'string', description: 'One sentence shown in the chat.' },
  },
  required: ['removable', 'reply'],
};

export function miniRemovePrompt({ target }) {
  return [
    `Remove ${target} from this photograph, completely.`,
    '',
    '- Rebuild whatever was behind it: continue the surfaces, edges and lines it',
    '  interrupted, matching their perspective, texture and lighting.',
    '- Remove its shadow, its reflection and any darkening where it met a surface.',
    '- Leave the rest of the photograph untouched. Same framing, same dimensions,',
    '  same grain and colour grading.',
    '- The result must read as a photograph taken with that thing not there.',
    '',
    'Return the finished image only.',
  ].join('\n');
}

export function formatZoom(zoom) {
  return `${Math.round(zoom).toLocaleString('en-US')}\u00d7`;
}
