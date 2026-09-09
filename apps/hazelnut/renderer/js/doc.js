// The document: a stack of layers, all the same size, composited bottom-up.
//
// Every tool works through this object rather than touching pixels directly,
// which is what makes undo, layer visibility and Expand behave consistently
// regardless of which tool made the change.

import { makeCanvas, ctx2d } from './dom.js';

let layerSeq = 0;

export class Layer {
  constructor({ name, width, height, id = null }) {
    this.id = id || `layer-${(layerSeq += 1)}`;
    this.name = name;
    this.visible = true;
    this.opacity = 1;
    this.canvas = makeCanvas(width, height);
    this.ctx = ctx2d(this.canvas, { willReadFrequently: true });
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** A small PNG for the layers panel. */
  thumbnail(maxSize = 34) {
    const scale = Math.min(maxSize / this.canvas.width, maxSize / this.canvas.height, 1);
    const thumb = makeCanvas(this.canvas.width * scale, this.canvas.height * scale);
    const tctx = ctx2d(thumb);
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(this.canvas, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL('image/png');
  }

  /** Fraction of pixels with any alpha, and how many distinct colours are used. */
  stats() {
    const { width, height } = this.canvas;
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
    const data = this.ctx.getImageData(0, 0, width, height).data;
    const colours = new Set();
    let painted = 0;
    let sampled = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        sampled += 1;
        if (data[i + 3] > 12) {
          painted += 1;
          // Quantise to 5 bits per channel so anti-aliased edges of one stroke
          // do not read as a dozen different colours.
          colours.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
        }
      }
    }
    return {
      coveragePct: sampled ? (painted / sampled) * 100 : 0,
      colorCount: colours.size,
      megapixels: (width * height) / 1_000_000,
    };
  }
}

export class Doc extends EventTarget {
  constructor(width, height, { name = 'Untitled' } = {}) {
    super();
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.name = name;
    this.layers = [];
    this.activeId = null;
    this.composed = makeCanvas(this.width, this.height);
    this.composedCtx = ctx2d(this.composed);
    this.dirty = true;
  }

  static async fromImage(img, name = 'Image') {
    const doc = new Doc(img.naturalWidth || img.width, img.naturalHeight || img.height, { name });
    const layer = doc.addLayer('Background');
    layer.ctx.drawImage(img, 0, 0);
    doc.touch();
    return doc;
  }

  static blank(width = 1280, height = 800) {
    const doc = new Doc(width, height, { name: 'Untitled' });
    const layer = doc.addLayer('Background');
    layer.ctx.fillStyle = '#ffffff';
    layer.ctx.fillRect(0, 0, width, height);
    doc.touch();
    return doc;
  }

  get active() {
    return this.layers.find((l) => l.id === this.activeId) || this.layers.at(-1) || null;
  }

  addLayer(name = 'Layer', { above = true } = {}) {
    const layer = new Layer({ name, width: this.width, height: this.height });
    const index = above ? this.layers.length : 0;
    this.layers.splice(index, 0, layer);
    this.activeId = layer.id;
    this.touch();
    return layer;
  }

  /** Put an already-drawn image in as its own layer, on top. */
  addImageLayer(img, name = 'Layer') {
    const layer = this.addLayer(name);
    // Generated results can come back at a different size; fit them to the
    // canvas rather than cropping the user's document.
    layer.ctx.imageSmoothingQuality = 'high';
    layer.ctx.drawImage(img, 0, 0, this.width, this.height);
    this.touch();
    return layer;
  }

  duplicateLayer(id = this.activeId) {
    const source = this.layers.find((l) => l.id === id);
    if (!source) return null;
    const copy = new Layer({ name: `${source.name} copy`, width: this.width, height: this.height });
    copy.ctx.drawImage(source.canvas, 0, 0);
    copy.opacity = source.opacity;
    this.layers.splice(this.layers.indexOf(source) + 1, 0, copy);
    this.activeId = copy.id;
    this.touch();
    return copy;
  }

  removeLayer(id = this.activeId) {
    if (this.layers.length <= 1) return false;
    const index = this.layers.findIndex((l) => l.id === id);
    if (index < 0) return false;
    this.layers.splice(index, 1);
    this.activeId = (this.layers[index] || this.layers[index - 1]).id;
    this.touch();
    return true;
  }

