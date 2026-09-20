// The cheap edits: Upscale, Restore, Colourise, Background, Sky — and the two
// that carry a mask, Erase and Magic Text.
//
// One picture in, one picture out, so all seven share this factory: the same
// quote, the same confirm, the same progress, the same "add it as a layer and
// let the history remember it". The only differences are the instruction the
// engine sends and the one field the user gets to fill in.

import { el, loadImage, makeCanvas, ctx2d } from '../dom.js';
import { field } from './draw.js';
import { Brush } from './brush.js';
import { busy, confirmSpend, toast } from '../ui.js';

const MASK_COLOR = '#ff00d4';

/**
 * @param {{id:string, name:string, icon:string, hint:string, verb:string,
 *          note?:string, field?:object, mask?:boolean, maskPrompt?:string,
 *          cropToMask?:boolean, requires?:{key:string, message:string}}} spec
 */
export function createTransformTool(spec) {
  const params = {};
  const brush = spec.mask ? new Brush({ size: 40, color: MASK_COLOR, hardness: 0.9, opacity: 1 }) : null;
  let mask = null;
  let maskCtx = null;
  let painting = false;
  let removeOverlay = null;
  let active = false;

  const ensureMask = (app) => {
    if (!spec.mask) return;
    if (mask && mask.width === app.doc.width && mask.height === app.doc.height) return;
    mask = makeCanvas(app.doc.width, app.doc.height);
    maskCtx = ctx2d(mask, { willReadFrequently: true });
  };

  const clearMask = (app) => {
    if (!spec.mask) return;
    ensureMask(app);
    maskCtx.clearRect(0, 0, mask.width, mask.height);
    app.render();
  };

  /**
   * The rectangle the mask actually covers, padded outwards so the model sees
   * what surrounds the words as well as the words. Null when nothing is
   * painted. Used by Magic Text in Eco Mode, which sends this crop instead of
   * the whole photograph.
   */
  const maskBounds = (app, pad = 0.35) => {
    if (!mask) return null;
    const { width, height } = mask;
    const data = maskCtx.getImageData(0, 0, width, height).data;
    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] <= 24) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    const padX = Math.max(24, Math.round((x1 - x0 + 1) * pad));
    const padY = Math.max(24, Math.round((y1 - y0 + 1) * pad));
    const x = Math.max(0, x0 - padX);
    const y = Math.max(0, y0 - padY);
    return {
      x, y,
      w: Math.min(width, x1 + 1 + padX) - x,
      h: Math.min(height, y1 + 1 + padY) - y,
    };
  };

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

  function control(app) {
    const f = spec.field;
    if (!f) return null;
    if (f.type === 'select') {
      return el('div', { class: 'field' }, [
        el('label', { text: f.label }),
        el('select', { onChange: (e) => { params[f.key] = e.target.value; } },
          f.options.map(([value, label], i) => el('option', {
            value, text: label, ...(i === 0 ? { selected: true } : {}),
          }))),
      ]);
    }
    return el('div', { class: 'field' }, [
      el('label', { text: f.label }),
      el('input', {
        type: 'text', class: 'grow', placeholder: f.placeholder || '',
        value: params[f.key] || '',
        oninput: (e) => { params[f.key] = e.target.value; },
      }),
    ]);
  }

  return {
    id: spec.id,
    hint: spec.hint,
    brush,

    options(app) {
      const cost = el('span', { class: 'cost', id: `${spec.id}-cost`, text: '—' });
      app.quote(spec.id).then((q) => { cost.textContent = String(q.cost); }).catch(() => {});

      return [
        ...(spec.mask ? [
          field('Size', el('input', {
            type: 'range', min: 4, max: 300, value: brush.size,
            oninput: (e) => brush.set({ size: +e.target.value }),
          })),
          el('button', { class: 'btn', text: 'Clear mask', onClick: () => clearMask(app) }),
        ] : []),
        control(app),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn btn--primary', onClick: () => run(app) }, [spec.verb, cost]),
      ].filter(Boolean);
    },

    onActivate(app) {
      active = true;
      if (!spec.mask) return;
      ensureMask(app);
      brush.set({ color: MASK_COLOR });
      removeOverlay = app.viewport.addOverlay((ctx) => {
        if (!active || !mask) return;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(mask, 0, 0);
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
      if (!spec.mask || event.button !== 0) return;
      ensureMask(app);
      painting = true;
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
      brush.end();
      app.render();
    },
  };

  async function run(app) {
    if (!app.doc) return;
    if (spec.mask) {
      ensureMask(app);
      if (!maskHasContent()) {
        toast(spec.name, spec.maskPrompt || 'Paint over what you want gone first.', { kind: 'error' });
        return;
      }
    }

    if (spec.requires && !String(params[spec.requires.key] || '').trim()) {
      toast(spec.name, spec.requires.message, { kind: 'error' });
      return;
    }

    const quote = await app.quote(spec.id);
    if (!(await app.gate(spec.id, quote))) return;
    if (!(await confirmSpend({
      toolName: spec.name,
      cost: quote.cost,
      balance: quote.balance,
      note: spec.note || null,
      ecoNote: app.ecoNote(spec.id),
    }))) return;

    const flat = app.doc.composite();

    // Eco Mode on a crop-able tool sends only the region around the mask. That
    // is a far smaller request than the whole picture — which is the point,
    // and also the reason the result is a rougher match: the model is matching
    // a typeface it can only see a few centimetres of.
    const region = spec.cropToMask && app.eco ? maskBounds(app) : null;

    const cut = (source) => {
      if (!region) return source;
      const canvas = makeCanvas(region.w, region.h);
      ctx2d(canvas).drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
      return canvas;
    };

    let marked = null;
    if (spec.mask) {
      const canvas = makeCanvas(app.doc.width, app.doc.height);
      const ctx = ctx2d(canvas);
      ctx.drawImage(flat, 0, 0);
      ctx.drawImage(mask, 0, 0);
      marked = app.encode(cut(canvas), 'image/png');
    }

    const job = busy.start({
      title: spec.name,
      message: 'Sending the picture…',
      onCancel: () => run.cancel?.(),
    });
    try {
      const call = window.hazelnut.transform(spec.id, {
        image: app.encode(cut(flat), 'image/png'),
        mask: marked,
        params: { ...params },
        eco: app.eco,
      }, (p) => job.update(p.message, p.total ? p.done / p.total : null));
      run.cancel = () => call.cancel();

      const { result, charged, balance } = await call;
      const img = await loadImage(result.image);

      // Upscale comes back larger, so the document grows with it; everything
      // else is the same frame and lands as a layer above what it replaces.
      if (spec.id === 'upscale' && (img.naturalWidth !== app.doc.width || img.naturalHeight !== app.doc.height)) {
        for (const layer of app.doc.layers) {
          const next = makeCanvas(img.naturalWidth, img.naturalHeight);
          const nctx = ctx2d(next, { willReadFrequently: true });
          nctx.imageSmoothingQuality = 'high';
          nctx.drawImage(layer.canvas, 0, 0, img.naturalWidth, img.naturalHeight);
          layer.canvas = next;
          layer.ctx = nctx;
        }
        app.doc.reframe(img.naturalWidth, img.naturalHeight);
        app.viewport.setDocument(app.doc);
      }

      if (region) app.doc.addImageLayerAt(img, region, spec.name);
      else app.doc.addImageLayer(img, spec.name);
      app.history.push(spec.name, spec.icon);
      app.setCredits(balance);
      if (spec.mask) clearMask(app);
      toast(spec.name, `Done — ${charged} credits used.`, { kind: 'good' });
    } catch (err) {
      app.reportToolError(err);
    } finally {
      run.cancel = null;
      job.done();
    }
  }
}

export const createEraseTool = () => createTransformTool({
  id: 'erase',
  name: 'Erase',
  icon: 'eraser',
  verb: 'Erase',
  mask: true,
  hint: 'Erase — paint over something small, then Erase.',
  note: 'Erase fills from the pixels around the mask. For something big, or something with a real place behind it, Realtouch looks the location up instead.',
  field: { key: 'hint', label: 'Hint', placeholder: 'optional — e.g. “there is a kerb behind it”' },
});

export const createMagicTextTool = () => createTransformTool({
  id: 'magic-text',
  name: 'Magic Text',
  icon: 'text-magic',
  verb: 'Generate',
  mask: true,
  cropToMask: true,
  maskPrompt: 'Paint over the words you want changed first.',
  hint: 'Magic Text — paint over the words, type the new ones, then Generate.',
  note: 'The new words are set in the typeface that is already there, at the same angle and under the same light. Long replacements are tightened to fit rather than allowed to run off the sign.',
  requires: { key: 'words', message: 'Type the words the sign should say.' },
  field: { key: 'words', label: 'Say instead', placeholder: '“CLOSED FOR THE WINTER”' },
});

export const createUpscaleTool = () => createTransformTool({
  id: 'upscale',
  name: 'Upscale',
  icon: 'upscale',
  verb: 'Upscale',
  hint: 'Upscale — double the size, with the detail rebuilt.',
  note: 'The picture comes back at twice the width and height, and the document grows to match.',
  field: {
    key: 'detail', label: 'Detail', type: 'select',
    options: [['faithful', 'Faithful'], ['natural', 'Natural'], ['crisp', 'Crisp']],
  },
});

export const createRestoreTool = () => createTransformTool({
  id: 'restore',
  name: 'Restore',
  icon: 'restore',
  verb: 'Restore',
  hint: 'Restore — scratches, creases, fading and damp.',
  field: { key: 'note', label: 'Note', placeholder: 'optional — e.g. “the crease runs through the roof”' },
});

export const createColouriseTool = () => createTransformTool({
  id: 'colourise',
  name: 'Colourise',
  icon: 'palette',
  verb: 'Colourise',
  hint: 'Colourise — colour for a black-and-white photograph.',
  note: 'This is an interpretation, not a recovery: the colour was never in the negative.',
  field: { key: 'era', label: 'Era', placeholder: 'optional — e.g. “a 1955 English seaside”' },
});

export const createBackgroundTool = () => createTransformTool({
  id: 'background',
  name: 'Background',
  icon: 'cutout',
  verb: 'Separate',
  hint: 'Background — cut the subject out, or put it somewhere else.',
  field: { key: 'replacement', label: 'Replace with', placeholder: 'leave empty to cut out; or “a plain grey studio wall”' },
});

export const createSkyTool = () => createTransformTool({
  id: 'sky',
  name: 'Sky',
  icon: 'cloud',
  verb: 'Replace sky',
  hint: 'Sky — a new sky, with the light underneath it changed to match.',
  field: { key: 'want', label: 'Sky', placeholder: 'e.g. “a clear evening sky, low sun off to the left”' },
});
