import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLevels, autoLevels, applyColour, applySharpen,
  applyDenoise, applyVignette, applyMono, boxBlur,
} from '../adjustments.js';

/** A bare stand-in for ImageData, which is a browser type. */
function image(width, height, fill = (x, y) => [x, y, 128, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
  }
  return { data, width, height };
}
const blank = (src) => ({ data: new Uint8ClampedArray(src.data), width: src.width, height: src.height });
const at = (img, x, y, c = 0) => img.data[(y * img.width + x) * 4 + c];

test('levels stretch the range and leave alpha alone', () => {
  const src = image(4, 1, (x) => [x === 0 ? 40 : x === 3 ? 200 : 100 + x, 0, 0, 77]);
  const out = applyLevels(src, blank(src), { black: 40, white: 200, gamma: 1 });

  assert.equal(at(out, 0, 0), 0, 'the black point goes to black');
  assert.equal(at(out, 3, 0), 255, 'the white point goes to white');
  for (let x = 0; x < 4; x += 1) assert.equal(out.data[x * 4 + 3], 77, 'alpha is untouched');
});

test('gamma lifts the midtones without moving the ends', () => {
  const src = image(3, 1, (x) => [[0, 128, 255][x], 0, 0, 255]);
  const out = applyLevels(src, blank(src), { gamma: 1.8 });
  assert.equal(at(out, 0, 0), 0);
  assert.equal(at(out, 2, 0), 255);
  assert.ok(at(out, 1, 0) > 128, 'the midtone is lifted');
});

test('auto levels find the range a flat photograph is actually using', () => {
  // Everything between 90 and 150: a dull, low-contrast frame.
  const src = image(20, 20, (x, y) => {
    const v = 90 + Math.round(((x + y) / 38) * 60);
    return [v, v, v, 255];
  });
  const found = autoLevels(src);
  assert.ok(found.black >= 88 && found.black <= 96, `black ${found.black}`);
  assert.ok(found.white >= 143 && found.white <= 151, `white ${found.white}`);

  const out = applyLevels(src, blank(src), found);
  let min = 255;
  let max = 0;
  for (let i = 0; i < out.data.length; i += 4) {
    min = Math.min(min, out.data[i]);
    max = Math.max(max, out.data[i]);
  }
  assert.ok(max - min > 200, `the range should be opened up, got ${max - min}`);
});

test('auto levels refuse to stretch a picture that has nothing to stretch', () => {
  const flat = image(8, 8, () => [130, 130, 130, 255]);
  assert.deepEqual(autoLevels(flat), { black: 0, white: 255, gamma: 1 });
});

test('saturation holds the luma it started with', () => {
  const src = image(1, 1, () => [200, 100, 50, 255]);
  const before = 0.299 * 200 + 0.587 * 100 + 0.114 * 50;
  const out = applyColour(src, blank(src), { saturation: 60 });
  const after = 0.299 * out.data[0] + 0.587 * out.data[1] + 0.114 * out.data[2];
  assert.ok(Math.abs(after - before) < 2, `luma moved from ${before} to ${after}`);
  assert.ok(out.data[0] > 200 && out.data[2] < 50, 'the colour is pushed apart');
});

test('warmth moves red and blue in opposite directions', () => {
  const src = image(1, 1, () => [100, 100, 100, 255]);
  const warm = applyColour(src, blank(src), { warmth: 30 });
  assert.ok(warm.data[0] > 100 && warm.data[2] < 100);
});

test('sharpen leaves a flat field alone and lifts a real edge', () => {
  const flat = image(12, 12, () => [120, 120, 120, 255]);
  const sameFlat = applySharpen(flat, blank(flat), { amount: 120, radius: 2, threshold: 3 });
  for (let i = 0; i < sameFlat.data.length; i += 4) assert.equal(sameFlat.data[i], 120);

  const edge = image(12, 12, (x) => { const v = x < 6 ? 60 : 190; return [v, v, v, 255]; });
  const out = applySharpen(edge, blank(edge), { amount: 120, radius: 2, threshold: 3 });
  assert.ok(at(out, 5, 6) < at(edge, 5, 6), 'the dark side of the edge goes darker');
  assert.ok(at(out, 6, 6) > at(edge, 6, 6), 'the light side goes lighter');
});

test('denoise takes out a speck and keeps the edge', () => {
  const src = image(9, 9, (x, y) => {
    if (x === 4 && y === 4) return [255, 255, 255, 255];   // a single hot pixel
    const v = x < 5 ? 60 : 190;
    return [v, v, v, 255];
  });
  const out = applyDenoise(src, blank(src), { strength: 100, detail: 0 });
  assert.ok(at(out, 4, 4) < 120, `the speck should go, got ${at(out, 4, 4)}`);
  assert.ok(at(out, 8, 1) > 180 && at(out, 0, 1) < 80, 'the edge survives');
});

test('a vignette darkens the corners and leaves the centre', () => {
  const src = image(21, 21, () => [200, 200, 200, 255]);
  const out = applyVignette(src, blank(src), { amount: 60, feather: 30, grain: 0 });
  assert.equal(at(out, 10, 10), 200, 'the centre is untouched');
  assert.ok(at(out, 0, 0) < 140, `the corner is darkened, got ${at(out, 0, 0)}`);
});

test('grain is monochrome — the same offset on every channel', () => {
  const src = image(6, 6, () => [120, 120, 120, 255]);
  const out = applyVignette(src, blank(src), { amount: 0, grain: 30, random: () => 1 });
  for (let i = 0; i < out.data.length; i += 4) {
    assert.equal(out.data[i], out.data[i + 1]);
    assert.equal(out.data[i + 1], out.data[i + 2]);
  }
  assert.ok(out.data[0] > 120, 'the grain moved it');
});

test('mono collapses colour to the Rec. 601 luma', () => {
  const src = image(1, 1, () => [200, 100, 50, 255]);
  const out = applyMono(src, blank(src));
  const luma = Math.round(0.299 * 200 + 0.587 * 100 + 0.114 * 50);
  assert.ok(Math.abs(out.data[0] - luma) <= 1);
  assert.equal(out.data[0], out.data[1]);
  assert.equal(out.data[1], out.data[2]);
});

test('the box blur averages towards its neighbours', () => {
  const src = image(9, 9, (x, y) => (x === 4 && y === 4 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  const blurred = boxBlur(src.data, 9, 9, 1);
  assert.ok(blurred[(4 * 9 + 4) * 4] < 255, 'the spike is spread');
  assert.ok(blurred[(4 * 9 + 3) * 4] > 0, 'the neighbour picks some up');
});
