// Imagine — describe a picture and have Hazelnut draw it.
//
// The only tool in here that makes a picture instead of changing one, and the
// only one that never touches the network. The planner and the painter both
// run in this page, on this machine, so there is no key to configure, no
// upload, and no waiting on somebody else's queue.
//
// That changes the shape of the usual tool. Everywhere else the renderer asks
// the main process to do the work and gets a result back; here the renderer
// does the work and asks the main process only for the money. To keep the
// charge-on-success rule that the rest of the app follows, the order is:
// quote, draw, then charge. A generation that is abandoned, or that throws,
// never reaches the charge and never costs a credit.

import { el, makeCanvas, ctx2d } from '../dom.js';
import { field } from './draw.js';
import { busy, confirmSpend, toast, modal } from '../ui.js';
import { planImage } from '../../core/imagine-plan.js';
import { paint } from '../../core/imagine-paint.js';
import { IMAGE_MODELS, MODEL_ORDER, DEFAULT_MODEL, priceLabel } from '../../core/models.js';

const SIZES = [
  { id: 'square', label: 'Square', width: 1024, height: 1024 },
  { id: 'portrait', label: 'Portrait', width: 832, height: 1216 },
  { id: 'landscape', label: 'Landscape', width: 1216, height: 832 },
];

export function createImagineTool() {
  const state = {
    prompt: '',
    model: DEFAULT_MODEL,
    size: 'square',
    last: null,
  };

  return {
    id: 'imagine',
    hint: 'Imagine — describe a picture. It is drawn here, on your machine.',
    // Imagine is the one tool that does not need a document: it makes one.
    needsDoc: false,

    options(app) {
      const cost = el('span', { class: 'cost', text: '…' });
      const note = el('span', { class: 'field', text: '' });

      const refresh = async () => {
        try {
          const q = await window.hazelnut.imagineQuote(state.model);
          cost.textContent = q.unlimited ? 'free' : String(q.cost);
          note.textContent = q.thinks
            ? 'Thinks the picture through before drawing it.'
            : IMAGE_MODELS[state.model].limits[0];
        } catch {
          cost.textContent = '';
        }
      };
      refresh();

      const promptInput = el('input', {
        type: 'text',
        class: 'grow',
        placeholder: 'a cottage in the snow',
        value: state.prompt,
        onInput: (e) => { state.prompt = e.target.value; },
        onKeyDown: (e) => { if (e.key === 'Enter') run(app); },
      });

      const modelSelect = el('select', {
        onChange: (e) => { state.model = e.target.value; refresh(); },
      }, MODEL_ORDER.map((id) => el('option', {
        value: id,
        selected: id === state.model,
        text: IMAGE_MODELS[id].name,
      })));

      const sizeSelect = el('select', {
        onChange: (e) => { state.size = e.target.value; },
      }, SIZES.map((s) => el('option', {
        value: s.id,
        selected: s.id === state.size,
        text: s.label,
      })));

      return [
        field('Describe', promptInput),
        field('Model', modelSelect),
        field('Shape', sizeSelect),
        note,
        el('div', { class: 'divider' }),
        el('button', { class: 'btn', text: 'About the models', onClick: () => explain() }),
        el('button', { class: 'btn btn--primary', onClick: () => run(app) }, ['Generate', cost]),
      ];
    },
  };

  async function run(app) {
    const prompt = state.prompt.trim();
    if (!prompt) {
      toast('Imagine', 'Describe the picture you want first.', { kind: 'error' });
      return;
    }

    const quote = await window.hazelnut.imagineQuote(state.model);

    // Deliberately not `app.gate`: that insists on an API key, and this is the
    // one tool in Hazelnut that does not need one.
    if (!quote.allowed) {
      toast('Not on this edition', quote.message || 'That model is not available here.', { kind: 'error' });
      return;
    }
    if (!quote.affordable) {
      toast('Not enough credits', `This needs ${quote.cost} and you have ${quote.balance}.`, { kind: 'error' });
      return;
    }

    const model = IMAGE_MODELS[state.model];
    if (quote.cost > 0 && !(await confirmSpend({
      toolName: `Imagine — ${model.name}`,
      cost: quote.cost,
      balance: quote.balance,
      note: `${model.tagline} Nothing is uploaded: this is drawn on your machine.`,
    }))) return;

    const size = SIZES.find((s) => s.id === state.size) || SIZES[0];
    const job = busy.start({ title: 'Imagine', message: `${model.name} is drawing…` });

    try {
      const plan = planImage({
        prompt,
        model: state.model,
        edition: quote.edition,
        width: size.width,
        height: size.height,
      });

      const canvas = makeCanvas(plan.width, plan.height);
      paint(ctx2d(canvas), plan);

      // Drawn. Only now does anything get charged.
      const { charged, balance } = await window.hazelnut.imagineCharge(state.model);
      app.setCredits(balance);
      state.last = plan;

      place(app, canvas, plan);
      app.refreshOptions?.();
      report(plan, charged);
    } catch (err) {
      app.reportToolError(err);
    } finally {
      job.done();
    }
  }

  /**
   * Where the picture lands. With a document open it arrives as a new layer,
   * so it can be painted over and adjusted like anything else; with nothing
   * open it becomes the document.
   */
  function place(app, canvas, plan) {
    if (!app.doc) {
      app.openGenerated(canvas, shortName(plan.prompt));
      return;
    }
    app.doc.addImageLayer(canvas, shortName(plan.prompt));
    app.history.push('Imagine', 'layers');
    app.render();
  }

  /** What the generator did, and what it did not understand. */
  function report(plan, charged) {
    const bits = [];
    if (charged > 0) bits.push(`${charged} credit${charged === 1 ? '' : 's'} used.`);
    else bits.push('Unlimited on this edition.');
    if (plan.clamped) {
      bits.push(`Rendered at ${plan.width}×${plan.height} — this edition caps the longest edge.`);
    }
    if (plan.parsed.ignored.length) {
      bits.push(`Not understood: ${plan.parsed.ignored.join(', ')}.`);
    }

    toast(IMAGE_MODELS[plan.model].name, bits.join(' '), {
      kind: plan.warnings.length ? 'error' : 'good',
      timeout: plan.warnings.length ? 12000 : 6000,
    });

    // A picture that asserts something nobody checked gets said out loud as
    // well as printed into the image.
    if (plan.warnings.length) {
      toast('Not checked', plan.warnings.join(' '), { kind: 'error', timeout: 14000 });
    }
  }

  function explain() {
    modal({
      title: 'The two models',
      body: el('div', { class: 'reading' }, [
        el('p', { class: 'note', text: 'Both run on this machine. Neither sends your prompt or your picture anywhere, and neither needs an API key.' }),
        ...MODEL_ORDER.flatMap((id) => {
          const m = IMAGE_MODELS[id];
          return [
            el('h4', { text: `${m.name} — ${priceLabel(id, 'trial')} on the trial, ${priceLabel(id, 'pro')} on Hazelnut` }),
            el('p', { text: m.help }),
            el('ul', {}, m.limits.map((line) => el('li', { text: line }))),
          ];
        }),
      ]),
      footer: (close) => [el('button', { class: 'btn btn--primary', text: 'Close', onClick: close })],
    });
  }
}

function shortName(prompt) {
  const trimmed = String(prompt || '').trim();
  if (!trimmed) return 'Imagine';
  return trimmed.length > 28 ? `${trimmed.slice(0, 27)}…` : trimmed;
}
