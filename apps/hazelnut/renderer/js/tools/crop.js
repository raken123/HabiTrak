// Crop — drag a box, or type the numbers. Local, instant, free.
//
// The box is drawn as a viewport overlay in document coordinates, so it stays
// where it was put while the picture is panned or zoomed. Applying it is one
// call to doc.resize() with a negative offset and no mirroring: the same code
// path Expand uses, pointed the other way.

import { el, clamp } from '../dom.js';
import { toast } from '../ui.js';

const HANDLE = 8;   // screen pixels

export function createCropTool() {
  let box = null;                  // { x, y, w, h } in document pixels
  let removeOverlay = null;
  let drag = null;
  let active = false;
  let inputs = {};

  const reset = (app) => {
    if (!app.doc) return;
    const inset = Math.round(Math.min(app.doc.width, app.doc.height) * 0.08);
    box = {
      x: inset, y: inset,
      w: app.doc.width - inset * 2,
      h: app.doc.height - inset * 2,
    };
  };

  function sync(app) {
    for (const [key, input] of Object.entries(inputs)) {
      if (input && document.activeElement !== input) input.value = Math.round(box[key]);
    }
    const label = document.getElementById('crop-result');
    if (label) label.textContent = `${Math.round(box.w)} × ${Math.round(box.h)}`;
    app.render();
  }

  /** Which handle, if any, is under a document-space point. */
  function hitTest(point, scale) {
    const grab = HANDLE / scale;
    const near = (a, b) => Math.abs(a - b) <= grab;
    const inX = point.x > box.x - grab && point.x < box.x + box.w + grab;
    const inY = point.y > box.y - grab && point.y < box.y + box.h + grab;
    const left = near(point.x, box.x) && inY;
    const right = near(point.x, box.x + box.w) && inY;
    const top = near(point.y, box.y) && inX;
    const bottom = near(point.y, box.y + box.h) && inX;
    if (left || right || top || bottom) return { left, right, top, bottom };
    if (inX && inY && point.x > box.x && point.x < box.x + box.w
      && point.y > box.y && point.y < box.y + box.h) return { move: true };
    return null;
  }

  function numberInput(key, app) {
    const input = el('input', {
      type: 'number', min: 0, max: 20000, step: 1, value: 0,
      oninput: (e) => {
        box[key] = Math.max(key === 'w' || key === 'h' ? 1 : 0, +e.target.value || 0);
        clampBox(app);
        sync(app);
      },
    });
    inputs[key] = input;
    return input;
  }

  function clampBox(app) {
    if (!app.doc) return;
    box.w = clamp(box.w, 1, app.doc.width);
    box.h = clamp(box.h, 1, app.doc.height);
    box.x = clamp(box.x, 0, app.doc.width - box.w);
    box.y = clamp(box.y, 0, app.doc.height - box.h);
  }

  function apply(app) {
    if (!app.doc || !box) return;
    clampBox(app);
    const { x, y, w, h } = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) };
    if (w === app.doc.width && h === app.doc.height) {
      toast('Crop', 'The box is the whole picture — nothing to trim.', { timeout: 2600 });
      return;
    }
    // Negative offsets move the picture up and left as the canvas shrinks; no
    // mirroring, because a crop has no new margin to fill.
    app.doc.resize(w, h, -x, -y, { mirror: false });
    app.history.push('Crop', 'crop');
    reset(app);
    app.viewport.fit();
    sync(app);
    toast('Crop', `${w} × ${h}`, { kind: 'good', timeout: 2600 });
  }

  return {
    id: 'crop',
    hint: 'Crop — drag the box, then Apply. Local and free.',

    options(app) {
      inputs = {};
      if (!box) reset(app);
      clampBox(app);
      return [
        el('div', { class: 'field' }, [el('label', { text: 'X' }), numberInput('x', app)]),
        el('div', { class: 'field' }, [el('label', { text: 'Y' }), numberInput('y', app)]),
        el('div', { class: 'field' }, [el('label', { text: 'Width' }), numberInput('w', app)]),
        el('div', { class: 'field' }, [el('label', { text: 'Height' }), numberInput('h', app)]),
        el('span', { class: 'field', id: 'crop-result', text: '' }),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn', text: 'Whole picture', onClick: () => { box = { x: 0, y: 0, w: app.doc.width, h: app.doc.height }; sync(app); } }),
        el('button', { class: 'btn btn--primary', text: 'Apply', onClick: () => apply(app) }),
      ];
    },

    onActivate(app) {
      active = true;
      if (!box) reset(app);
      clampBox(app);
      removeOverlay = app.viewport.addOverlay((ctx, viewport) => {
        if (!active || !box) return;
        const px = 1 / viewport.scale;
        ctx.save();
        // Everything outside the box goes dark, so the crop reads at a glance.
        ctx.fillStyle = 'rgba(12,11,10,.6)';
        ctx.beginPath();
        ctx.rect(0, 0, app.doc.width, app.doc.height);
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.fill('evenodd');

        ctx.strokeStyle = '#e0894a';
        ctx.lineWidth = 1.6 * px;
        ctx.strokeRect(box.x, box.y, box.w, box.h);

        // Thirds, which is what people actually crop to.
        ctx.strokeStyle = 'rgba(246,241,234,.35)';
        ctx.lineWidth = 1 * px;
        for (let i = 1; i < 3; i += 1) {
          ctx.beginPath();
          ctx.moveTo(box.x + (box.w * i) / 3, box.y);
          ctx.lineTo(box.x + (box.w * i) / 3, box.y + box.h);
          ctx.moveTo(box.x, box.y + (box.h * i) / 3);
          ctx.lineTo(box.x + box.w, box.y + (box.h * i) / 3);
          ctx.stroke();
        }

        ctx.fillStyle = '#e0894a';
        const s = HANDLE * px;
        for (const [hx, hy] of [
          [box.x, box.y], [box.x + box.w, box.y],
          [box.x, box.y + box.h], [box.x + box.w, box.y + box.h],
        ]) ctx.fillRect(hx - s / 2, hy - s / 2, s, s);
        ctx.restore();
      });
      sync(app);
    },

    onDeactivate(app) {
      active = false;
      removeOverlay?.();
      removeOverlay = null;
      app.render();
    },

    onDocChange(app) { clampBox(app); },

    onPointerDown(app, event, point) {
      if (event.button !== 0 || !box) return;
      const hit = hitTest(point, app.viewport.scale);
      drag = hit
        ? { hit, start: point, box: { ...box } }
        // A drag on empty canvas starts a new box from that corner.
        : { hit: { right: true, bottom: true }, start: point, box: { x: point.x, y: point.y, w: 1, h: 1 }, fresh: true };
      if (drag.fresh) box = { ...drag.box };
    },

    onPointerMove(app, event, point) {
      if (!drag) return;
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      const b = drag.box;
      if (drag.hit.move) {
        box.x = b.x + dx;
        box.y = b.y + dy;
      } else {
        if (drag.hit.left) { box.x = b.x + dx; box.w = b.w - dx; }
        if (drag.hit.right) box.w = b.w + dx;
        if (drag.hit.top) { box.y = b.y + dy; box.h = b.h - dy; }
        if (drag.hit.bottom) box.h = b.h + dy;
        if (box.w < 1) box.w = 1;
        if (box.h < 1) box.h = 1;
      }
      clampBox(app);
      sync(app);
    },

    onPointerUp() { drag = null; },
  };
}
