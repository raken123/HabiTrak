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
  let requoteTimer = null;

  // Declared before the returned object uses it: everything after the `return`
  // below never runs, so a `let` down there stays in its temporal dead zone for
  // ever and every call to requote() throws.
  function requote(app) {
    clearTimeout(requoteTimer);
    requoteTimer = setTimeout(async () => {
      const badge = document.getElementById('magic-cost');
      if (!badge || !app.doc?.active) return;
      try {
        const params = app.isVideo
          ? { ...app.doc.active.stats(), seconds }
          : app.doc.active.stats();
        const quote = await app.quote('magic-draw', params);
        badge.textContent = String(quote.cost);
      } catch { /* the badge is a nicety; a failed quote is not worth a toast */ }
    }, 250);
  }

  let promptText = '';
  let style = 'photograph';
  // Squirreal only: a clip has a length and a movement, and both move the price.
  let seconds = 4;
  let motion = '';

  return {
    id: 'magic-draw',
    hint: 'Magic Draw — sketch it, describe it, then press Submit.',
    brush,

    options(app) {
      const submit = el('button', {
        class: 'btn btn--primary',
        onClick: () => run(app),
      }, ['Submit', el('span', { class: 'cost', id: 'magic-cost', text: '5' })]);

      const videoFields = app.isVideo ? [
        field('Seconds', el('input', {
          type: 'range', min: 1, max: 8, step: 1, value: seconds,
          oninput: (e) => {
            seconds = +e.target.value;
            e.target.nextElementSibling.value = `${seconds}s`;
            requote(app);
          },
        }), el('output', { text: `${seconds}s` })),
        el('div', { class: 'field' }, [
          el('label', { text: 'Movement' }),
          el('input', {
            type: 'text', class: 'grow', placeholder: 'the car drives past, camera still',
            value: motion,
            oninput: (e) => { motion = e.target.value; },
          }),
        ]),
      ] : [];

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
        ...videoFields,
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

  async function run(app) {
    const metrics = app.doc.active?.stats() || {};
    const params = app.isVideo ? { ...metrics, seconds } : metrics;
    const quote = await app.quote('magic-draw', params);
    if (!(await app.gate('magic-draw', quote))) return;
    if (!(await confirmSpend({
      toolName: 'Magic Draw',
      cost: quote.cost,
      balance: quote.balance,
      note: app.isVideo
        ? `${seconds} second${seconds === 1 ? '' : 's'}. A clip takes longer to come back than a still.`
        : (promptText ? null : 'No description given — Hazelnut will work from the sketch alone.'),
    }))) return;

    const job = busy.start({
      title: 'Magic Draw',
      message: app.isVideo ? 'Sending the shot…' : 'Rendering your sketch…',
      onCancel: () => run.cancel?.(),
    });
    try {
      const call = window.hazelnut.magicDraw({
        sketch: app.doc.toDataURL('image/png'),
        prompt: promptText,
        style,
        metrics,
        ...(app.isVideo ? { seconds, motion } : {}),
      }, (p) => job.update(p.message, p.total ? p.done / p.total : null));
      run.cancel = () => call.cancel();

      const { result, charged, balance } = await call;

      if (app.isVideo) {
        await app.openClip(result, { name: 'Magic Draw' });
        app.transport?.play();
      } else {
        const img = await loadImage(result.image);
        app.doc.addImageLayer(img, 'Magic Draw');
        app.history.push('Magic Draw', 'wand');
      }
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
