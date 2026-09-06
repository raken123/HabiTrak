// The brush shared by Draw, Magic Draw and Realtouch's masking.
//
// Strokes are stamped rather than drawn as a single path: a pre-rendered tip is
// blitted along the segment at a fixed spacing. That gives a soft edge that a
// plain `lineTo` cannot, and it keeps the stroke's opacity even instead of
// piling up where the pointer moved slowly.

import { makeCanvas, ctx2d } from '../dom.js';

export class Brush {
  constructor({ size = 24, color = '#e8622c', hardness = 0.65, opacity = 1, erase = false } = {}) {
    this.size = size;
    this.color = color;
    this.hardness = hardness;
    this.opacity = opacity;
    this.erase = erase;
    this.last = null;
    this.carry = 0;
    this.bounds = null;
    this.#buildTip();
  }

  set(props) {
    const rebuild = ['size', 'color', 'hardness'].some((k) => k in props && props[k] !== this[k]);
    Object.assign(this, props);
    if (rebuild) this.#buildTip();
  }

  #buildTip() {
    const d = Math.max(2, Math.ceil(this.size));
    const tip = makeCanvas(d, d);
    const ctx = ctx2d(tip);
    const r = d / 2;
    const inner = Math.max(0, Math.min(0.98, this.hardness));
    const gradient = ctx.createRadialGradient(r, r, r * inner, r, r, r);
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, `${toRgba(this.color, 0)}`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    this.tip = tip;
  }

  begin(point) {
    this.last = point;
    this.carry = 0;
    this.bounds = { x0: point.x, y0: point.y, x1: point.x, y1: point.y };
  }

  /** Stamp from the previous point to this one. Returns the dirty rectangle. */
  strokeTo(ctx, point) {
    if (!this.last) this.begin(point);
    const spacing = Math.max(1, this.size * 0.16);
    const dx = point.x - this.last.x;
    const dy = point.y - this.last.y;
    const distance = Math.hypot(dx, dy);

    ctx.save();
    ctx.globalCompositeOperation = this.erase ? 'destination-out' : 'source-over';
    ctx.globalAlpha = this.opacity;

    let travelled = -this.carry;
    if (distance === 0) {
      this.#stamp(ctx, point);
    } else {
      while (travelled + spacing <= distance) {
        travelled += spacing;
        const t = travelled / distance;
        this.#stamp(ctx, { x: this.last.x + dx * t, y: this.last.y + dy * t });
      }
      this.carry = distance - travelled;
    }
    ctx.restore();

    this.#grow(point);
    this.last = point;
    return this.dirtyRect();
  }

  end() {
    const rect = this.dirtyRect();
    this.last = null;
    this.carry = 0;
    this.bounds = null;
    return rect;
  }

  dirtyRect() {
    if (!this.bounds) return null;
    const pad = this.size;
    return {
      x: this.bounds.x0 - pad,
      y: this.bounds.y0 - pad,
      width: (this.bounds.x1 - this.bounds.x0) + pad * 2,
      height: (this.bounds.y1 - this.bounds.y0) + pad * 2,
    };
  }

  #stamp(ctx, point) {
    const r = this.tip.width / 2;
    ctx.drawImage(this.tip, point.x - r, point.y - r);
  }

  #grow(point) {
    if (!this.bounds) return;
    this.bounds.x0 = Math.min(this.bounds.x0, point.x);
    this.bounds.y0 = Math.min(this.bounds.y0, point.y);
    this.bounds.x1 = Math.max(this.bounds.x1, point.x);
    this.bounds.y1 = Math.max(this.bounds.y1, point.y);
  }
}

function toRgba(color, alpha) {
  const hex = String(color).replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export { toRgba };