  moveLayer(id, delta) {
    const index = this.layers.findIndex((l) => l.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= this.layers.length) return false;
    const [layer] = this.layers.splice(index, 1);
    this.layers.splice(target, 0, layer);
    this.touch();
    return true;
  }

  flatten() {
    const flat = new Layer({ name: 'Background', width: this.width, height: this.height });
    flat.ctx.drawImage(this.composite(), 0, 0);
    this.layers = [flat];
    this.activeId = flat.id;
    this.touch();
    return flat;
  }

  /** Re-composite only when something has actually changed. */
  composite() {
    if (!this.dirty) return this.composed;
    const ctx = this.composedCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const layer of this.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(layer.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    this.dirty = false;
    return this.composed;
  }

  toDataURL(type = 'image/png', quality) {
    return this.composite().toDataURL(type, quality);
  }

  touch() {
    this.dirty = true;
    this.dispatchEvent(new CustomEvent('change'));
  }

  /**
   * Expand (or crop) the canvas, placing the existing content at (ox, oy).
   * New margin is filled by mirroring the edge of each layer, which reads as a
   * continuation of the picture instead of a hard border — and costs nothing,
   * because no model is involved.
   */
  resize(newWidth, newHeight, ox, oy, { mirror = true } = {}) {
    const oldWidth = this.width;
    const oldHeight = this.height;
    const w = Math.max(1, Math.round(newWidth));
    const h = Math.max(1, Math.round(newHeight));

    for (const layer of this.layers) {
      const next = makeCanvas(w, h);
      const nctx = ctx2d(next, { willReadFrequently: true });
      nctx.drawImage(layer.canvas, ox, oy);
      if (mirror) mirrorMargins(nctx, ox, oy, oldWidth, oldHeight, w, h);
      layer.canvas = next;
      layer.ctx = nctx;
    }

    this.reframe(w, h);
  }

  /**
   * Adopt a new canvas size after the layers have been replaced wholesale —
   * what Straighten does, having rotated every one of them into a new frame.
   * The composite buffer is the document's size, so it has to be rebuilt.
   */
  reframe(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.composed = makeCanvas(this.width, this.height);
    this.composedCtx = ctx2d(this.composed);
    this.touch();
  }
}

/**
 * Mirror the content band outwards to fill the new margins: horizontally
 * first, then vertically across the full width, which fills the corners as a
 * side effect. Where a margin is wider than the content, the outermost band is
 * stretched to cover the remainder rather than tiling visibly.
 */
function mirrorMargins(ctx, ox, oy, contentW, contentH, w, h) {
  const left = ox;
  const right = w - (ox + contentW);
  const top = oy;
  const bottom = h - (oy + contentH);
  const canvas = ctx.canvas;

  if (left > 0) {
    const band = Math.min(left, contentW);
    ctx.save();
    ctx.translate(ox, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, ox, oy, band, contentH, 0, oy, band, contentH);
    ctx.restore();
    if (left > band) ctx.drawImage(canvas, ox - band, oy, 1, contentH, 0, oy, left - band, contentH);
  }

  if (right > 0) {
    const band = Math.min(right, contentW);
    ctx.save();
    ctx.translate(ox + contentW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, ox + contentW - band, oy, band, contentH, -band, oy, band, contentH);
    ctx.restore();
    const filled = ox + contentW + band;
    if (right > band) ctx.drawImage(canvas, filled - 1, oy, 1, contentH, filled, oy, right - band, contentH);
  }

  // The band now spans the full width, so the vertical pass fills the corners.
  if (top > 0) {
    const band = Math.min(top, contentH);
    ctx.save();
    ctx.translate(0, oy);
    ctx.scale(1, -1);
    ctx.drawImage(canvas, 0, oy, w, band, 0, 0, w, band);
    ctx.restore();
    if (top > band) ctx.drawImage(canvas, 0, oy - band, w, 1, 0, 0, w, top - band);
  }

  if (bottom > 0) {
    const band = Math.min(bottom, contentH);
    ctx.save();
    ctx.translate(0, oy + contentH);
    ctx.scale(1, -1);
    ctx.drawImage(canvas, 0, oy + contentH - band, w, band, 0, -band, w, band);
    ctx.restore();
    const filled = oy + contentH + band;
    if (bottom > band) ctx.drawImage(canvas, 0, filled - 1, w, 1, 0, filled, w, bottom - band);
  }
}
