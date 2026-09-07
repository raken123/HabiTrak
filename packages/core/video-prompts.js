// Squirreal's prompts. Kept apart from Hazelnut's so the wording can move with
// the medium without disturbing the still-image product.

export function videoMagicDrawPrompt({ userPrompt, motion, style = 'live-action shot', seconds = 4 }) {
  return [
    'You are given a rough hand-drawn sketch of a single frame.',
    `Render it as a believable ${style}, about ${seconds} seconds long.`,
    '',
    'Hold to the sketch exactly:',
    '- The first frame must match the sketch: same composition, same layout,',
    '  same relative sizes, same camera angle.',
    '- Treat the drawn colours as the intended colours of the real subjects.',
    '- Add nothing that is not drawn: no text, captions, watermarks or borders.',
    '- The result must not look like a drawing, a render or a game.',
    '',
    'Hold it steady across the clip:',
    '- The subject keeps its shape, colour and markings in every frame.',
    '- Light comes from the same direction throughout.',
    '- Nothing flickers, warps or swims between frames.',
    motion ? `\nThe movement is: "${motion}"` : '\nKeep the camera still and let the scene move naturally.',
    userPrompt ? `The artist describes the shot as: "${userPrompt}"` : '',
    '\nReturn the clip only.',
  ].filter(Boolean).join('\n');
}

export function videoScenePrompt() {
  return [
    'You are the analysis stage of an object-removal tool that works on video.',
    '',
    'A frame from the clip is supplied with a region marked in solid magenta.',
    'Something is being removed from there, in every frame, and the gap has to',
    'be rebuilt convincingly as the camera moves.',
    '',
    'Work out, in this order:',
    '1. WHERE this was filmed. If the setting is a recognisable place — a',
    '   landmark, a named street, a specific building, a known interior —',
    '   search for it and say which. If it is anonymous, say so plainly.',
    '2. WHAT the magenta region is covering, from its shape and its shadow.',
    '3. WHAT IS PHYSICALLY BEHIND IT, and how that continues as the camera',
    '   moves: the surfaces, their colour, texture, scale, perspective and',
    '   lighting, and what comes into view as the angle changes. If you',
    '   identified the place, use what you found — photographs of the same spot',
    '   from other angles tell you what the object is hiding.',
    '',
    'Answer in three short labelled paragraphs: PLACE, OBJECT, BEHIND.',
    'Be concrete and visual. No preamble.',
  ].join('\n');
}

export function videoRealtouchPrompt({ scene, userHint }) {
  return [
    'Remove the object covered by the magenta region from this clip, and paint',
    'back what belongs there, so the result looks like footage shot with the',
    'object simply not present.',
    '',
    'A separate analysis of the scene found the following. Follow it:',
    '---',
    scene,
    '---',
    '',
    'Requirements:',
    '- No magenta may remain in any frame.',
    '- Continue every surface, edge and line that ran into the region, and keep',
    '  that answer consistent as the camera moves — no swimming, no flicker.',
    '- Match grain, focus, motion blur and colour grading to the surrounding',
    '  footage.',
    '- Remove the object\'s shadow, reflection and contact darkening too.',
    '- Change nothing outside the region. Same framing, same length, same rate.',
    userHint ? `- The user adds: "${userHint}"` : '',
    '',
    'Return the clip only.',
  ].filter(Boolean).join('\n');
}
