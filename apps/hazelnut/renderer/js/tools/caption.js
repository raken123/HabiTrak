// Caption — read the picture, write a caption, an alt text and some keywords.
//
// The only AI tool in Hazelnut that generates nothing, which is why it is the
// cheapest thing in the app at three credits. Nothing is drawn on the picture:
// the result is text, so it opens in a panel you can copy out of.

import { el } from '../dom.js';
import { busy, confirmSpend, modal, toast } from '../ui.js';

export function createCaptionTool() {
  let last = null;

  return {
    id: 'caption',
    hint: 'Caption — three credits for a caption, an alt text and keywords.',

    options(app) {
      const cost = el('span', { class: 'cost', id: 'caption-cost', text: '3' });
      app.quote('caption').then((q) => { cost.textContent = String(q.cost); }).catch(() => {});
      return [
        el('span', { class: 'field', text: 'Reads the whole picture as it is now.' }),
        ...(last ? [el('button', { class: 'btn', text: 'Last reading', onClick: () => show(last) })] : []),
        el('div', { class: 'divider' }),
        el('button', { class: 'btn btn--primary', onClick: () => run(app) }, ['Read it', cost]),
      ];
    },
  };

  async function run(app) {
    if (!app.doc) return;
    const quote = await app.quote('caption');
    if (!(await app.gate('caption', quote))) return;
    if (!(await confirmSpend({
      toolName: 'Caption',
      cost: quote.cost,
      balance: quote.balance,
      note: 'Nothing is generated and nothing on the picture changes — this only reads it.',
    }))) return;

    const job = busy.start({ title: 'Caption', message: 'Reading the picture…' });
    try {
      const call = window.hazelnut.describe({
        image: app.doc.toDataURL('image/jpeg', 0.9),
      }, (p) => job.update(p.message));
      const { result, charged, balance } = await call;
      last = result;
      app.setCredits(balance);
      app.refreshOptions?.();
      show(result);
      toast('Caption', `Done — ${charged} credits used.`, { kind: 'good' });
    } catch (err) {
      app.reportToolError(err);
    } finally {
      job.done();
    }
  }

  function show(reading) {
    const copy = (text) => {
      navigator.clipboard?.writeText(text).then(
        () => toast('Copied', '', { timeout: 1600 }),
        () => toast('Copy', 'The clipboard is not available here.', { kind: 'error' }),
      );
    };

    modal({
      title: 'What is in the picture',
      body: el('div', { class: 'reading' }, [
        el('h4', { text: 'Caption' }),
        el('p', { text: reading.caption }),
        el('h4', { text: 'Alt text' }),
        el('p', { text: reading.alt }),
        el('h4', { text: 'Keywords' }),
        el('p', { class: 'note', text: (reading.keywords || []).join(' · ') }),
        reading.note ? el('p', { class: 'note', text: reading.note }) : null,
      ]),
      footer: (close) => [
        el('button', { class: 'btn', text: 'Copy alt text', onClick: () => copy(reading.alt) }),
        el('button', { class: 'btn btn--primary', text: 'Copy caption', onClick: () => { copy(reading.caption); close(); } }),
      ],
    });
  }
}
