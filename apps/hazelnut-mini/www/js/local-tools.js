// The tools Mini runs on the phone itself.
//
// Nothing here calls a model, so nothing here is charged — on any edition,
// including after the trial ends. The kernels are the ones in @hazelnut/core,
// the same code Hazelnut's toolbar runs, so a photograph adjusted here and the
// same photograph adjusted on a desktop come out identical.

import {
  applyLevels, autoLevels, applyColour, applySharpen,
  applyDenoise, applyVignette, applyMono,
} from '../vendor/core/adjustments.js';

/** A photo as a canvas, at its own size. */
async function toCanvas(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
  return canvas;
}

const out = (canvas) => canvas.toDataURL('image/png');

/** Run a pixel kernel over the whole photo and hand back a new data URL. */
async function pixels(dataUrl, kernel) {
  const canvas = await toCanvas(dataUrl);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const dst = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  kernel(src, dst);
  ctx.putImageData(dst, 0, 0);
  return out(canvas);
}

export const local = {
  /**
   * Enhance: find the range the photograph is actually using, open it up, and
   * put a little colour back. One tap, because a phone is not the place for
   * three sliders.
   */
  enhance: (dataUrl) => pixels(dataUrl, (src, dst) => {
    applyLevels(src, dst, autoLevels(src));
    applyColour(dst, dst, { saturation: 12 });
  }),

  sharpen: (dataUrl, { amount = 80 } = {}) =>
    pixels(dataUrl, (src, dst) => applySharpen(src, dst, { amount, radius: 2, threshold: 3 })),

  denoise: (dataUrl, { strength = 60 } = {}) =>
    pixels(dataUrl, (src, dst) => applyDenoise(src, dst, { strength, detail: 40 })),

  vignette: (dataUrl, { amount = 45, grain = 0 } = {}) =>
    pixels(dataUrl, (src, dst) => applyVignette(src, dst, { amount, feather: 55, grain })),

  mono: (dataUrl, { warmth = 0 } = {}) => pixels(dataUrl, (src, dst) => applyMono(src, dst, { warmth })),

  /** A quarter turn, which is the one thing a phone photo always needs. */
  rotate: async (dataUrl, { turns = 1 } = {}) => {
    const source = await toCanvas(dataUrl);
    const quarter = ((turns % 4) + 4) % 4;
    if (quarter === 0) return dataUrl;
    const swap = quarter % 2 === 1;
    const canvas = document.createElement('canvas');
    canvas.width = swap ? source.height : source.width;
    canvas.height = swap ? source.width : source.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((quarter * Math.PI) / 2);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
    return out(canvas);
  },
};
