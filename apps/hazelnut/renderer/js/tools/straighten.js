// Straighten — rotate the picture a fraction of a degree at a time.
//
// A rotation exposes corners, so this crops back to the largest rectangle of
// the original aspect that still fits inside the rotated frame. That is the
// whole trick: rotate every layer about the centre, then trim.
//
// Local, instant, and free on every edition.

import { el, makeCanvas, ctx2d } from '../dom.js';
import { field } from './draw.js';
import { toast } from '../ui.js';

/**
 * The largest w×h rectangle of the same aspect ratio that fits inside a
 * width×height rectangle rotated by `angle`. The standard result — the two
 * limiting sides of the rotated frame — rather than a guess with a margin.
 */
export function insideCrop(width, height, angle) {
  const a = Math.abs((angle * Math.PI) / 180) % Math.PI;
  const sin = Math.abs(Math.sin(a));
  const cos = Math.abs(Math.cos(a));
  const longer = Math.max(width, height);
  const shorter = Math.min(width, height);

  if (shorter <= 2 * sin * cos * longer || Math.abs(sin - cos) < 1e-10) {
    const x = 0.5 * shorter;
    const [w, h] = width >= height ? [x / sin, x / cos] : [x / cos, x / sin];
    return { width: w, height: h };
  }
  const cos2a = cos * cos - sin * sin;
  return {
    width: (width * cos - height * sin) / cos2a,
    height: (height * cos - width * sin) / cos2a,
  };
}

export function createStraightenTool() {
  let angle = 0;
  let removeOverlay = null;
  let active = false;

  function preview(app) {
    const label = document.getElementById('straighten-size');
    if (!label || !app.doc) return;
    const crop = insideCrop(app.doc.width, app.doc.height, angle);
    label.textContent = angle
      ? `${Math.round(crop.width)} × ${Math.round(crop.height)} after trim`
      : `${app.doc.width} × ${app.doc.height}`;
    app.render();
  }

  function apply(app) {
    if (!app.doc || !angle) {
      toast('Straighten', 'Set an angle first.', { timeout: 2400 });
      return;
    }
    const { width, height } = app.doc;
    const crop = insideCrop(width, height, angle);
    const outW = Math.max(1, Math.floor(crop.width));
    const outH = Math.max(1, Math.floor(crop.height));
    const radians = (angle * Math.PI) / 180;

    for (const layer of app.doc.layers) {
      const next = makeCanvas(outW, outH);
      const ctx = ctx2d(next, { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(radians);
      ctx.drawImage(layer.canvas, -width / 2, -height / 2);
      layer.canvas = next;
      layer.ctx = ctx;
    }
    app.doc.reframe(outW, outH);
    app.history.push('Straighten', 'straighten');
    angle = 0;
    app.viewport.setDocument(app.doc);
    app.refreshOptions?.();
    toast('Straighten', `${outW} × ${outH}`, { kind: 'good', timeout: 2600 });
  }

  return {
    id: 'straighten',
    hint: 'Straighten — drag the angle until the horizon is level, then Apply.',

    options(app) {
      const output = el('output', { text: '0.0°' });
      return [
        field('Angle', el('input', {
          type: 'range', min: -1500, max: 1500, step: 5, value: angle * 100,
          oninput: (e) => {
            angle = +e.target.value / 100;
            output.value = `${angle.toFixed(1)}°`;
            preview(app);
          },
        }), output),
        el('button', { class: 'btn', text: 'Level', onClick: () => { angle = 0; app.refreshOptions?.(); } }),
        el('span', { class: 'field', id: 'straighten-size', text: '' }),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn btn--primary', text: 'Apply', onClick: () => apply(app) }),
      ];
    },

    onActivate(app) {
      active = true;
      removeOverlay = app.viewport.addOverlay((ctx, viewport) => {
        if (!active || !app.doc) return;
        const px = 1 / viewport.scale;
        const { width, height } = app.doc;
        ctx.save();
        // A grid at the chosen angle: the thing you actually line up against.
        ctx.translate(width / 2, height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.strokeStyle = 'rgba(224,137,74,.55)';
        ctx.lineWidth = 1 * px;
        const reach = Math.hypot(width, height);
        for (let i = -6; i <= 6; i += 1) {
          const y = (i * height) / 12;
          ctx.beginPath();
          ctx.moveTo(-reach, y);
          ctx.lineTo(reach, y);
          ctx.stroke();
        }
        ctx.restore();

        if (angle) {
          const crop = insideCrop(width, height, angle);
          ctx.save();
          ctx.strokeStyle = '#f6f1ea';
          ctx.setLineDash([6 * px, 5 * px]);
          ctx.lineWidth = 1.6 * px;
          ctx.strokeRect(
            (width - crop.width) / 2, (height - crop.height) / 2,
            crop.width, crop.height,
          );
          ctx.restore();
        }
      });
      preview(app);
    },

    onDeactivate(app) {
      active = false;
      removeOverlay?.();
      removeOverlay = null;
      app.render();
    },
  };
}
