// The local adjustments: Levels, Colour, Sharpen, Denoise, Vignette.
//
// All five are the same tool with a different kernel, so they share one
// factory. The shape is: take a snapshot of the active layer when the tool is
// picked, recompute the whole layer from that snapshot on every slider move,
// and only push a history entry when Apply is pressed. Switching away without
// applying puts the snapshot back, so nothing is ever half-changed.
//
// Nothing here leaves the machine and nothing is charged, on any edition.

import { el, clamp } from '../dom.js';
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

// ── the kernels ────────────────────────────────────────────────────────────

const lut = (fn) => {
  const table = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) table[i] = fn(i);
  return table;
};

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
    apply(src, out, v) {
      const black = Math.min(v.black, v.white - 1);
      const span = Math.max(1, v.white - black);
      const gamma = 100 / Math.max(1, v.gamma);
      const table = lut((i) => 255 * ((Math.min(255, Math.max(0, i - black)) / span) ** gamma));
      for (let i = 0; i < src.data.length; i += 4) {
        out.data[i] = table[src.data[i]];
        out.data[i + 1] = table[src.data[i + 1]];
        out.data[i + 2] = table[src.data[i + 2]];
      }
    },
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
    apply(src, out, v) {
      const sat = 1 + v.saturation / 100;
      for (let i = 0; i < src.data.length; i += 4) {
        let r = src.data[i] + v.warmth;
        let g = src.data[i + 1] + v.tint * 0.6;
        let b = src.data[i + 2] - v.warmth;
        // Rec. 601 luma, so a saturation move keeps the brightness it had.
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        r = luma + (r - luma) * sat;
        g = luma + (g - luma) * sat;
        b = luma + (b - luma) * sat;
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
      }
    },
  });
}

/** A separable box blur, run twice — close enough to a Gaussian, far cheaper. */
function boxBlur(src, width, height, radius) {
  const out = new Float32Array(src.length);
  const tmp = new Float32Array(src.length);
  const r = Math.max(1, Math.round(radius));

  for (let pass = 0; pass < 2; pass += 1) {
    const input = pass === 0 ? src : out;
    // Horizontal.
    for (let y = 0; y < height; y += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let x = -r; x <= r; x += 1) sum += input[(y * width + clamp(x, 0, width - 1)) * 4 + c];
        for (let x = 0; x < width; x += 1) {
          tmp[(y * width + x) * 4 + c] = sum / (r * 2 + 1);
          const add = input[(y * width + clamp(x + r + 1, 0, width - 1)) * 4 + c];
          const drop = input[(y * width + clamp(x - r, 0, width - 1)) * 4 + c];
          sum += add - drop;
        }
      }
    }
    // Vertical.
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let y = -r; y <= r; y += 1) sum += tmp[(clamp(y, 0, height - 1) * width + x) * 4 + c];
        for (let y = 0; y < height; y += 1) {
          out[(y * width + x) * 4 + c] = sum / (r * 2 + 1);
          const add = tmp[(clamp(y + r + 1, 0, height - 1) * width + x) * 4 + c];
          const drop = tmp[(clamp(y - r, 0, height - 1) * width + x) * 4 + c];
          sum += add - drop;
        }
      }
    }
  }
  return out;
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
    apply(src, out, v) {
      if (v.amount === 0) return;
      const blurred = boxBlur(src.data, src.width, src.height, v.radius);
      const amount = v.amount / 100;
      for (let i = 0; i < src.data.length; i += 4) {
        for (let c = 0; c < 3; c += 1) {
          const value = src.data[i + c];
          const detail = value - blurred[i + c];
          // Below the threshold it is noise, not detail — leave it alone.
          out.data[i + c] = Math.abs(detail) < v.threshold ? value : value + detail * amount;
        }
      }
    },
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
    apply(src, out, v) {
      if (v.strength === 0) return;
      const { width, height, data } = src;
      const mix = v.strength / 100;
      const keep = v.detail / 100;
      const window = new Uint8ClampedArray(9);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 3; c += 1) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy += 1) {
              const yy = clamp(y + dy, 0, height - 1);
              for (let dx = -1; dx <= 1; dx += 1) {
                const xx = clamp(x + dx, 0, width - 1);
                window[n] = data[(yy * width + xx) * 4 + c];
                n += 1;
              }
            }
            window.sort();
            const median = window[4];
            const value = data[i + c];
            // An edge is a big difference from the median; keeping detail means
            // trusting the original more where that difference is large.
            const edge = Math.min(1, Math.abs(value - median) / 40) * keep;
            out.data[i + c] = value + (median - value) * mix * (1 - edge);
          }
        }
      }
    },
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
    apply(src, out, v) {
      const { width, height } = src;
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.hypot(cx, cy);
      const inner = (v.feather / 100) * maxR;
      const amount = v.amount / 100;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          const d = Math.hypot(x - cx, y - cy);
          const t = Math.min(1, Math.max(0, (d - inner) / Math.max(1, maxR - inner)));
          const shade = 1 - amount * t * t;
          // One noise value per pixel, applied to all three channels: film
          // grain is monochrome, and per-channel noise reads as sensor fault.
          const n = v.grain ? (Math.random() - 0.5) * v.grain * 2 : 0;
          out.data[i] = src.data[i] * shade + n;
          out.data[i + 1] = src.data[i + 1] * shade + n;
          out.data[i + 2] = src.data[i + 2] * shade + n;
        }
      }
    },
  });
}
