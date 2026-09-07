// The video client.
//
// ─────────────────────────────────────────────────────────────────────────────
// UNVERIFIED AGAINST THE REAL API.
//
// Squirreal is specified to run on "Gemini Omni 1.1 Flash". That model is not
// one this code has ever reached: the endpoint is unreachable from the machine
// this was written on, so not a single real request or response has been
// observed. What follows is the shape every text-to-video API in this family
// uses — a long-running operation that is started and then polled — expressed
// so that the parts most likely to be wrong are the parts easiest to change:
//
//   HAZELNUT_VIDEO_MODEL     the model id
//   HAZELNUT_VIDEO_MODE      'operation' (start then poll) or 'inline'
//   HAZELNUT_VIDEO_START     the method appended to the model for the request
//
// If the real API differs, it differs here and nowhere else: the engine above
// only ever asks this file for "a clip, from these images and this prompt".
// ─────────────────────────────────────────────────────────────────────────────

import { GeminiError, DEFAULT_API_BASE } from './gemini.js';

const env = (name) => (typeof process !== 'undefined' ? process.env?.[name] : undefined);

export const DEFAULT_VIDEO_MODEL = 'gemini-omni-1.1-flash';

/** How long to keep asking whether the clip is ready. */
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

export class VideoClient {
  constructor({
    apiKey,
    apiBase = env('HAZELNUT_API_BASE') || DEFAULT_API_BASE,
    model = env('HAZELNUT_VIDEO_MODEL') || DEFAULT_VIDEO_MODEL,
    mode = env('HAZELNUT_VIDEO_MODE') || 'operation',
    startMethod = env('HAZELNUT_VIDEO_START') || 'predictLongRunning',
    fetchImpl = globalThis.fetch,
    maxRetries = 3,
    timeoutMs = 120_000,
    pollIntervalMs = POLL_INTERVAL_MS,
    pollTimeoutMs = POLL_TIMEOUT_MS,
  } = {}) {
    this.apiKey = apiKey;
    this.apiBase = apiBase.replace(/\/+$/, '');
    this.model = model;
    this.mode = mode;
    this.startMethod = startMethod;
    this.fetchImpl = fetchImpl;
    this.maxRetries = maxRetries;
    this.timeoutMs = timeoutMs;
    this.pollIntervalMs = pollIntervalMs;
    this.pollTimeoutMs = pollTimeoutMs;
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  async #request(url, body, { signal, method = 'POST' } = {}) {
    if (!this.apiKey) {
      throw new GeminiError('No API key configured. Add one in Settings → AI.', { status: 401 });
    }
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const timer = AbortSignal.timeout ? AbortSignal.timeout(this.timeoutMs) : undefined;
      try {
        const res = await this.fetchImpl(url, {
          method,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: body ? JSON.stringify(body) : undefined,
          signal: signal || timer,
        });
        if (res.ok) return await res.json();

        const text = await res.text().catch(() => '');
        const err = describe(res.status, text);
        if (!err.retryable || attempt === this.maxRetries) throw err;
        lastError = err;
      } catch (err) {
        if (err instanceof GeminiError && !err.retryable) throw err;
        if (attempt === this.maxRetries) {
          throw err instanceof GeminiError ? err
            : new GeminiError(`Could not reach the video model: ${err.message}`, { retryable: true, cause: err });
        }
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, Math.min(8000, 2 ** attempt * 700) + Math.random() * 300));
    }
    throw lastError;
  }

  /**
   * Ask for a clip.
   *
   * @param {{prompt:string, images?:Array<{mimeType:string,base64:string}>,
   *          seconds?:number, fps?:number, aspectRatio?:string,
   *          onProgress?:Function, signal?:AbortSignal}} opts
   * @returns {Promise<{base64:string, mimeType:string, seconds:number}>}
   */
  async generateClip({
    prompt,
    images = [],
    seconds = 4,
    fps = 24,
    aspectRatio = '16:9',
    onProgress = () => {},
    signal,
  } = {}) {
    const parts = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mimeType || 'image/png', data: img.base64 } });
    }
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['VIDEO'],
        videoConfig: { durationSeconds: seconds, fps, aspectRatio },
      },
    };

    if (this.mode === 'inline') {
      const json = await this.#request(`${this.url(this.model)}:generateContent`, body, { signal });
      const clip = firstInlineVideo(json);
      if (!clip) throw noClip(json);
      return { ...clip, seconds };
    }

    onProgress({ stage: 'queued', message: 'Sending the shot…' });
    const started = await this.#request(`${this.url(this.model)}:${this.startMethod}`, body, { signal });

    const name = started?.name;
    if (!name) {
      // Some deployments answer immediately rather than handing back an
      // operation; take the clip if it is already here.
      const clip = firstInlineVideo(started);
      if (clip) return { ...clip, seconds };
      throw new GeminiError('The video model returned neither a clip nor an operation to wait on.', { status: 200 });
    }

    return { ...(await this.#await(name, { onProgress, signal })), seconds };
  }

  /** Poll an operation until it carries a clip. */
  async #await(name, { onProgress, signal }) {
    const deadline = Date.now() + this.pollTimeoutMs;
    let ticks = 0;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      ticks += 1;

      const op = await this.#request(`${this.apiBase}/${name}`, null, { signal, method: 'GET' });
      if (op?.error) {
        throw new GeminiError(op.error.message || 'The video model failed to render the clip.', { status: op.error.code || 500 });
      }
      if (op?.done) {
        const clip = firstInlineVideo(op.response) || firstInlineVideo(op);
        if (!clip) throw noClip(op.response || op);
        return clip;
      }
      onProgress({
        stage: 'rendering',
        message: `Rendering the clip… (${ticks * Math.round(this.pollIntervalMs / 1000)}s)`,
        elapsed: ticks * this.pollIntervalMs,
      });
    }
    throw new GeminiError('The clip took longer than six minutes and was given up on.', { status: 504 });
  }

  url(model) {
    return `${this.apiBase}/models/${encodeURIComponent(model)}`;
  }
}

