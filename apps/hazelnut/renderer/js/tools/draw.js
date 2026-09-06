// Draw — a plain brush. No model, no credits, works on every edition.

import { el } from '../dom.js';
import { Brush } from './brush.js';

export function createDrawTool() {
  const brush = new Brush({ size: 24, color: '#e8622c', hardness: 0.65, opacity: 1 });
  let painting = false;

  return {
    id: 'draw',
    hint: 'Draw — paint on the active layer. [ and ] change the brush size.',
    brush,

    options(app) {
      return [
        field('Size', el('input', {
          type: 'range', min: 1, max: 400, value: brush.size,
          oninput: (e) => { brush.set({ size: +e.target.value }); app.setBrushSize(+e.target.value); },
          id: 'brush-size',
        }), el('output', { id: 'brush-size-value', text: `${brush.size}` })),
        field('Hardness', el('input', {
          type: 'range', min: 0, max: 100, value: Math.round(brush.hardness * 100),
          oninput: (e) => brush.set({ hardness: +e.target.value / 100 }),
        })),
        field('Opacity', el('input', {
          type: 'range', min: 5, max: 100, value: Math.round(brush.opacity * 100),
          oninput: (e) => brush.set({ opacity: +e.target.value / 100 }),
        })),
        el('div', { class: 'divider' }),
        el('button', {
          class: 'btn',
          onClick: () => brush.set({ erase: !brush.erase }),
          text: 'Toggle eraser',
          title: 'Erase instead of paint (E while drawing)',
        }),
      ];
    },

    onActivate(app) { brush.set({ color: app.state.color }); },

    onPointerDown(app, event, point) {
      if (event.button !== 0) return;
      painting = true;
      brush.set({ color: app.state.color });
      brush.begin(point);
      brush.strokeTo(app.doc.active.ctx, point);
      app.doc.touch();
    },

    onPointerMove(app, event, point) {
      if (!painting) return;
      brush.strokeTo(app.doc.active.ctx, point);
      app.doc.touch();
    },

    onPointerUp(app) {
      if (!painting) return;
      painting = false;
      brush.end();
      app.history.push('Brush stroke', 'brush');
    },
  };
}

export function field(label, ...controls) {
  return el('div', { class: 'field' }, [el('label', { text: label }), ...controls]);
}
