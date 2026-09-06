// Realtouch — paint over a thing, and it goes away along with its shadow.
//
// The mask lives on its own canvas so it can be shown as a translucent
// magenta wash while it is being painted, then burned in at full strength for
// the model. That solid magenta is what the analysis pass looks for when it is
// asked what is behind the object.

import { el, makeCanvas, ctx2d, loadImage } from '../dom.js';
import { Brush } from './brush.js';
import { field } from './draw.js';
import { busy, confirmSpend, modal, toast, sourcesList } from '../ui.js';

const MASK_COLOR = '#ff00d4';

export function createRealtouchTool() {
  const brush = new Brush({ size: 48, color: MASK_COLOR, hardness: 0.9, opacity: 1 });
  let mask = null;
  let maskCtx = null;
  let painting = false;
  let removeOverlay = null;
  let hint = '';

  const ensureMask = (app) => {
    if (mask && mask.width === app.doc.width && mask.height === app.doc.height) return;
    mask = makeCanvas(app.doc.width, app.doc.height);
    maskCtx = ctx2d(mask, { willReadFrequently: true });
  };

  const clearMask = (app) => {
    ensureMask(app);
    maskCtx.clearRect(0, 0, mask.width, mask.height);
    app.render();
  };

  /** Is anything actually masked? Cheap sample, not a full scan. */
  const maskHasContent = () => {
    if (!mask) return false;
    const step = Math.max(1, Math.floor(Math.sqrt((mask.width * mask.height) / 40000)));
    const data = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
    for (let y = 0; y < mask.height; y += step) {
      for (let x = 0; x < mask.width; x += step) {
        if (data[(y * mask.width + x) * 4 + 3] > 24) return true;
      }
    }
    return false;
  };

  return {
    id: 'realtouch',
    hint: 'Realtouch — paint over what you want gone, then Remove.',
    brush,

    options(app) {
      return [
        field('Size', el('input', {
          type: 'range', min: 4, max: 400, value: brush.size,
          oninput: (e) => brush.set({ size: +e.target.value }),
        })),
        el('div', { class: 'field' }, [
          el('label', { text: 'Hint' }),
          el('input', {
            type: 'text', class: 'grow', placeholder: 'optional — e.g. "there is a kerb behind it"',
            value: hint,
            oninput: (e) => { hint = e.target.value; },
          }),
        ]),
        el('button', { class: 'btn', onClick: () => clearMask(app), text: 'Clear mask' }),
        el('div', { class: 'divider' }),
        el('button', {
          class: 'btn btn--primary',
          onClick: () => run(app),
        }, ['Remove', el('span', { class: 'cost', text: '20' })]),
      ];
    },

    onActivate(app) {
      ensureMask(app);
      brush.set({ color: MASK_COLOR });
      // Show the mask over the picture while this tool is selected.
      removeOverlay = app.viewport.addOverlay((ctx) => {
        if (!mask) return;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(mask, 0, 0);
        ctx.restore();
      });
    },

    onDeactivate() {
      removeOverlay?.();
      removeOverlay = null;
    },

    onPointerDown(app, event, point) {
      if (event.button !== 0) return;
      ensureMask(app);
      painting = true;
      brush.set({ erase: event.altKey });
      brush.begin(point);
      brush.strokeTo(maskCtx, point);
      app.render();
    },
    onPointerMove(app, event, point) {
      if (!painting) return;
      brush.strokeTo(maskCtx, point);
      app.render();
    },
    onPointerUp(app) {
      if (!painting) return;
      painting = false;
      brush.set({ erase: false });
      brush.end();
      app.render();
    },
  };

  async function run(app) {
    ensureMask(app);
    if (!maskHasContent()) {
      toast('Realtouch', 'Paint over the thing you want removed first.', { kind: 'error' });
      return;
    }

    const quote = await app.quote('realtouch');
    if (!(await app.gate('realtouch', quote))) return;
    if (!(await confirmSpend({
      toolName: 'Realtouch',
      cost: quote.cost,
      balance: quote.balance,
      note: 'Realtouch looks the location up online before it rebuilds the gap, so this one takes a little longer than the others.',
    }))) return;

    // The flattened picture, and the same picture with the mask burned in.
    const flat = app.doc.composite();
    const marked = makeCanvas(app.doc.width, app.doc.height);
    const mctx = ctx2d(marked);
    mctx.drawImage(flat, 0, 0);
    mctx.drawImage(mask, 0, 0);

    const job = busy.start({ title: 'Realtouch', message: 'Examining the scene…', onCancel: () => run.cancel?.() });
    try {
      const call = window.hazelnut.realtouch({
        image: flat.toDataURL('image/png'),
        marked: marked.toDataURL('image/png'),
        hint,
      }, (p) => job.update(p.message));
      run.cancel = () => call.cancel();

      const { result, charged, balance } = await call;
      const img = await loadImage(result.image);
      app.doc.addImageLayer(img, 'Realtouch');
      app.history.push('Realtouch', 'eraser-magic');
      app.setCredits(balance);
      clearMask(app);

      toast('Realtouch', `Removed — ${charged} credits used.`, {
        kind: 'good',
        actions: [{ label: 'What it found', onClick: () => showFindings(result) }],
      });
    } catch (err) {
      app.reportToolError(err);
    } finally {
      run.cancel = null;
      job.done();
    }
  }

  function showFindings(result) {
    modal({
      title: 'What Realtouch found',
      wide: true,
      body: el('div', {}, [
        el('p', { class: 'note', text: 'Realtouch identifies the setting, then reasons about what the object was hiding before it paints the gap.' }),
        ...String(result.scene || '').split(/\n{2,}/).map((para) => el('p', { text: para })),
        result.sources?.length ? el('h4', { text: 'Sources it consulted' }) : null,
        sourcesList(result.sources),
      ]),
      footer: (close) => [el('button', { class: 'btn btn--primary', onClick: () => close(), text: 'Close' })],
    });
  }
}
