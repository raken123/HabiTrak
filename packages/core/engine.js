// The tool engine.
//
// Everything that talks to a model lives here, behind one method per tool. The
// engine owns the order in which things happen — check the licence, quote the
// cost, run the model, charge only on success — so neither app has to get that
// sequence right on its own.
//
// Draw and Expand are absent by design: they never leave the canvas, so they
// are implemented entirely in the renderer and never reach this file.

import { availability, costOf } from './tools.js';
import { TRANSFORMS, transformPrompt, captionPrompt, CAPTION_SCHEMA } from './transforms.js';
import { parseDataUrl, toDataUrl, imageSize, megapixels, base64ToBytes } from './imaging.js';
import { framePlan } from './gif.js';
import {
  magicDrawPrompt,
  realtouchScenePrompt,
  realtouchInpaintPrompt,
  gifFramePrompt,
  aiscopePrompt,
  AISCOPE_SCHEMA,
  miniIntentPrompt,
  MINI_INTENT_SCHEMA,
  miniScenePrompt,
  miniRemovePrompt,
} from './prompts.js';

export class LockedError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'LockedError';
    this.code = 'TOOL_LOCKED';
    this.reason = reason;
  }
}

export class Engine {
  /**
   * @param {{client: import('./gemini.js').GeminiClient, credits: import('./credits.js').Credits, license: import('./license.js').License}} deps
   */
  constructor({ client, credits, license }) {
    this.client = client;
    this.credits = credits;
    this.license = license;
  }

