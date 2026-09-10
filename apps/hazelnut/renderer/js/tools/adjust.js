// The local adjustments: Levels, Colour, Sharpen, Denoise, Vignette.
//
// All five are the same tool with a different kernel, so they share one
// factory. The shape is: take a snapshot of the active layer when the tool is
// picked, recompute the whole layer from that snapshot on every slider move,
// and only push a history entry when Apply is pressed. Switching away without
// applying puts the snapshot back, so nothing is ever half-changed.
//
// Nothing here leaves the machine and nothing is charged, on any edition.

import { el } from '../dom.js';
import {
  applyLevels, applyColour, applySharpen, applyDenoise, applyVignette,
} from '../../core/adjustments.js';
import { field } from './draw.js';
import { toast } from '../ui.js';

/**
 * @param {{id:string, hint:string, fields:Array, apply:(src:ImageData, out:ImageData, v:object) => void,
 *          extras?:(app:object, redraw:Function) => Array}} spec
 */
export function createAdjustTool(spec) {
  const values = Object.fromEntries(spec.fields.map((f) => [f.key, f.value]));
  let snapshot = null;      // ImageData of the layer as it was when we started
  let layerId = null;
  let pending = null;       // rAF handle: sliders move faster than pixels
  let timer = null;
  let dirty = false;

  function take(app) {
    const layer = app.doc?.active;
    if (!layer) return;
    layerId = layer.id;
    snapshot = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    dirty = false;
  }

  function restore(app) {
    const layer = app.doc?.layers.find((l) => l.id === layerId);
    if (!layer || !snapshot) return;
    layer.ctx.putImageData(snapshot, 0, 0);
    app.doc.touch();
  }

  function redraw(app) {
    // A median filter is far too slow to run on every pointer move, so the
    // heavy kernels wait for the slider to settle instead of dropping frames.
    if (spec.slow) {
      clearTimeout(timer);
      timer = setTimeout(() => paint(app), 180);
      return;
    }
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      paint(app);
    });
  }

  function paint(app) {
    const layer = app.doc?.layers.find((l) => l.id === layerId);
    if (!layer || !snapshot) return;
    const out = new ImageData(
      new Uint8ClampedArray(snapshot.data),
      snapshot.width,
      snapshot.height,
    );
    spec.apply(snapshot, out, values);
    layer.ctx.putImageData(out, 0, 0);
    dirty = true;
    app.doc.touch();
  }

  return {
    id: spec.id,
    hint: spec.hint,

    options(app) {
      const controls = spec.fields.map((f) => {
        if (f.type === 'checkbox') {
          return el('label', { class: 'field' }, [
            el('input', {
              type: 'checkbox',
              ...(values[f.key] ? { checked: true } : {}),
              onChange: (e) => { values[f.key] = e.target.checked; redraw(app); },
            }),
            el('span', { text: f.label }),
          ]);
        }
        const output = el('output', { text: f.format ? f.format(values[f.key]) : String(values[f.key]) });
        return field(f.label, el('input', {
          type: 'range',
          min: f.min, max: f.max, step: f.step ?? 1,
          value: values[f.key],
          oninput: (e) => {
            values[f.key] = +e.target.value;
            output.value = f.format ? f.format(values[f.key]) : String(values[f.key]);
            redraw(app);
          },
        }), output);
      });

      return [
        ...controls,
        ...(spec.extras?.(app, () => redraw(app)) || []),
        el('div', { class: 'divider' }),
        el('button', {
          class: 'btn',
          text: 'Reset',
          onClick: () => {
            for (const f of spec.fields) values[f.key] = f.value;
            restore(app);
            app.refreshOptions?.();      // rebuild the bar so the sliders agree
          },
        }),
        el('button', {
          class: 'btn btn--primary',
          text: 'Apply',
          onClick: () => {
            if (!dirty) { toast(spec.name || 'Adjust', 'Nothing to apply yet.', { timeout: 2500 }); return; }
            app.history.push(spec.name || spec.id, spec.icon || 'levels');
            take(app);                    // the applied state becomes the new base
            for (const f of spec.fields) values[f.key] = f.value;
            app.refreshOptions?.();
          },
        }),
      ];
    },

    onActivate(app) { take(app); },
    onDeactivate(app) {
      clearTimeout(timer);
      if (dirty) restore(app);
      snapshot = null;
      dirty = false;
    },
    // A stroke from another tool, an undo, a new picture: the snapshot is stale.
    onDocChange(app) { if (!dirty) take(app); },
  };
}

