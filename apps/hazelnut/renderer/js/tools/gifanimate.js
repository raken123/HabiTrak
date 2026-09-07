// GIF Animate — up to five seconds of movement, encoded to a real GIF.
//
// The model produces a handful of keyframes; this file turns them into the
// played frame rate by cross-fading between them, then encodes the result with
// the GIF writer in @hazelnut/core. Encoding happens here rather than in the
// main process because the frames only exist as canvas pixels.

import { el, makeCanvas, ctx2d, loadImage, clamp } from '../dom.js';
import { field } from './draw.js';
import { busy, confirmSpend, modal, toast } from '../ui.js';
import { encodeGif } from '../../core/gif.js';

// GIFs are palette-limited and grow fast; beyond this the file is unusable
// long before it is prettier.
const MAX_EDGE = 640;

export function createGifAnimateTool() {
  let motion = '';
  let seconds = 5;
  let fps = 8;

  return {
    id: 'gif-animate',
    hint: 'GIF Animate — describe the motion, then Generate. Up to five seconds.',

    options(app) {
      // In Squirreal the motion already exists, so there is nothing to
      // generate and nothing to charge: this becomes an encoder for the clip
      // that is already open.
      if (app.isVideo) {
        return [
          el('div', { class: 'field' }, [
            el('label', { text: 'Loop' }),
            el('span', {
              class: 'note',
              text: app.doc?.clip
                ? `${app.doc.clip.length} frames · ${app.doc.clip.seconds.toFixed(1)}s at ${app.doc.clip.fps} fps`
                : 'Open or generate a clip first.',
            }),
          ]),
          el('div', { class: 'divider' }),
          el('button', {
            class: 'btn btn--primary',
            onClick: () => exportClip(app),
          }, ['Export GIF', el('span', { class: 'cost', text: '0' })]),
        ];
      }

      const cost = el('span', { class: 'cost', text: '600' });
      const requote = async () => {
        const quote = await app.quote('gif-animate', { seconds, fps });
        cost.textContent = String(quote.cost);
      };

      return [
        el('div', { class: 'field' }, [
          el('label', { text: 'Motion' }),
          el('input', {
            type: 'text', class: 'grow', placeholder: 'the flag ripples in a light breeze',
            value: motion,
            oninput: (e) => { motion = e.target.value; },
          }),
        ]),
        field('Seconds', el('input', {
          type: 'range', min: 0.5, max: 5, step: 0.5, value: seconds,
          oninput: (e) => { seconds = +e.target.value; e.target.nextElementSibling.value = `${seconds}s`; requote(); },
        }), el('output', { text: `${seconds}s` })),
        field('FPS', el('input', {
          type: 'range', min: 4, max: 12, step: 1, value: fps,
          oninput: (e) => { fps = +e.target.value; e.target.nextElementSibling.value = String(fps); requote(); },
        }), el('output', { text: String(fps) })),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn btn--primary', onClick: () => run(app) }, ['Generate', cost]),
      ];
    },
  };

  /** Squirreal: encode the open clip, locally and free. */
  async function exportClip(app) {
    const clip = app.doc?.clip;
    if (!clip) {
      toast('GIF Animate', 'There is no clip open to export.', { kind: 'error' });
      return;
    }
    const job = busy.start({ title: 'GIF Animate', message: 'Encoding the GIF…' });
    try {
      const plan = {
        count: clip.length,
        seconds: Number(clip.seconds.toFixed(1)),
        fps: clip.fps,
        delayMs: Math.round(1000 / clip.fps),
      };
      // The frames are already the played frames, so there is nothing to
      // cross-fade between: hand them over as they are.
      const gif = await buildGif(app, clip.frames, plan);
      toast('GIF Animate', `${plan.count} frames encoded — no credits used.`, { kind: 'good' });
      showResult(app, gif, plan);
    } catch (err) {
      app.reportToolError(err);
    } finally {
      job.done();
    }
  }

  async function run(app) {
    if (!motion.trim()) {
      toast('GIF Animate', 'Describe the motion first — for example "steam rises from the cup".', { kind: 'error' });
      return;
    }
    const quote = await app.quote('gif-animate', { seconds, fps });
    if (!(await app.gate('gif-animate', quote))) return;
    if (!(await confirmSpend({
      toolName: 'GIF Animate',
      cost: quote.cost,
      balance: quote.balance,
      note: `${seconds}s at ${fps} fps. This is the most expensive tool in Hazelnut and takes a minute or two.`,
    }))) return;

    const job = busy.start({ title: 'GIF Animate', message: 'Starting…', onCancel: () => run.cancel?.() });
    try {
      const call = window.hazelnut.gifAnimate({
        image: app.doc.toDataURL('image/png'),
        motion,
        seconds,
        fps,
      }, (p) => job.update(p.message, p.total ? p.done / p.total : null));
      run.cancel = () => call.cancel();

      const { result, charged, balance } = await call;
      app.setCredits(balance);

      job.update('Encoding the GIF…', 0.95);
      const gif = await buildGif(app, result.keyframes, result.plan);

      toast('GIF Animate', `${result.plan.seconds}s at ${result.plan.fps} fps — ${charged} credits used.`, { kind: 'good' });
      showResult(app, gif, result.plan);
    } catch (err) {
      app.reportToolError(err);
    } finally {
      run.cancel = null;
      job.done();
    }
  }

  /**
   * Turn keyframes into `plan.count` played frames. Each played frame sits
   * somewhere between two keyframes; drawing the later one over the earlier at
   * partial alpha gives a smooth dissolve rather than a visible jump.
   */
  async function buildGif(app, keyframes, plan) {
    // Hazelnut hands over keyframe data URLs; Squirreal hands over the clip's
    // own canvases, which are already decoded.
    const images = await Promise.all(keyframes.map((k) => (typeof k === 'string' ? loadImage(k) : k)));
    const scale = Math.min(1, MAX_EDGE / Math.max(app.doc.width, app.doc.height));
    const width = Math.max(2, Math.round(app.doc.width * scale));
    const height = Math.max(2, Math.round(app.doc.height * scale));

    const canvas = makeCanvas(width, height);
    const ctx = ctx2d(canvas, { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';

    const frames = [];
    const last = images.length - 1;
    for (let i = 0; i < plan.count; i += 1) {
      const t = plan.count === 1 ? 0 : (i / (plan.count - 1)) * last;
      const a = Math.min(last, Math.floor(t));
      const b = Math.min(last, a + 1);
      const blend = t - a;

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.drawImage(images[a], 0, 0, width, height);
      if (b !== a && blend > 0.001) {
        ctx.globalAlpha = clamp(blend, 0, 1);
        ctx.drawImage(images[b], 0, 0, width, height);
        ctx.globalAlpha = 1;
      }
      frames.push({ data: ctx.getImageData(0, 0, width, height).data });
    }

    const bytes = encodeGif(frames, { width, height, delayMs: plan.delayMs, loop: 0, dither: true });
    const blob = new Blob([bytes], { type: 'image/gif' });
    return { blob, url: URL.createObjectURL(blob), width, height, bytes: bytes.length };
  }

  function showResult(app, gif, plan) {
    modal({
      title: 'Your GIF',
      wide: true,
      onClose: () => URL.revokeObjectURL(gif.url),
      body: el('div', {}, [
        el('img', {
          src: gif.url,
          alt: 'Generated animation',
          style: 'max-width:100%;display:block;margin:0 auto;border-radius:4px;background:#111',
        }),
        el('p', {
          class: 'note',
          text: `${gif.width} × ${gif.height} · ${plan.count} frames · ${plan.seconds}s at ${plan.fps} fps · ${(gif.bytes / 1024).toFixed(0)} KB`,
        }),
      ]),
      footer: (close) => [
        el('button', { class: 'btn', onClick: () => close(), text: 'Close' }),
        el('button', {
          class: 'btn btn--primary',
          text: 'Save GIF…',
          onClick: async () => {
            const dataUrl = await blobToDataUrl(gif.blob);
            const saved = await window.hazelnut.saveImage(dataUrl, `hazelnut-animation.gif`);
            if (saved) toast('Saved', saved.path, { kind: 'good' });
            close();
          },
        }),
      ],
    });
    app.lastGif = gif;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the generated GIF.'));
    reader.readAsDataURL(blob);
  });
}
