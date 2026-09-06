// Expand — grow the canvas. Local, instant, and free on every edition.
//
// Drag the handles or type the margins. The new area is filled by mirroring the
// edge of the picture, which reads as a continuation rather than a border, and
// costs nothing because no model is involved.

import { el, clamp } from '../dom.js';
import { field } from './draw.js';
import { toast } from '../ui.js';

const HANDLE = 7; // screen pixels

export function createExpandTool() {
  let margins = { left: 0, right: 0, top: 0, bottom: 0 };
  let removeOverlay = null;
  let dragging = null;
  let inputs = {};

  const sync = (app) => {
    for (const [side, input] of Object.entries(inputs)) {
      if (input && document.activeElement !== input) input.value = Math.round(margins[side]);
    }
    const label = document.getElementById('expand-result');
    if (label && app.doc) {
      label.textContent = `${Math.round(app.doc.width + margins.left + margins.right)} × ${Math.round(app.doc.height + margins.top + margins.bottom)}`;
    }
    app.render();
  };

  const marginInput = (side, app) => {
    const input = el('input', {
      type: 'number', min: 0, max: 8192, step: 8, value: 0,
      oninput: (e) => { margins[side] = Math.max(0, +e.target.value || 0); sync(app); },
    });
    inputs[side] = input;
    return input;
  };

  return {
    id: 'expand',
    hint: 'Expand — drag a handle or type a margin, then Apply. Never costs a credit.',

    options(app) {
      inputs = {};
      return [
        field('Left', marginInput('left', app)),
        field('Right', marginInput('right', app)),
        field('Top', marginInput('top', app)),
        field('Bottom', marginInput('bottom', app)),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn', onClick: () => { setAll(app, 0.25); }, text: '+25%' }),
        el('button', { class: 'btn', onClick: () => toRatio(app, 16 / 9), text: '16:9' }),
        el('button', { class: 'btn', onClick: () => toRatio(app, 1), text: 'Square' }),
        el('div', { class: 'divider' }),
        el('span', { class: 'field' }, [
          el('label', { text: 'New size' }),
          el('output', { id: 'expand-result', text: '—' }),
        ]),
        el('button', { class: 'btn', onClick: () => { margins = { left: 0, right: 0, top: 0, bottom: 0 }; sync(app); }, text: 'Reset' }),
        el('button', { class: 'btn btn--primary', onClick: () => apply(app) }, ['Apply', el('span', { class: 'cost', text: 'free' })]),
      ];
    },

    onActivate(app) {
      margins = { left: 0, right: 0, top: 0, bottom: 0 };
      removeOverlay = app.viewport.addOverlay((ctx, viewport) => drawOverlay(ctx, viewport, app));
      sync(app);
    },

    onDeactivate() {
      removeOverlay?.();
      removeOverlay = null;
    },

    onPointerDown(app, event, point) {
      const grip = hitHandle(app, point);
      if (!grip) return;
      dragging = { grip, start: point, from: { ...margins } };
    },

    onPointerMove(app, event, point) {
      if (!dragging) return;
      const dx = point.x - dragging.start.x;
      const dy = point.y - dragging.start.y;
      const { grip, from } = dragging;
      if (grip.includes('w')) margins.left = Math.max(0, from.left - dx);
      if (grip.includes('e')) margins.right = Math.max(0, from.right + dx);
      if (grip.includes('n')) margins.top = Math.max(0, from.top - dy);
      if (grip.includes('s')) margins.bottom = Math.max(0, from.bottom + dy);
      sync(app);
    },

    onPointerUp() { dragging = null; },
  };

  function setAll(app, fraction) {
    const dx = Math.round(app.doc.width * fraction / 2);
    const dy = Math.round(app.doc.height * fraction / 2);
    margins = { left: dx, right: dx, top: dy, bottom: dy };
    sync(app);
  }

  /** Grow — never crop — until the canvas reaches the requested aspect ratio. */
  function toRatio(app, ratio) {
    const { width, height } = app.doc;
    margins = { left: 0, right: 0, top: 0, bottom: 0 };
    if (width / height < ratio) {
      const extra = Math.round(height * ratio - width);
      margins.left = Math.floor(extra / 2);
      margins.right = extra - margins.left;
    } else {
      const extra = Math.round(width / ratio - height);
      margins.top = Math.floor(extra / 2);
      margins.bottom = extra - margins.top;
    }
    sync(app);
  }

  function apply(app) {
    const { left, right, top, bottom } = margins;
    if (left + right + top + bottom < 1) {
      toast('Expand', 'Set a margin first — drag a handle or type a number.', { kind: 'error' });
      return;
    }
    app.doc.resize(
      app.doc.width + left + right,
      app.doc.height + top + bottom,
      Math.round(left),
      Math.round(top),
      { mirror: true },
    );
    app.history.push('Expand canvas', 'expand');
    margins = { left: 0, right: 0, top: 0, bottom: 0 };
    app.viewport.fit();
    sync(app);
    toast('Expand', `Canvas is now ${app.doc.width} × ${app.doc.height}. No credits used.`, { kind: 'good' });
  }

  function handlePositions(app) {
    const x0 = -margins.left;
    const y0 = -margins.top;
    const x1 = app.doc.width + margins.right;
    const y1 = app.doc.height + margins.bottom;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    return {
      nw: { x: x0, y: y0 }, n: { x: mx, y: y0 }, ne: { x: x1, y: y0 },
      w: { x: x0, y: my }, e: { x: x1, y: my },
      sw: { x: x0, y: y1 }, s: { x: mx, y: y1 }, se: { x: x1, y: y1 },
    };
  }

  function hitHandle(app, point) {
    const tolerance = HANDLE / app.viewport.scale + 3;
    for (const [name, pos] of Object.entries(handlePositions(app))) {
      if (Math.abs(point.x - pos.x) <= tolerance && Math.abs(point.y - pos.y) <= tolerance) return name;
    }
    return null;
  }

  function drawOverlay(ctx, viewport, app) {
    const x0 = -margins.left;
    const y0 = -margins.top;
    const w = app.doc.width + margins.left + margins.right;
    const h = app.doc.height + margins.top + margins.bottom;
    const px = 1 / viewport.scale;

    ctx.save();
    ctx.setLineDash([6 * px, 4 * px]);
    ctx.lineWidth = 1.5 * px;
    ctx.strokeStyle = '#e0894a';
    ctx.strokeRect(x0, y0, w, h);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(224,137,74,.14)';
    // The four new margins, so the added area is obvious before it is applied.
    if (margins.top) ctx.fillRect(x0, y0, w, margins.top);
    if (margins.bottom) ctx.fillRect(x0, app.doc.height, w, margins.bottom);
    if (margins.left) ctx.fillRect(x0, 0, margins.left, app.doc.height);
    if (margins.right) ctx.fillRect(app.doc.width, 0, margins.right, app.doc.height);

    const size = HANDLE * px;
    ctx.fillStyle = '#e0894a';
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = px;
    for (const pos of Object.values(handlePositions(app))) {
      ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
      ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
    }
    ctx.restore();
  }
}

export { clamp };