  /** Throw unless the current edition may run this tool with these parameters. */
  #gate(toolId, params = {}) {
    const check = availability(toolId, this.license.edition(), params);
    if (!check.allowed) {
      throw new LockedError(check.message || 'That tool is not available on this edition.', check.reason);
    }
    if (!this.client.configured) {
      const err = new Error('No Gemini API key is configured. Open Settings → AI to add one.');
      err.code = 'NO_API_KEY';
      throw err;
    }
  }

  /** What a tool would cost right now, for the UI to quote before committing. */
  quote(toolId, params = {}) {
    const cost = costOf(toolId, params);
    const check = availability(toolId, this.license.edition(), params);
    return {
      cost,
      balance: this.credits.balance,
      affordable: this.credits.balance >= cost,
      allowed: check.allowed,
      reason: check.reason || null,
      message: check.message || null,
    };
  }

  // -------------------------------------------------------------------------
  // Magic Draw — a 2D sketch becomes the real thing
  // -------------------------------------------------------------------------

  /**
   * @param {{sketch:string, prompt?:string, style?:string, metrics?:object, signal?:AbortSignal}} opts
   */
  async magicDraw({ sketch, prompt = '', style = 'photograph', metrics = {}, signal } = {}) {
    const params = {
      coveragePct: metrics.coveragePct ?? 0,
      colorCount: metrics.colorCount ?? 1,
      megapixels: metrics.megapixels ?? sizeOf(sketch).megapixels,
    };
    this.#gate('magic-draw', params);

    return this.credits.charge('magic-draw', params, async () => {
      const image = await this.client.generateImage({
        prompt: magicDrawPrompt({ userPrompt: prompt, style }),
        images: [asPart(sketch)],
        temperature: 0.6,
        signal,
      });
      return { image: toDataUrl(image.base64, image.mimeType), note: image.text };
    });
  }

  // -------------------------------------------------------------------------
  // Realtouch — remove an object, and rebuild what was genuinely behind it
  // -------------------------------------------------------------------------

  /**
   * Two passes. The first looks the scene up — with Google Search grounding, so
   * a recognisable location contributes real photographs of the same place
   * rather than a guess. The second paints the gap using what the first found.
   *
   * @param {{image:string, marked:string, hint?:string, onProgress?:Function, signal?:AbortSignal}} opts
   */
  async realtouch({ image, marked, hint = '', onProgress = () => {}, signal } = {}) {
    this.#gate('realtouch');

    return this.credits.charge('realtouch', {}, async () => {
      onProgress({ stage: 'examining', message: 'Looking up where this was taken…' });
      const study = await this.client.analyze({
        prompt: realtouchScenePrompt(),
        images: [asPart(marked)],
        search: true,
        temperature: 0.2,
        signal,
      });

      onProgress({
        stage: 'rebuilding',
        message: study.sources.length
          ? `Found ${study.sources.length} reference${study.sources.length === 1 ? '' : 's'}. Rebuilding what was behind it…`
          : 'Rebuilding what was behind it…',
        sources: study.sources,
      });

      const result = await this.client.generateImage({
        prompt: realtouchInpaintPrompt({ scene: study.text, userHint: hint }),
        images: [asPart(marked), asPart(image)],
        temperature: 0.4,
        signal,
      });

      return {
        image: toDataUrl(result.base64, result.mimeType),
        scene: study.text,
        sources: study.sources,
      };
    });
  }

  // -------------------------------------------------------------------------
  // GIF Animate — up to five seconds of movement
  // -------------------------------------------------------------------------

  /**
   * Keyframes are generated in a chain, each one conditioned on the frame
   * before it, which is what keeps the subject from drifting. Generating every
   * played frame this way would mean forty model calls for five seconds, so the
   * engine produces a handful of keyframes and the renderer cross-fades between
   * them to reach the playback rate.
   *
   * @param {{image:string, motion:string, seconds?:number, fps?:number, onProgress?:Function, signal?:AbortSignal}} opts
   */
  async gifAnimate({ image, motion, seconds = 5, fps = 8, onProgress = () => {}, signal } = {}) {
    this.#gate('gif-animate');
    if (!motion || !motion.trim()) {
      throw new Error('GIF Animate needs a description of the motion.');
    }
    const plan = framePlan(seconds, fps);
    const keyCount = Math.min(8, Math.max(3, Math.round(plan.seconds * 1.6)));

    return this.credits.charge('gif-animate', { seconds: plan.seconds, fps: plan.fps }, async () => {
      const keyframes = [image];
      let previous = image;

      for (let i = 1; i < keyCount; i += 1) {
        onProgress({
          stage: 'frames',
          message: `Generating keyframe ${i + 1} of ${keyCount}…`,
          done: i,
          total: keyCount,
        });
        const frame = await this.client.generateImage({
          prompt: gifFramePrompt({ motion, index: i, total: keyCount, isFirst: false }),
          images: [asPart(previous), asPart(image)],
          temperature: 0.45,
          signal,
        });
        previous = toDataUrl(frame.base64, frame.mimeType);
        keyframes.push(previous);
      }

      onProgress({ stage: 'encoding', message: 'Encoding the GIF…', done: keyCount, total: keyCount });
      return { keyframes, plan, keyCount };
    });
  }

  // -------------------------------------------------------------------------
  // AIScope — learn what the magnified thing actually is
  // -------------------------------------------------------------------------

  /**
   * The zoom itself is local and free; this is the Learn button. The result is
   * a structured card so the UI can lay it out rather than print a paragraph.
   *
   * @param {{crop:string, zoom:number, signal?:AbortSignal}} opts
   */
  async aiscopeLearn({ crop, zoom = 80, cropPx = null, signal } = {}) {
    this.#gate('aiscope', { learn: true });

    return this.credits.charge('aiscope', { learn: true }, async () => {
      const study = await this.client.analyze({
        prompt: aiscopePrompt({ zoom, cropPx }),
        images: [asPart(crop)],
        json: AISCOPE_SCHEMA,
        temperature: 0.25,
        signal,
      });
      const card = study.data || {
        subject: 'Unclear',
        category: 'unknown',
        description: study.text || 'The model could not describe this crop.',
        features: [],
        confidence: 0,
      };
      return { card: { ...card, zoom }, raw: study.text };
    });
  }

  // -------------------------------------------------------------------------
  // The cheap edits — Erase, Upscale, Restore, Colourise, Background, Sky
  // -------------------------------------------------------------------------

  /**
   * One photograph in, one photograph out. Every tool in `TRANSFORMS` is the
   * same call with a different instruction, so there is one code path to gate,
   * charge, cancel and report on rather than six.
   *
   * @param {{toolId:string, image:string, mask?:string, params?:object,
   *          onProgress?:Function, signal?:AbortSignal}} opts
   */
  async transform({ toolId, image, mask = null, params = {}, onProgress = () => {}, signal } = {}) {
    const spec = TRANSFORMS[toolId];
    if (!spec) throw new Error(`Unknown transform: ${toolId}`);
    if (spec.needsMask && !mask) throw new Error('Paint over what you want changed first.');
    this.#gate(toolId, params);

    return this.credits.charge(toolId, params, async () => {
      onProgress({ stage: 'render', message: 'Sending the picture…' });
      const out = await this.client.generateImage({
        prompt: transformPrompt(toolId, params),
        // The marked copy goes first when there is one: the instruction talks
        // about "the first image", and the order is what makes that true.
        images: mask ? [asPart(mask), asPart(image)] : [asPart(image)],
        temperature: 0.35,
        signal,
      });
      return { image: toDataUrl(out.base64, out.mimeType), note: out.text };
    });
  }

  /**
   * Caption — the only AI tool that generates nothing, which is why it is the
   * cheapest thing in the app.
   *
   * @param {{image:string, signal?:AbortSignal}} opts
   */
  async describe({ image, signal } = {}) {
    this.#gate('caption');

    return this.credits.charge('caption', {}, async () => {
      const study = await this.client.analyze({
        prompt: captionPrompt(),
        images: [asPart(image)],
        json: CAPTION_SCHEMA,
        temperature: 0.2,
        signal,
      });
      const data = study.data || {};
      return {
        caption: data.caption || study.text || '',
        alt: data.alt || '',
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
        note: data.note || '',
      };
    });
  }

  // -------------------------------------------------------------------------
  // Hazelnut Mini — one chat bar, one skill
  // -------------------------------------------------------------------------

  /**
   * Mini is Realtouch with the masking UI replaced by a sentence, so it does
   * Realtouch's work: it reads the request, looks the place up, and only then
   * rebuilds the gap. Parsing the request costs nothing — a message that turns
   * out not to be a removal is answered and never charged.
   *
   * @param {{image:string, message:string, onProgress?:Function, signal?:AbortSignal}} opts
   */
  async miniRemove({ image, message, onProgress = () => {}, signal } = {}) {
    this.#gate('realtouch');

    onProgress({ stage: 'reading', message: 'Reading your message…' });
    const intent = await this.client.analyze({
      prompt: miniIntentPrompt({ message }),
      json: MINI_INTENT_SCHEMA,
      temperature: 0.1,
      signal,
    });
    const parsed = intent.data || { removable: true, target: message, reply: `Removing ${message}.` };

    if (!parsed.removable || !parsed.target) {
      // Nothing ran, so nothing is charged.
      return {
        result: { handled: false, reply: parsed.reply || 'Mini only removes things from photos.' },
        charged: 0,
        balance: this.credits.balance,
      };
    }

    return this.credits.charge('realtouch', {}, async () => {
      onProgress({ stage: 'examining', message: 'Looking up where this was taken…' });
      const study = await this.client.analyze({
        prompt: miniScenePrompt({ target: parsed.target }),
        images: [asPart(image)],
        search: true,
        temperature: 0.2,
        signal,
      });

      onProgress({
        stage: 'rebuilding',
        message: study.sources.length
          ? `Found ${study.sources.length} reference${study.sources.length === 1 ? '' : 's'}. Rebuilding what was behind it…`
          : `Rebuilding what was behind ${parsed.target}…`,
        sources: study.sources,
      });

      const result = await this.client.generateImage({
        prompt: miniRemovePrompt({ target: parsed.target, scene: study.text }),
        images: [asPart(image)],
        temperature: 0.4,
        signal,
      });
      return {
        handled: true,
        target: parsed.target,
        reply: parsed.reply || `Removed ${parsed.target}.`,
        image: toDataUrl(result.base64, result.mimeType),
        scene: study.text,
        sources: study.sources,
      };
    });
  }
}

function asPart(dataUrl) {
  const { mimeType, base64 } = parseDataUrl(dataUrl);
  return { mimeType, base64 };
}

function sizeOf(dataUrl) {
  try {
    const { base64 } = parseDataUrl(dataUrl);
    const size = imageSize(base64ToBytes(base64));
    return size ? { ...size, megapixels: megapixels(size.width, size.height) } : { megapixels: 1 };
  } catch {
    return { megapixels: 1 };
  }
}