function firstInlineVideo(res) {
  const seen = [];
  const walk = (node, depth = 0) => {
    if (!node || depth > 6 || seen.includes(node)) return null;
    if (typeof node !== 'object') return null;
    seen.push(node);

    const inline = node.inlineData || node.inline_data;
    if (inline?.data) {
      const mime = inline.mimeType || inline.mime_type || 'video/mp4';
      if (mime.startsWith('video/')) return { base64: inline.data, mimeType: mime };
    }
    // Some shapes hand back a bare base64 field beside a mime type.
    if (typeof node.bytesBase64Encoded === 'string') {
      return { base64: node.bytesBase64Encoded, mimeType: node.mimeType || 'video/mp4' };
    }
    for (const value of Object.values(node)) {
      const hit = Array.isArray(value)
        ? value.map((v) => walk(v, depth + 1)).find(Boolean)
        : walk(value, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return walk(res);
}

function noClip(res) {
  const reason = res?.promptFeedback?.blockReason || res?.candidates?.[0]?.finishReason;
  if (reason === 'SAFETY' || reason === 'VIDEO_SAFETY') {
    return new GeminiError('The clip was blocked by the model\'s safety filters.', { status: 200 });
  }
  return new GeminiError('The video model returned no clip.', { status: 200 });
}

function describe(status, body) {
  let detail = null;
  try { detail = JSON.parse(body)?.error?.message || null; } catch { detail = body ? String(body).slice(0, 300) : null; }
  if (status === 401 || status === 403) {
    return new GeminiError(detail || 'The API key was rejected. Check it in Settings → AI.', { status });
  }
  if (status === 404) {
    return new GeminiError(
      detail || 'That video model is not available to this key. Set HAZELNUT_VIDEO_MODEL to one that is.',
      { status },
    );
  }
  if (status === 429) return new GeminiError('Rate-limited. Retrying…', { status, retryable: true });
  if (status >= 500) return new GeminiError('The video model is having trouble. Retrying…', { status, retryable: true });
  return new GeminiError(detail || `The video model returned HTTP ${status}.`, { status });
}
