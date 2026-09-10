// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// The local adjustments, as pure functions.
//
// These are the kernels behind Hazelnut's Levels, Colour, Sharpen, Denoise and
// Vignette, and behind the same tools in Mini. They live here rather than in
// either app because a photograph adjusted on a phone and the same photograph
// adjusted on a desktop should come out identical — one implementation, two
// front ends.
//
// Every function takes and fills a plain {data, width, height} — an ImageData
// in a browser, a bare object anywhere else — and touches only RGB, leaving
// alpha exactly as it found it. Nothing here calls a model or a network.

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);

/** A 256-entry lookup table, built once per call rather than per pixel. */
function lut(fn) {
  const table = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) table[i] = fn(i);
  return table;
}

/**
 * Black point, white point and gamma.
 * @param {{black?:number, white?:number, gamma?:number}} opts gamma is a
 *   multiplier: 1 leaves the picture alone, above 1 lifts the midtones.
 */
export function applyLevels(src, out, { black = 0, white = 255, gamma = 1 } = {}) {
  const lo = Math.min(black, white - 1);
  const span = Math.max(1, white - lo);
  const power = 1 / Math.max(0.01, gamma);
  const table = lut((i) => 255 * ((clamp(i - lo, 0, 255) / span) ** power));
  for (let i = 0; i < src.data.length; i += 4) {
    out.data[i] = table[src.data[i]];
    out.data[i + 1] = table[src.data[i + 1]];
    out.data[i + 2] = table[src.data[i + 2]];
  }
  return out;
}

/**
 * Where the picture's tones actually start and stop, ignoring the extreme
 * `clip` fraction at each end so a single blown highlight cannot decide it.
 */
export function autoLevels(src, { clip = 0.004 } = {}) {
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < src.data.length; i += 4) {
    // Rec. 601 luma: the eye's weighting, not a flat average.
    const luma = (src.data[i] * 299 + src.data[i + 1] * 587 + src.data[i + 2] * 114) / 1000;
    histogram[Math.round(luma)] += 1;
    count += 1;
  }
  const cut = Math.max(1, Math.round(count * clip));

  let black = 0;
  for (let seen = 0, i = 0; i < 256; i += 1) {
    seen += histogram[i];
    if (seen >= cut) { black = i; break; }
  }
  let white = 255;
  for (let seen = 0, i = 255; i >= 0; i -= 1) {
    seen += histogram[i];
    if (seen >= cut) { white = i; break; }
  }
  if (white - black < 8) return { black: 0, white: 255, gamma: 1 };

  // Aim the midpoint of what is actually there at mid grey, gently.
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += histogram[i] * i;
  const mean = clamp((sum / count - black) / (white - black), 0.05, 0.95);
  const gamma = clamp(Math.log(0.5) / Math.log(mean), 0.6, 1.6);
  return { black, white, gamma };
}

/** Warmth, tint and saturation, with the luma held. */
export function applyColour(src, out, { warmth = 0, tint = 0, saturation = 0 } = {}) {
  const sat = 1 + saturation / 100;
  for (let i = 0; i < src.data.length; i += 4) {
    let r = src.data[i] + warmth;
    let g = src.data[i + 1] + tint * 0.6;
    let b = src.data[i + 2] - warmth;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * sat;
    g = luma + (g - luma) * sat;
    b = luma + (b - luma) * sat;
    out.data[i] = clamp(r, 0, 255);
    out.data[i + 1] = clamp(g, 0, 255);
    out.data[i + 2] = clamp(b, 0, 255);
  }
  return out;
}

