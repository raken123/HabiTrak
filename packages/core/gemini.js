// Gemini client.
//
// Two models do all the work:
//
//   gemini-2.5-flash-image  image in / image out — Magic Draw, Realtouch, GIF
//   gemini-2.5-flash        vision + Google Search grounding — Realtouch's
//                           "what is actually behind this", AIScope's Learn
//
// The key never ships with the app. On the desktop it is read from the
// environment or a local config file (see keystore.js) and stays in the main
// process; the renderer only ever learns whether one is present. This file
// itself uses nothing but `fetch`, so Hazelnut Mini's Android build runs the
// same client in the browser.

// `process` is absent in a browser, so the environment is read defensively —
// the desktop builds override the defaults through it, the web builds do not.
const env = (name) => (typeof process !== 'undefined' ? process.env?.[name] : undefined);

export const DEFAULT_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';

export class GeminiError extends Error {
  constructor(message, { status = 0, retryable = false, cause } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.retryable = retryable;
    this.cause = cause;
  }
}

export class GeminiClient {
  constructor({
    apiKey,
    apiBase = env('HAZELNUT_API_BASE') || DEFAULT_API_BASE,
    imageModel = env('HAZELNUT_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL,
    textModel = env('HAZELNUT_TEXT_MODEL') || DEFAULT_TEXT_MODEL,
    fetchImpl = globalThis.fetch,
    maxRetries = 3,
    timeoutMs = 120_000,
  } = {}) {
    this.apiKey = apiKey;
    this.apiBase = apiBase.replace(/\/+$/, '');
    this.imageModel = imageModel;
    this.textModel = textModel;
    this.fetchImpl = fetchImpl;
    this.maxRetries = maxRetries;
    this.timeoutMs = timeoutMs;
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  async #post(model, body, { signal } = {}) {
    if (!this.apiKey) {
      throw new GeminiError('No Gemini API key configured. Add one in Settings → AI.', { status: 401 });
    }
    const url = `${this.apiBase}/models/${encodeURIComponent(model)}:generateContent`;

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const timer = AbortSignal.timeout ? AbortSignal.timeout(this.timeoutMs) : undefined;
      try {
        const res = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(body),
          signal: signal || timer,
        });

        if (res.ok) return await res.json();

        const text = await res.text().catch(() => '');
        const err = describeHttpError(res.status, text);
        if (!err.retryable || attempt === this.maxRetries) throw err;
        lastError = err;
      } catch (err) {
        if (err instanceof GeminiError && !err.retryable) throw err;
        if (attempt === this.maxRetries) {
          throw err instanceof GeminiError
            ? err
            : new GeminiError(`Could not reach Gemini: ${err.message}`, { retryable: true, cause: err });
        }
        lastError = err;
      }
      // Exponential backoff with jitter, so a burst of tool calls does not
      // retry in lockstep.
      const wait = Math.min(8000, 2 ** attempt * 700) + Math.random() * 300;
      await new Promise((r) => setTimeout(r, wait));
    }
    throw lastError;
  }

  /**
   * Image in, image out.
   *
   * @param {{prompt:string, images?:Array<{mimeType:string, base64:string}>, temperature?:number, signal?:AbortSignal}} opts
   * @returns {Promise<{base64:string, mimeType:string, text:string}>}
   */
  async generateImage({ prompt, images = [], temperature = 0.7, signal } = {}) {
    const parts = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mimeType || 'image/png', data: img.base64 } });
    }

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature, responseModalities: ['IMAGE'] },
    };

    let json;
    try {
      json = await this.#post(this.imageModel, body, { signal });
    } catch (err) {
      // Some endpoint revisions insist that TEXT accompany IMAGE. Rather than
      // guess up front, try the stricter shape and fall back once.
      if (err instanceof GeminiError && err.status === 400) {
        body.generationConfig.responseModalities = ['TEXT', 'IMAGE'];
        json = await this.#post(this.imageModel, body, { signal });
      } else {
        throw err;
      }
    }

    const image = firstInlineImage(json);
    if (!image) {
      const refusal = firstText(json) || blockReason(json);
      throw new GeminiError(
        refusal
          ? `The model returned no image. It said: ${refusal}`
          : 'The model returned no image.',
        { status: 200 },
      );
    }
    return { ...image, text: firstText(json) || '' };
  }

  /**
   * Vision and text. `search: true` turns on Google Search grounding, which is
   * what lets Realtouch look a location up instead of hallucinating it.
   *
   * @param {{prompt:string, images?:Array<{mimeType:string, base64:string}>, search?:boolean, json?:object, temperature?:number, signal?:AbortSignal}} opts
   * @returns {Promise<{text:string, data:object|null, sources:Array<{title:string, uri:string}>}>}
   */
  async analyze({ prompt, images = [], search = false, json: schema = null, temperature = 0.3, signal } = {}) {
    const parts = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mimeType || 'image/png', data: img.base64 } });
    }

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature },
    };
    if (search) {
      body.tools = [{ google_search: {} }];
    } else if (schema) {
      // Search grounding and a forced JSON mime type cannot be combined, so
      // structured output is only requested when we are not grounding.
      body.generationConfig.responseMimeType = 'application/json';
      body.generationConfig.responseSchema = schema;
    }

    const res = await this.#post(this.textModel, body, { signal });
    const text = firstText(res) || '';
    return {
      text,
      data: schema ? safeJson(text) : null,
      sources: groundingSources(res),
    };
  }
}

function describeHttpError(status, body) {
  const detail = extractApiMessage(body);
  if (status === 400) return new GeminiError(detail || 'Gemini rejected the request.', { status });
  if (status === 401 || status === 403) {
    return new GeminiError(
      detail || 'Gemini rejected the API key. Check it in Settings → AI, or generate a new one.',
      { status },
    );
  }
  if (status === 404) return new GeminiError(detail || 'That model is not available to this key.', { status });
  if (status === 429) {
    return new GeminiError('Gemini is rate-limiting this key. Retrying…', { status, retryable: true });
  }
  if (status >= 500) {
    return new GeminiError('Gemini is having trouble. Retrying…', { status, retryable: true });
  }
  return new GeminiError(detail || `Gemini returned HTTP ${status}.`, { status });
}

function extractApiMessage(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.message || null;
  } catch {
    return body ? String(body).slice(0, 300) : null;
  }
}

function candidateParts(res) {
  return res?.candidates?.[0]?.content?.parts || [];
}

function firstInlineImage(res) {
  for (const part of candidateParts(res)) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return { base64: inline.data, mimeType: inline.mimeType || inline.mime_type || 'image/png' };
    }
  }
  return null;
}

function firstText(res) {
  return candidateParts(res).map((p) => p.text).filter(Boolean).join('\n').trim() || null;
}

function blockReason(res) {
  const reason = res?.promptFeedback?.blockReason || res?.candidates?.[0]?.finishReason;
  if (!reason || reason === 'STOP') return null;
  if (reason === 'SAFETY' || reason === 'IMAGE_SAFETY') {
    return 'the request was blocked by its safety filters';
  }
  if (reason === 'PROHIBITED_CONTENT') return 'the request was refused';
  return `it stopped early (${reason})`;
}

function groundingSources(res) {
  const chunks = res?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ title: w.title || w.uri, uri: w.uri }));
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = /\{[\s\S]*\}|\[[\s\S]*\]/.exec(text || '');
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}
