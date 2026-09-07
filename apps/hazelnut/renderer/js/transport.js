// The transport bar: Squirreal's playhead.
//
// Built and inserted by JavaScript rather than sitting in the page, so the
// still-image products never carry markup they cannot use.

import { $, el, on } from './dom.js';

export function installTransport(app) {
  const bar = el('div', { class: 'transport', id: 'transport', hidden: true }, []);

  const play = el('button', { class: 'transport__play', id: 'transport-play', title: 'Play (Space)', text: '▶' });
  const time = el('output', { class: 'transport__time', id: 'transport-time', text: '0.0s' });
  const scrub = el('input', { type: 'range', class: 'transport__scrub', id: 'transport-scrub', min: 0, max: 1, step: 1, value: 0 });
  const total = el('span', { class: 'transport__total', id: 'transport-total', text: '—' });

  bar.append(play, time, scrub, total);
  $('#stage').append(bar);

  let playing = false;
  let raf = null;
  let last = 0;

  const clip = () => app.doc?.clip || null;

  function render() {
    const c = clip();
    bar.hidden = !c;
    if (!c) return;
    scrub.max = String(c.length - 1);
    scrub.value = String(c.index);
    time.value = `${(c.index / c.fps).toFixed(1)}s`;
    total.textContent = `${c.seconds.toFixed(1)}s · ${c.fps} fps`;
    play.textContent = playing ? '❚❚' : '▶';
  }

  function step(now) {
    const c = clip();
    if (!playing || !c) return;
    if (now - last >= 1000 / c.fps) {
      last = now;
      app.doc.setFrame(c.index + 1 >= c.length ? 0 : c.index + 1);
      render();
    }
    raf = requestAnimationFrame(step);
  }

  const start = () => {
    if (playing || !clip()) return;
    playing = true;
    last = 0;
    raf = requestAnimationFrame(step);
    render();
  };
  const stop = () => {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    render();
  };

  on(play, 'click', () => (playing ? stop() : start()));
  on(scrub, 'input', () => {
    stop();
    app.doc?.setFrame?.(Number(scrub.value));
    render();
  });

  return {
    render,
    play: start,
    pause: stop,
    get playing() { return playing; },
  };
}
