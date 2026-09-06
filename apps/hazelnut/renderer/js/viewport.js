// The canvas view: pan, zoom, and drawing the document to the screen.
//
// Tools never deal in screen pixels. They ask the viewport to convert a pointer
// event into document coordinates and work there, so a stroke lands in the same
// place whatever the zoom.

import { ctx2d, clamp } from './dom.js';

const MIN_SCALE = 0.02;
const MAX_SCALE = 64;

export class Viewport extends EventTarget {
  constructor(canvas, stage) {
    super();
    this.canvas = canvas;
    this.stage = stage;
    this.ctx = ctx2d(canvas);
    this.doc = null;
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.overlays = [];
    this.dpr = window.devicePixelRatio || 1;

    this.#buildCheckerboard();
    new ResizeObserver(() => this.resize()).observe(stage);
    this.resize();
  }

  setDocument(doc) {
    this.doc = doc;
    if (doc) this.fit();
    this.render();
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.viewWidth = rect.width;
    this.viewHeight = rect.height;
    this.render();
  }

  /** Zoom so the whole document is visible, with a margin. */
  fit() {
    if (!this.doc) return;
    const pad = 48;
    const scale = Math.min(
      (this.viewWidth - pad) / this.doc.width,
      (this.viewHeight - pad) / this.doc.height,
    );
    this.scale = clamp(scale, MIN_SCALE, 1);
    this.centre();
  }

  centre() {
    if (!this.doc) return;
    this.x = (this.viewWidth - this.doc.width * this.scale) / 2;
    this.y = (this.viewHeight - this.doc.height * this.scale) / 2;
    this.render();
    this.#changed();
  }

  setScale(scale, anchor) {
    const next = clamp(scale, MIN_SCALE, MAX_SCALE);
    if (next === this.scale) return;
    const point = anchor || { x: this.viewWidth / 2, y: this.viewHeight / 2 };
    // Keep whatever is under the anchor point pinned there while zooming.
    const before = this.toDoc(point);
    this.scale = next;
    const after = this.toDoc(point);
    this.x += (after.x - before.x) * this.scale;
    this.y += (after.y - before.y) * this.scale;
    this.render();
    this.#changed();
  }

  zoomBy(factor, anchor) { this.setScale(this.scale * factor, anchor); }

  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.render();
  }

  /** Screen point (relative to the stage) → document pixel. */
  toDoc(point) {
    return { x: (point.x - this.x) / this.scale, y: (point.y - this.y) / this.scale };
  }

  toScreen(point) {
    return { x: point.x * this.scale + this.x, y: point.y * this.scale + this.y };
  }

  /** Pointer event → document pixel. */
  pointer(event) {
    const rect = this.stage.getBoundingClientRect();
    return this.toDoc({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  /** Overlays are drawn on top of the document, in document coordinates. */
  addOverlay(fn) {
    this.overlays.push(fn);
    return () => { this.overlays = this.overlays.filter((f) => f !== fn); };
  }

  render() {
    const { ctx } = this;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
    if (!this.doc) return;

    const w = this.doc.width * this.scale;
    const h = this.doc.height * this.scale;

    // Transparency checkerboard, then a drop shadow, then the picture.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.checkerboard;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeRect(this.x - .5, this.y - .5, w + 1, h + 1);
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    // Above 1:1 the user is inspecting pixels; below it they want a clean
    // downscale. Smoothing only helps in one of those cases.
    ctx.imageSmoothingEnabled = this.scale < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.doc.composite(), 0, 0);
    for (const overlay of this.overlays) overlay(ctx, this);
    ctx.restore();
  }

  #changed() {
    this.dispatchEvent(new CustomEvent('change'));
  }

  #buildCheckerboard() {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 16;
    const tctx = ctx2d(tile);
    tctx.fillStyle = '#2f2f2f';
    tctx.fillRect(0, 0, 16, 16);
    tctx.fillStyle = '#3a3a3a';
    tctx.fillRect(0, 0, 8, 8);
    tctx.fillRect(8, 8, 8, 8);
    this.checkerboard = this.ctx.createPattern(tile, 'repeat');
  }
}

export { MIN_SCALE, MAX_SCALE };
