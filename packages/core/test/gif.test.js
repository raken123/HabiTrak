import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeGif, framePlan, lzwEncode } from '../gif.js';
import { lzwDecode, parseGif } from './lzw-decoder.js';

function gradientFrame(width, height, shift = 0) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = (x * 4 + shift) & 0xff;
      data[i + 1] = (y * 4) & 0xff;
      data[i + 2] = ((x + y) * 2) & 0xff;
      data[i + 3] = 255;
    }
  }
  return { data };
}

test('LZW round-trips a short run', () => {
  const indices = Uint8Array.from([1, 1, 1, 2, 2, 1, 1, 1, 1, 3, 0, 0]);
  const encoded = lzwEncode(indices, 2);
  assert.deepEqual(lzwDecode(encoded, 2), Array.from(indices));
});

test('LZW round-trips across every code-size boundary and the 4096 reset', () => {
  // Pseudo-random but deterministic, and long enough to fill the dictionary
  // twice over, which is where a mis-timed code-size bump shows up.
  let seed = 12345;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const indices = new Uint8Array(120_000);
  for (let i = 0; i < indices.length; i += 1) {
    indices[i] = Math.floor(rand() * 256);
  }
  const encoded = lzwEncode(indices, 8);
  assert.deepEqual(lzwDecode(encoded, 8), Array.from(indices));
});

test('LZW round-trips highly repetitive data (long dictionary runs)', () => {
  const indices = new Uint8Array(50_000);
  for (let i = 0; i < indices.length; i += 1) indices[i] = (i / 700) & 0x0f;
  const encoded = lzwEncode(indices, 8);
  assert.deepEqual(lzwDecode(encoded, 8), Array.from(indices));
  // Repetitive input must actually compress, otherwise the dictionary is not
  // being used at all.
  assert.ok(encoded.length < indices.length / 4, `expected compression, got ${encoded.length} bytes`);
});

test('encodeGif writes a well-formed animated file', () => {
  const width = 48;
  const height = 32;
  const frames = [gradientFrame(width, height, 0), gradientFrame(width, height, 40), gradientFrame(width, height, 80)];
  const bytes = encodeGif(frames, { width, height, delayMs: 125, dither: false });

  assert.equal(String.fromCharCode(...bytes.subarray(0, 6)), 'GIF89a');
  assert.equal(bytes[bytes.length - 1], 0x3b, 'file must end with the trailer');

  const gif = parseGif(bytes);
  assert.equal(gif.width, width);
  assert.equal(gif.height, height);
  assert.equal(gif.frames.length, 3);
  assert.equal(gif.loops, 0, 'animations should loop forever');
  for (const frame of gif.frames) {
    assert.equal(frame.width, width);
    assert.equal(frame.height, height);
    assert.equal(frame.delayMs, 130, 'delay rounds to whole centiseconds');
    assert.equal(frame.indices.length, width * height, 'every pixel must decode');
  }
});

test('encoded pixels land close to the originals', () => {
  const width = 40;
  const height = 40;
  const source = gradientFrame(width, height, 0);
  const bytes = encodeGif([source], { width, height, dither: false });
  const gif = parseGif(bytes);

  let worst = 0;
  for (let p = 0; p < width * height; p += 1) {
    const [r, g, b] = gif.palette[gif.frames[0].indices[p]];
    const i = p * 4;
    worst = Math.max(worst, Math.abs(r - source.data[i]), Math.abs(g - source.data[i + 1]), Math.abs(b - source.data[i + 2]));
  }
  assert.ok(worst <= 24, `worst channel error was ${worst}`);
});

test('a single frame is written without the loop extension', () => {
  const bytes = encodeGif([gradientFrame(16, 16)], { width: 16, height: 16 });
  const gif = parseGif(bytes);
  assert.equal(gif.frames.length, 1);
  assert.equal(gif.loops, null);
});

test('dithering still decodes to the right pixel count', () => {
  const bytes = encodeGif([gradientFrame(24, 24)], { width: 24, height: 24, dither: true });
  const gif = parseGif(bytes);
  assert.equal(gif.frames[0].indices.length, 24 * 24);
});

test('framePlan caps GIF Animate at five seconds', () => {
  assert.deepEqual(framePlan(5, 8), { count: 40, delayMs: 125, seconds: 5, fps: 8 });
  assert.equal(framePlan(30, 8).seconds, 5, 'never longer than five seconds');
  assert.equal(framePlan(0.1, 8).count >= 2, true);
  assert.equal(framePlan(5, 60).fps, 12, 'frame rate is clamped');
});

test('encodeGif refuses an empty frame list', () => {
  assert.throws(() => encodeGif([], { width: 8, height: 8 }), /at least one frame/);
});
