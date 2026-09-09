// Text — click where the line should start and type.
//
// The line is previewed as a viewport overlay so it can be moved and restyled
// freely; Apply draws it onto the active layer for good. Local and free.

import { el } from '../dom.js';
import { field } from './draw.js';
import { toast } from '../ui.js';

const FAMILIES = [
  ['ui', 'System'],
  ['charter', 'Charter'],
  ['mono', 'Monospace'],
];

const fontFor = (family, size, weight) => {
  const stack = family === 'charter' ? '"Bitstream Charter", Charter, Georgia, serif'
    : family === 'mono' ? 'ui-monospace, "DejaVu Sans Mono", monospace'
    : 'system-ui, "Liberation Sans", Arial, sans-serif';
  return `${weight} ${size}px ${stack}`;
};

export function createTextTool() {
  let content = '';
  let size = 64;
  let weight = 600;
  let family = 'charter';
  let colour = null;          // null = follow the current swatch
  let at = null;              // { x, y } in document pixels
  let removeOverlay = null;
  let active = false;
  let dragging = false;

  const ink = (app) => colour || app.state.color;

  function draw(ctx, app) {
    if (!at || !content) return;
    ctx.save();
    ctx.font = fontFor(family, size, weight);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink(app);
    for (const [i, line] of content.split('\n').entries()) {
      ctx.fillText(line, at.x, at.y + i * size * 1.18);
    }
    ctx.restore();
  }

  function apply(app) {
    if (!at || !content.trim()) {
      toast('Text', 'Click the picture, then type something.', { timeout: 2600 });
      return;
    }
    draw(app.doc.active.ctx, app);
    app.doc.touch();
    app.history.push('Text', 'text');
    content = '';
    app.refreshOptions?.();
    app.render();
  }

  return {
    id: 'text',
    hint: 'Text — click the picture, type, then Apply. Local and free.',

    options(app) {
      return [
        el('div', { class: 'field' }, [
          el('label', { text: 'Words' }),
          el('input', {
            type: 'text', class: 'grow', placeholder: 'the words to put on the picture',
            value: content,
            oninput: (e) => { content = e.target.value; app.render(); },
          }),
        ]),
        field('Size', el('input', {
          type: 'range', min: 8, max: 400, value: size,
          oninput: (e) => { size = +e.target.value; app.render(); },
        })),
        el('div', { class: 'field' }, [
          el('label', { text: 'Face' }),
          el('select', {
            onChange: (e) => { family = e.target.value; app.render(); },
          }, FAMILIES.map(([value, label]) => el('option', {
            value, text: label, ...(family === value ? { selected: true } : {}),
          }))),
        ]),
        el('div', { class: 'field' }, [
          el('label', { text: 'Weight' }),
          el('select', {
            onChange: (e) => { weight = +e.target.value; app.render(); },
          }, [[400, 'Regular'], [600, 'Semibold'], [800, 'Bold']].map(([value, label]) => el('option', {
            value, text: label, ...(weight === value ? { selected: true } : {}),
          }))),
        ]),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn btn--primary', text: 'Apply', onClick: () => apply(app) }),
      ];
    },

    onActivate(app) {
      active = true;
      if (!at && app.doc) at = { x: app.doc.width * 0.1, y: app.doc.height * 0.85 };
      removeOverlay = app.viewport.addOverlay((ctx, viewport) => {
        if (!active || !at) return;
        const px = 1 / viewport.scale;
        draw(ctx, app);
        // The insertion point, so an empty line still shows where it will go.
        ctx.save();
        ctx.strokeStyle = 'rgba(224,137,74,.9)';
        ctx.lineWidth = 1.4 * px;
        ctx.beginPath();
        ctx.moveTo(at.x, at.y + size * 0.22);
        ctx.lineTo(at.x, at.y - size * 0.78);
        ctx.stroke();
        ctx.restore();
      });
      app.render();
    },

    onDeactivate(app) {
      active = false;
      removeOverlay?.();
      removeOverlay = null;
      app.render();
    },

    onPointerDown(app, event, point) {
      if (event.button !== 0) return;
      dragging = true;
      at = { x: point.x, y: point.y };
      app.render();
    },
    onPointerMove(app, event, point) {
      if (!dragging) return;
      at = { x: point.x, y: point.y };
      app.render();
    },
    onPointerUp() { dragging = false; },
  };
}