// ── the five ───────────────────────────────────────────────────────────────
//
// The pixel work lives in @hazelnut/core so that Mini runs exactly the same
// code: a photograph adjusted on a phone and the same photograph adjusted here
// should come out identical.

export function createLevelsTool() {
  return createAdjustTool({
    id: 'levels',
    name: 'Levels',
    icon: 'levels',
    hint: 'Levels — black point, white point, gamma. Local and free.',
    fields: [
      { key: 'black', label: 'Black', min: 0, max: 120, value: 0 },
      { key: 'white', label: 'White', min: 140, max: 255, value: 255 },
      { key: 'gamma', label: 'Gamma', min: 30, max: 250, value: 100, format: (v) => (v / 100).toFixed(2) },
    ],
    apply: (src, out, v) => applyLevels(src, out, { black: v.black, white: v.white, gamma: v.gamma / 100 }),
  });
}

export function createColourTool() {
  return createAdjustTool({
    id: 'colour',
    name: 'Colour',
    icon: 'droplet',
    hint: 'Colour — warmth, tint and saturation. Local and free.',
    fields: [
      { key: 'warmth', label: 'Warmth', min: -60, max: 60, value: 0 },
      { key: 'tint', label: 'Tint', min: -60, max: 60, value: 0 },
      { key: 'saturation', label: 'Saturation', min: -100, max: 100, value: 0 },
    ],
    apply: (src, out, v) => applyColour(src, out, v),
  });
}

export function createSharpenTool() {
  return createAdjustTool({
    id: 'sharpen',
    name: 'Sharpen',
    icon: 'sharpen',
    hint: 'Sharpen — an unsharp mask. Local and free.',
    fields: [
      { key: 'amount', label: 'Amount', min: 0, max: 200, value: 60, format: (v) => `${v}%` },
      { key: 'radius', label: 'Radius', min: 1, max: 6, value: 2 },
      { key: 'threshold', label: 'Threshold', min: 0, max: 40, value: 3 },
    ],
    apply: (src, out, v) => applySharpen(src, out, v),
  });
}

export function createDenoiseTool() {
  return createAdjustTool({
    id: 'denoise',
    name: 'Denoise',
    icon: 'denoise',
    slow: true,
    hint: 'Denoise — a median filter, mixed back in. Local and free.',
    fields: [
      { key: 'strength', label: 'Strength', min: 0, max: 100, value: 55, format: (v) => `${v}%` },
      { key: 'detail', label: 'Keep detail', min: 0, max: 100, value: 40, format: (v) => `${v}%` },
    ],
    apply: (src, out, v) => applyDenoise(src, out, v),
  });
}

export function createVignetteTool() {
  return createAdjustTool({
    id: 'vignette',
    name: 'Vignette',
    icon: 'vignette',
    hint: 'Vignette — darken the corners, and add grain if you want it. Local and free.',
    fields: [
      { key: 'amount', label: 'Darken', min: -60, max: 90, value: 40, format: (v) => `${v}%` },
      { key: 'feather', label: 'Feather', min: 10, max: 100, value: 55, format: (v) => `${v}%` },
      { key: 'grain', label: 'Grain', min: 0, max: 40, value: 0 },
    ],
    apply: (src, out, v) => applyVignette(src, out, v),
  });
}