/** A separable box blur, run twice — close enough to a Gaussian, far cheaper. */
export function boxBlur(data, width, height, radius) {
  const out = new Float32Array(data.length);
  const tmp = new Float32Array(data.length);
  const r = Math.max(1, Math.round(radius));
  const span = r * 2 + 1;

  for (let pass = 0; pass < 2; pass += 1) {
    const input = pass === 0 ? data : out;
    for (let y = 0; y < height; y += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let x = -r; x <= r; x += 1) sum += input[(y * width + clamp(x, 0, width - 1)) * 4 + c];
        for (let x = 0; x < width; x += 1) {
          tmp[(y * width + x) * 4 + c] = sum / span;
          sum += input[(y * width + clamp(x + r + 1, 0, width - 1)) * 4 + c]
            - input[(y * width + clamp(x - r, 0, width - 1)) * 4 + c];
        }
      }
    }
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let y = -r; y <= r; y += 1) sum += tmp[(clamp(y, 0, height - 1) * width + x) * 4 + c];
        for (let y = 0; y < height; y += 1) {
          out[(y * width + x) * 4 + c] = sum / span;
          sum += tmp[(clamp(y + r + 1, 0, height - 1) * width + x) * 4 + c]
            - tmp[(clamp(y - r, 0, height - 1) * width + x) * 4 + c];
        }
      }
    }
  }
  return out;
}

/** Unsharp masking: the picture, minus a blurred copy, added back. */
export function applySharpen(src, out, { amount = 60, radius = 2, threshold = 3 } = {}) {
  if (amount === 0) return out;
  const blurred = boxBlur(src.data, src.width, src.height, radius);
  const strength = amount / 100;
  for (let i = 0; i < src.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const value = src.data[i + c];
      const detail = value - blurred[i + c];
      // Below the threshold it is noise, not detail — leave it alone.
      out.data[i + c] = Math.abs(detail) < threshold ? value : clamp(value + detail * strength, 0, 255);
    }
  }
  return out;
}

/** A 3×3 median, mixed back in — and trusted less wherever there is an edge. */
export function applyDenoise(src, out, { strength = 55, detail = 40 } = {}) {
  if (strength === 0) return out;
  const { width, height, data } = src;
  const mix = strength / 100;
  const keep = detail / 100;
  const window = new Uint8ClampedArray(9);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = clamp(y + dy, 0, height - 1);
          for (let dx = -1; dx <= 1; dx += 1) {
            window[n] = data[(yy * width + clamp(x + dx, 0, width - 1)) * 4 + c];
            n += 1;
          }
        }
        window.sort();
        const median = window[4];
        const value = data[i + c];
        const edge = Math.min(1, Math.abs(value - median) / 40) * keep;
        out.data[i + c] = value + (median - value) * mix * (1 - edge);
      }
    }
  }
  return out;
}

/**
 * Radial darkening, and optional grain.
 * `random` is injectable so a test can be deterministic.
 */
export function applyVignette(src, out, { amount = 40, feather = 55, grain = 0, random = Math.random } = {}) {
  const { width, height } = src;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  const inner = (feather / 100) * maxR;
  const strength = amount / 100;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const d = Math.hypot(x - cx, y - cy);
      const t = clamp((d - inner) / Math.max(1, maxR - inner), 0, 1);
      const shade = 1 - strength * t * t;
      // One noise value per pixel, applied to all three channels: film grain is
      // monochrome, and per-channel noise reads as a sensor fault.
      const n = grain ? (random() - 0.5) * grain * 2 : 0;
      out.data[i] = clamp(src.data[i] * shade + n, 0, 255);
      out.data[i + 1] = clamp(src.data[i + 1] * shade + n, 0, 255);
      out.data[i + 2] = clamp(src.data[i + 2] * shade + n, 0, 255);
    }
  }
  return out;
}

/** Rec. 601 monochrome — the same weighting the rest of this file uses. */
export function applyMono(src, out, { warmth = 0 } = {}) {
  for (let i = 0; i < src.data.length; i += 4) {
    const luma = 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2];
    out.data[i] = clamp(luma + warmth, 0, 255);
    out.data[i + 1] = clamp(luma, 0, 255);
    out.data[i + 2] = clamp(luma - warmth, 0, 255);
  }
  return out;
}
