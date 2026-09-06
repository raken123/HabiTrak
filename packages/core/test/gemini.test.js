import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiClient, GeminiError, DEFAULT_API_BASE, DEFAULT_IMAGE_MODEL, DEFAULT_TEXT_MODEL } from '../gemini.js';

/** A stand-in for fetch that replays a queue of canned responses. */
function fakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = queue.shift();
    if (!next) throw new Error('fakeFetch ran out of responses');
    if (next.throw) throw next.throw;
    return {
      ok: next.status ? next.status < 400 : true,
      status: next.status || 200,
      json: async () => next.json,
      text: async () => (typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {})),
    };
  };
  impl.calls = calls;
  return impl;
}

const imageReply = (data = 'QUJD') => ({
  candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data } }] } }],
});

const textReply = (text, chunks = []) => ({
  candidates: [{
    content: { parts: [{ text }] },
    groundingMetadata: chunks.length ? { groundingChunks: chunks } : undefined,
  }],
});

const client = (fetchImpl, opts = {}) =>
  new GeminiClient({ apiKey: 'test-key', fetchImpl, maxRetries: 2, ...opts });

test('the defaults are the models the product actually uses', () => {
  const c = new GeminiClient({});
  assert.equal(c.apiBase, DEFAULT_API_BASE);
  assert.equal(c.imageModel, DEFAULT_IMAGE_MODEL);
  assert.equal(c.textModel, DEFAULT_TEXT_MODEL);
  assert.equal(DEFAULT_IMAGE_MODEL, 'gemini-2.5-flash-image');
  assert.equal(c.configured, false, 'no key means not configured');
  assert.equal(new GeminiClient({ apiKey: 'k' }).configured, true);
});

test('a trailing slash on the base URL does not produce a double slash', () => {
  const c = new GeminiClient({ apiKey: 'k', apiBase: 'https://example.org/v1beta///' });
  assert.equal(c.apiBase, 'https://example.org/v1beta');
});

test('generateImage sends the prompt and the image, and returns the result', async () => {
  const fetchImpl = fakeFetch([{ json: imageReply('SEVMTE8=') }]);
  const out = await client(fetchImpl).generateImage({
    prompt: 'make it real',
    images: [{ mimeType: 'image/png', base64: 'AAAA' }],
  });

  assert.deepEqual(out, { base64: 'SEVMTE8=', mimeType: 'image/png', text: '' });

  const [call] = fetchImpl.calls;
  assert.match(call.url, /gemini-2\.5-flash-image:generateContent$/);
  assert.equal(call.init.headers['x-goog-api-key'], 'test-key');
  assert.equal(call.body.contents[0].parts[0].text, 'make it real');
  assert.deepEqual(call.body.contents[0].parts[1].inline_data, { mime_type: 'image/png', data: 'AAAA' });
  assert.deepEqual(call.body.generationConfig.responseModalities, ['IMAGE']);
});

test('a 400 is retried once with TEXT and IMAGE, for endpoints that demand both', async () => {
  const fetchImpl = fakeFetch([
    { status: 400, body: { error: { message: 'responseModalities must include TEXT' } } },
    { json: imageReply() },
  ]);
  const out = await client(fetchImpl).generateImage({ prompt: 'x' });

  assert.equal(out.base64, 'QUJD');
  assert.equal(fetchImpl.calls.length, 2);
  assert.deepEqual(fetchImpl.calls[0].body.generationConfig.responseModalities, ['IMAGE']);
  assert.deepEqual(fetchImpl.calls[1].body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
});

test('rate limiting and server errors are retried; the caller never sees them', async () => {
  const fetchImpl = fakeFetch([
    { status: 429, body: {} },
    { status: 503, body: {} },
    { json: imageReply() },
  ]);
  const out = await client(fetchImpl).generateImage({ prompt: 'x' });
  assert.equal(out.base64, 'QUJD');
  assert.equal(fetchImpl.calls.length, 3);
});

test('a bad key fails immediately, with copy that says what to do', async () => {
  const fetchImpl = fakeFetch([{ status: 403, body: { error: { message: 'API key not valid' } } }]);
  await assert.rejects(
    client(fetchImpl).generateImage({ prompt: 'x' }),
    (err) => err instanceof GeminiError && err.status === 403 && /API key not valid/.test(err.message),
  );
  assert.equal(fetchImpl.calls.length, 1, 'an auth failure must not be retried');
});

test('a missing key is caught before any request is made', async () => {
  const fetchImpl = fakeFetch([]);
  await assert.rejects(
    new GeminiClient({ fetchImpl }).generateImage({ prompt: 'x' }),
    /No Gemini API key configured/,
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('a safety block is reported as a refusal rather than an empty image', async () => {
  const fetchImpl = fakeFetch([{
    json: { candidates: [{ content: { parts: [] }, finishReason: 'IMAGE_SAFETY' }] },
  }]);
  await assert.rejects(
    client(fetchImpl).generateImage({ prompt: 'x' }),
    /safety filters/,
  );
});

test('analyze turns on search grounding and hands back the sources', async () => {
  const fetchImpl = fakeFetch([{
    json: textReply('PLACE: Trafalgar Square', [
      { web: { title: 'Trafalgar Square', uri: 'https://example.org/a' } },
      { web: { uri: 'https://example.org/b' } },
    ]),
  }]);
  const out = await client(fetchImpl).analyze({ prompt: 'where is this', search: true });

  assert.equal(out.text, 'PLACE: Trafalgar Square');
  assert.deepEqual(out.sources, [
    { title: 'Trafalgar Square', uri: 'https://example.org/a' },
    { title: 'https://example.org/b', uri: 'https://example.org/b' },
  ]);
  assert.deepEqual(fetchImpl.calls[0].body.tools, [{ google_search: {} }]);
  assert.match(fetchImpl.calls[0].url, /gemini-2\.5-flash:generateContent$/);
});

test('a JSON schema is requested only when grounding is off, and the reply is parsed', async () => {
  const schema = { type: 'object', properties: { subject: { type: 'string' } } };
  const fetchImpl = fakeFetch([{ json: textReply('{"subject":"Denim twill"}') }]);
  const out = await client(fetchImpl).analyze({ prompt: 'what is this', json: schema });

  assert.deepEqual(out.data, { subject: 'Denim twill' });
  assert.equal(fetchImpl.calls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(fetchImpl.calls[0].body.tools, undefined);
});

test('JSON wrapped in prose or a code fence is still recovered', async () => {
  const fetchImpl = fakeFetch([{ json: textReply('Here you go:\n```json\n{"subject":"Mica"}\n```') }]);
  const out = await client(fetchImpl).analyze({ prompt: 'x', json: { type: 'object' } });
  assert.deepEqual(out.data, { subject: 'Mica' });
});

test('a network failure is retried and then surfaces as a Gemini error', async () => {
  const boom = new Error('socket hang up');
  const fetchImpl = fakeFetch([{ throw: boom }, { throw: boom }, { throw: boom }]);
  await assert.rejects(
    client(fetchImpl).analyze({ prompt: 'x' }),
    (err) => err instanceof GeminiError && /Could not reach Gemini/.test(err.message),
  );
  assert.equal(fetchImpl.calls.length, 3, 'two retries after the first attempt');
});
