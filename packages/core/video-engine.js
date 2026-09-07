// Squirreal's tool engine.
//
// The same shape as Hazelnut's: gate on the edition, quote the price, run the
// model, charge only once a result exists. What differs is the medium — every
// generation here is a clip, and a clip has a length, which is what the price
// is mostly made of.
//
// Draw, Expand and GIF Animate never reach this file: the first two are canvas
// work, and in a video app the motion already exists, so encoding a loop is
// local too.

import { videoAvailability, videoCostOf, MAX_CLIP_SECONDS } from './video-tools.js';
import { parseDataUrl, toDataUrl } from './imaging.js';
import { LockedError } from './engine.js';
import {
  videoMagicDrawPrompt,
  videoScenePrompt,
  videoRealtouchPrompt,
} from './video-prompts.js';
import { aiscopePrompt, AISCOPE_SCHEMA } from './prompts.js';

export class VideoEngine {
  /**
   * @param {{video: import('./video.js').VideoClient,
   *          client: import('./gemini.js').GeminiClient,
   *          credits: import('./credits.js').Credits,
   *          license: import('./license.js').License}} deps
   */
  constructor({ video, client, credits, license }) {
    this.video = video;
    this.client = client;
    this.credits = credits;
    this.license = license;
  }

  #gate(toolId, params = {}) {
    const check = videoAvailability(toolId, this.license.edition(), params);
    if (!check.allowed) {
      throw new LockedError(check.message || 'That tool is not available on this edition.', check.reason);
    }
    const needsVideo = toolId === 'magic-draw' || toolId === 'realtouch';
    const configured = needsVideo ? this.video.configured : this.client.configured;
    if (!configured) {
      const err = new Error('No API key is configured. Open Settings → AI to add one.');
      err.code = 'NO_API_KEY';
      throw err;
    }
  }

  quote(toolId, params = {}) {
    const cost = videoCostOf(toolId, params);
    const check = videoAvailability(toolId, this.license.edition(), params);
    return {
      cost,
      balance: this.credits.balance,
      affordable: this.credits.balance >= cost,
      allowed: check.allowed,
      reason: check.reason || null,
      message: check.message || null,
    };
  }

  /** Clamp a requested length to what a single generation covers. */
  static clampSeconds(seconds) {
    return Math.min(MAX_CLIP_SECONDS, Math.max(1, Number(seconds) || 4));
  }

  // -------------------------------------------------------------------------
  // Magic Draw — a sketch, or a still, becomes a shot
  // -------------------------------------------------------------------------

  /**
   * @param {{sketch:string, prompt?:string, motion?:string, seconds?:number,
   *          fps?:number, style?:string, metrics?:object,
   *          onProgress?:Function, signal?:AbortSignal}} opts
   */
  async magicDraw({
    sketch, prompt = '', motion = '', seconds = 4, fps = 24,
    style = 'live-action shot', metrics = {}, onProgress = () => {}, signal,
  } = {}) {
    const length = VideoEngine.clampSeconds(seconds);
    const params = {
      seconds: length,
      coveragePct: metrics.coveragePct ?? 0,
      colorCount: metrics.colorCount ?? 1,
      megapixels: metrics.megapixels ?? 1,
    };
    this.#gate('magic-draw', params);

    return this.credits.charge('magic-draw', params, async () => {
      const clip = await this.video.generateClip({
        prompt: videoMagicDrawPrompt({ userPrompt: prompt, motion, style, seconds: length }),
        images: [asPart(sketch)],
        seconds: length,
        fps,
        onProgress,
        signal,
      });
      return { clip: toDataUrl(clip.base64, clip.mimeType), seconds: length, fps };
    });
  }

  // -------------------------------------------------------------------------
  // Realtouch — remove it from every frame, not just this one
  // -------------------------------------------------------------------------

  /**
   * The same two passes as Hazelnut: work out where the shot was filmed and
   * what is behind the thing, then rebuild — but the answer has to hold as the
   * camera moves, which is why the study is done once and handed to the clip.
   *
   * @param {{frame:string, marked:string, clip?:string, seconds?:number,
   *          hint?:string, onProgress?:Function, signal?:AbortSignal}} opts
   */
  async realtouch({
    frame, marked, clip = null, seconds = 4, hint = '',
    onProgress = () => {}, signal,
  } = {}) {
    const length = VideoEngine.clampSeconds(seconds);
    this.#gate('realtouch', { seconds: length });

    return this.credits.charge('realtouch', { seconds: length }, async () => {
      onProgress({ stage: 'examining', message: 'Looking up where this was filmed…' });
      const study = await this.client.analyze({
        prompt: videoScenePrompt(),
        images: [asPart(marked)],
        search: true,
        temperature: 0.2,
        signal,
      });

      onProgress({
        stage: 'rebuilding',
        message: study.sources.length
          ? `Found ${study.sources.length} reference${study.sources.length === 1 ? '' : 's'}. Rebuilding it across every frame…`
          : 'Rebuilding it across every frame…',
        sources: study.sources,
      });

      const images = [asPart(marked), asPart(frame)];
      if (clip) images.push(asPart(clip));

      const out = await this.video.generateClip({
        prompt: videoRealtouchPrompt({ scene: study.text, userHint: hint }),
        images,
        seconds: length,
        onProgress,
        signal,
      });

      return {
        clip: toDataUrl(out.base64, out.mimeType),
        seconds: length,
        scene: study.text,
        sources: study.sources,
      };
    });
  }

  // -------------------------------------------------------------------------
  // AIScope — the still tool, on whichever frame you are parked on
  // -------------------------------------------------------------------------

  async aiscopeLearn({ crop, zoom = 80, signal } = {}) {
    this.#gate('aiscope', { learn: true });

    return this.credits.charge('aiscope', { learn: true }, async () => {
      const study = await this.client.analyze({
        prompt: aiscopePrompt({ zoom }),
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
}

function asPart(dataUrl) {
  const { mimeType, base64 } = parseDataUrl(dataUrl);
  return { mimeType, base64 };
}
