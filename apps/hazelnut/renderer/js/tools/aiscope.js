// AIScope — magnify from 80× to 60,000×, then have the AI say what it is.
//
// The zoom is honest about itself. A document pixel can only fill the scope
// once; past that point every extra magnification is interpolation, and the
// readout says so rather than pretending there is detail to see. Zooming costs
// nothing at any magnification — only Learn is billed.

import { el, makeCanvas, ctx2d, clamp } from '../dom.js';
import { busy, confirmSpend, toast } from '../ui.js';

const SCOPE_PX = 252;            // the scope canvas, in device-independent pixels
const OPTICAL_LIMIT = SCOPE_PX;  // one document pixel filling the scope
const LEARN_SIZE = 512;          // what gets sent to the model
const MIN_ZOOM = 80;
const MAX_ZOOM = 60000;

export function createAIScopeTool() {
  let focus = null;              // the point being examined, in document pixels
  let zoom = 400;
  let removeOverlay = null;
  let app = null;

  const scopeCanvas = () => document.getElementById('scope-canvas');

  function quality(z) {
    if (z <= OPTICAL_LIMIT) return { key: 'optical', label: 'optical', className: '' };
    if (z <= OPTICAL_LIMIT * 8) return { key: 'interpolated', label: 'interpolated', className: 'is-interpolated' };
    return { key: 'beyond', label: 'beyond detail', className: 'is-beyond' };
  }

  /** The document rectangle currently under the scope. */
  function region() {
    const span = SCOPE_PX / zoom;   // document pixels across the scope
    return { x: focus.x - span / 2, y: focus.y - span / 2, size: span };
  }

  function renderScope() {
    const canvas = scopeCanvas();
    if (!canvas || !app?.doc) return;
    const ctx = ctx2d(canvas);
    canvas.width = SCOPE_PX;
    canvas.height = SCOPE_PX;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, SCOPE_PX, SCOPE_PX);

    if (!focus) {
      ctx.fillStyle = '#7a7a7a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click the picture to examine a spot', SCOPE_PX / 2, SCOPE_PX / 2);
      return;
    }

    const { x, y, size } = region();
    // Below the optical limit there is real detail to resample smoothly; above
    // it, smoothing would invent a texture that is not there, so show the
    // pixels as they are.
    ctx.imageSmoothingEnabled = zoom <= OPTICAL_LIMIT;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(app.doc.composite(), x, y, size, size, 0, 0, SCOPE_PX, SCOPE_PX);

    // Reticle.
    ctx.strokeStyle = 'rgba(224,137,74,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(SCOPE_PX / 2, 0); ctx.lineTo(SCOPE_PX / 2, SCOPE_PX);
    ctx.moveTo(0, SCOPE_PX / 2); ctx.lineTo(SCOPE_PX, SCOPE_PX / 2);
    ctx.stroke();

    const q = quality(zoom);
    document.getElementById('scope-zoom').textContent = `${Math.round(zoom).toLocaleString('en-US')}×`;
    const badge = document.getElementById('scope-quality');
    badge.textContent = q.label;
    badge.className = `scope-quality ${q.className}`;
  }

  /** The crop that goes to the model, upscaled so small regions are legible. */
  function learnCrop() {
    const { x, y, size } = region();
    const canvas = makeCanvas(LEARN_SIZE, LEARN_SIZE);
    const ctx = ctx2d(canvas);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LEARN_SIZE, LEARN_SIZE);
    ctx.drawImage(app.doc.composite(), x, y, size, size, 0, 0, LEARN_SIZE, LEARN_SIZE);
    return canvas.toDataURL('image/png');
  }

  return {
    id: 'aiscope',
    hint: 'AIScope — click a spot, then use the slider. Zooming is free; Learn costs 15.',

    options(host) {
      app = host;
      return [
        el('div', { class: 'field' }, [
          el('label', { text: 'Magnification' }),
          el('input', {
            type: 'range', min: MIN_ZOOM, max: MAX_ZOOM, step: 10, value: zoom,
            oninput: (e) => setZoom(+e.target.value),
            id: 'scope-optionsbar-zoom',
          }),
          el('output', { id: 'scope-optionsbar-value', text: `${zoom}×` }),
        ]),
        el('button', { class: 'btn', onClick: () => setZoom(MIN_ZOOM), text: '80×' }),
        el('button', { class: 'btn', onClick: () => setZoom(OPTICAL_LIMIT), text: 'Optical limit' }),
        el('button', { class: 'btn', onClick: () => setZoom(MAX_ZOOM), text: '60,000×' }),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn btn--primary', onClick: () => learn(app) }, ['Learn this', el('span', { class: 'cost', text: '15' })]),
      ];
    },

    onActivate(host) {
      app = host;
      document.getElementById('scope-panel').hidden = false;
      if (!focus) focus = { x: app.doc.width / 2, y: app.doc.height / 2 };

      const slider = document.getElementById('scope-zoom-slider');
      slider.value = zoom;
      slider.oninput = (e) => setZoom(+e.target.value);
      document.getElementById('scope-learn').onclick = () => learn(app);

      removeOverlay = app.viewport.addOverlay((ctx, viewport) => {
        if (!focus) return;
        const { size } = region();
        const px = 1 / viewport.scale;
        // Keep the reticle visible even when the region is sub-pixel.
        const box = Math.max(size, 10 * px);
        ctx.save();
        ctx.strokeStyle = '#e0894a';
        ctx.lineWidth = 1.5 * px;
        ctx.strokeRect(focus.x - box / 2, focus.y - box / 2, box, box);
        ctx.setLineDash([4 * px, 4 * px]);
        ctx.strokeStyle = 'rgba(224,137,74,.5)';
        ctx.strokeRect(focus.x - box * 2, focus.y - box * 2, box * 4, box * 4);
        ctx.restore();
      });
      renderScope();
    },

    onDeactivate() {
      document.getElementById('scope-panel').hidden = true;
      removeOverlay?.();
      removeOverlay = null;
    },

    onPointerDown(host, event, point) {
      if (event.button !== 0) return;
      app = host;
      focus = {
        x: clamp(point.x, 0, host.doc.width),
        y: clamp(point.y, 0, host.doc.height),
      };
      renderScope();
      host.render();
    },

    onPointerMove(host, event, point) {
      if (!(event.buttons & 1)) return;
      focus = { x: clamp(point.x, 0, host.doc.width), y: clamp(point.y, 0, host.doc.height) };
      renderScope();
      host.render();
    },

    onDocChange() { renderScope(); },
  };

  function setZoom(value) {
    zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    const panelSlider = document.getElementById('scope-zoom-slider');
    if (panelSlider) panelSlider.value = zoom;
    const barSlider = document.getElementById('scope-optionsbar-zoom');
    if (barSlider) barSlider.value = zoom;
    const barValue = document.getElementById('scope-optionsbar-value');
    if (barValue) barValue.value = `${Math.round(zoom).toLocaleString('en-US')}×`;
    renderScope();
    app?.render();
  }

  async function learn(host) {
    app = host;
    if (!focus) {
      toast('AIScope', 'Click a spot on the picture first.', { kind: 'error' });
      return;
    }
    const quote = await host.quote('aiscope', { learn: true });
    if (!(await host.gate('aiscope', quote, { learn: true }))) return;

    const q = quality(zoom);
    if (!(await confirmSpend({
      toolName: 'AIScope Learn',
      cost: quote.cost,
      balance: quote.balance,
      note: q.key === 'beyond'
        ? `At ${Math.round(zoom).toLocaleString('en-US')}× there is no real detail left in the picture — the reading will mostly describe interpolation. Drop below ${OPTICAL_LIMIT}× for a useful answer.`
        : null,
    }))) return;

    const job = busy.start({ title: 'AIScope', message: 'Studying the crop…' });
    try {
      const call = window.hazelnut.aiscopeLearn({ crop: learnCrop(), zoom }, (p) => job.update(p.message));
      const { result, charged, balance } = await call;
      host.setCredits(balance);
      renderCard(result.card);
      toast('AIScope', `${result.card.subject} — ${charged} credits used.`, { kind: 'good' });
    } catch (err) {
      host.reportToolError(err);
    } finally {
      job.done();
    }
  }

  function renderCard(card) {
    const host = document.getElementById('scope-card');
    if (!host) return;
    host.replaceChildren(
      el('div', { class: 'cat', text: card.category || 'unknown' }),
      el('h4', { text: card.subject || 'Unclear' }),
      el('p', { text: card.description || '' }),
      card.features?.length
        ? el('ul', {}, card.features.slice(0, 5).map((f) => el('li', { text: f })))
        : null,
      card.material ? el('p', { text: `Material: ${card.material}` }) : null,
      card.scaleNote ? el('p', { text: card.scaleNote }) : null,
      el('div', { class: 'confidence' }, [
        el('i', { style: `width:${Math.round((card.confidence ?? 0) * 100)}%` }),
      ]),
    );
  }
}
