// Magic Draw — sketch in 2D, submit, get the photoreal version back.
//
// The drawing half is Draw. The difference is the Submit button: it sends the
// flattened canvas to the model and drops the result in as a new layer, so the
// sketch underneath survives and the two can be compared.

import { el, loadImage } from '../dom.js';
import { Brush } from './brush.js';
import { field } from './draw.js';
import { busy, confirmSpend, toast, toastError } from '../ui.js';

export function createMagicDrawTool() {
  const brush = new Brush({ size: 18, color: '#3d6fd6', hardness: 0.85, opacity: 1 });
  let painting = false;
  let promptText = '';
  let style = 'photograph';

  return {
    id: 'magic-draw',
    hint: 'Magic Draw — sketch it, describe it, then press Submit.',
    brush,

    options(app) {
      const submit = el('button', {
        class: 'btn btn--primary',
        onClick: () => run(app),
      }, ['Submit', el('span', { class: 'cost', id: 'magic-cost', text: '5' })]);

      return [
        field('Size', el('input', {
          type: 'range', min: 1, max: 200, value: brush.size,
          oninput: (e) => brush.set({ size: +e.target.value }),
        })),
        el('div', { class: 'field' }, [
          el('label', { text: 'Describe it' }),
          el('input', {
            type: 'text', class: 'grow', placeholder: 'a red barn at golden hour, wet grass',
            value: promptText,
            oninput: (e) => { promptText = e.target.value; },
          }),
        ]),
        el('div', { class: 'field' }, [
          el('label', { text: 'As a' }),
          el('select', {
            onChange: (e) => { style = e.target.value; },
          }, [
            el('option', { value: 'photograph', text: 'Photograph' }),
            el('option', { value: 'studio product photograph', text: 'Product shot' }),
            el('option', { value: 'cinematic film still', text: 'Film still' }),
            el('option', { value: 'macro photograph', text: 'Macro' }),
          ]),
        ]),
        el('div', { class: 'divider' }),
        submit,
      ];
    },

    onActivate(app) {
      brush.set({ color: app.state.color });
      requote(app);
    },

    // The price depends on how much of the canvas has been painted, so the
    // badge on Submit is re-quoted as the sketch fills up rather than showing
    // the bottom of the band until the moment of truth.
    onDocChange(app) { requote(app); },

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
      app.history.push('Sketch stroke', 'brush');
    },
  };

  let requoteTimer = null;
  function requote(app) {
    clearTimeout(requoteTimer);
    requoteTimer = setTimeout(async () => {
      const badge = document.getElementById('magic-cost');
      if (!badge || !app.doc?.active) return;
      try {
        const quote = await app.quote('magic-draw', app.doc.active.stats());
        badge.textContent = String(quote.cost);
      } catch { /* the badge is a nicety; a failed quote is not worth a toast */ }
    }, 250);
  }

  async function run(app) {
    const metrics = app.doc.active?.stats() || {};
    const quote = await app.quote('magic-draw', metrics);
    if (!(await app.gate('magic-draw', quote))) return;
    if (!(await confirmSpend({
      toolName: 'Magic Draw',
      cost: quote.cost,
      balance: quote.balance,
      note: promptText ? null : 'No description given — Hazelnut will work from the sketch alone.',
    }))) return;

    const job = busy.start({ title: 'Magic Draw', message: 'Rendering your sketch…', onCancel: () => run.cancel?.() });
    try {
      const call = window.hazelnut.magicDraw({
        sketch: app.doc.toDataURL('image/png'),
        prompt: promptText,
        style,
        metrics,
      }, (p) => job.update(p.message));
      run.cancel = () => call.cancel();

      const { result, charged, balance } = await call;
      const img = await loadImage(result.image);
      app.doc.addImageLayer(img, 'Magic Draw');
      app.history.push('Magic Draw', 'wand');
      app.setCredits(balance);
      toast('Magic Draw', `Done — ${charged} credits used.`, { kind: 'good' });
    } catch (err) {
      app.reportToolError(err);
    } finally {
      run.cancel = null;
      job.done();
    }
  }
}
