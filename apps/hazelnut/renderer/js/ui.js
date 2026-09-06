// Toasts, modals, dropdown menus, tooltips and the busy overlay.

import { $, el, on, escapeHtml } from './dom.js';
import { icon } from './icons.js';

const toastHost = () => $('#toasts');
const modalRoot = () => $('#modal-root');
const menuRoot = () => $('#menu-root');

// ── toasts ────────────────────────────────────────────────────────────────

export function toast(title, body = '', { kind = 'info', timeout = 5200, actions = [] } = {}) {
  const node = el('div', { class: `toast toast--${kind}` }, [
    el('div', { class: 'toast__title', text: title }),
    body ? el('div', { class: 'toast__body', text: body }) : null,
  ]);
  if (actions.length) {
    node.append(el('div', { class: 'toast__actions' }, actions.map((action) =>
      el('button', {
        class: action.primary ? 'btn btn--primary' : 'btn',
        onClick: () => { node.remove(); action.onClick?.(); },
        text: action.label,
      }))));
  }
  toastHost().append(node);
  if (timeout) setTimeout(() => node.remove(), timeout);
  return () => node.remove();
}

export const toastError = (err, fallback = 'Something went wrong.') =>
  toast('Hazelnut', err?.message || fallback, { kind: 'error', timeout: 8000 });

// ── modals ────────────────────────────────────────────────────────────────

/**
 * Open a modal. `render` is handed a `close` function and returns the body.
 * Resolves with whatever `close(value)` was called with.
 */
export function modal({ title, body, footer = [], wide = false, onClose } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const close = (value) => {
      if (settled) return;
      settled = true;
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      onClose?.(value);
      resolve(value);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(undefined); }
    };
    document.addEventListener('keydown', onKey);

    const content = typeof body === 'function' ? body(close) : body;
    const buttons = (typeof footer === 'function' ? footer(close) : footer).filter(Boolean);

    const dialog = el('div', { class: `modal${wide ? ' modal--wide' : ''}` }, [
      el('div', { class: 'modal__head' }, [
        el('h2', { text: title }),
        el('button', { class: 'close', title: 'Close', onClick: () => close(undefined), text: '✕' }),
      ]),
      el('div', { class: 'modal__body' }, [content]),
      buttons.length ? el('div', { class: 'modal__foot' }, buttons) : null,
    ]);

    const backdrop = el('div', {
      class: 'modal-backdrop',
      onMousedown: (event) => { if (event.target === backdrop) close(undefined); },
    }, [dialog]);

    modalRoot().append(backdrop);
    // Focus the first control so the dialog is usable from the keyboard.
    setTimeout(() => dialog.querySelector('input, textarea, button.btn--primary')?.focus(), 0);
  });
}

export function confirmDialog({ title, message, confirmLabel = 'OK', danger = false }) {
  return modal({
    title,
    body: el('p', { text: message }),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(false), text: 'Cancel' }),
      el('button', {
        class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
        onClick: () => close(true),
        text: confirmLabel,
      }),
    ],
  }).then((value) => value === true);
}

/**
 * The one dialog every paid tool goes through: what it costs, what is left,
 * and the chance to back out.
 */
export function confirmSpend({ toolName, cost, balance, note }) {
  return modal({
    title: `Run ${toolName}?`,
    body: el('div', {}, [
      el('p', { text: `This will use ${cost} AI credit${cost === 1 ? '' : 's'}. You have ${balance}.` }),
      note ? el('div', { class: 'note', text: note }) : null,
      el('p', {
        class: 'note',
        text: 'Credits are only taken if the result comes back. A failed generation costs nothing.',
      }),
    ]),
    footer: (close) => [
      el('button', { class: 'btn', onClick: () => close(false), text: 'Cancel' }),
      el('button', { class: 'btn btn--primary', onClick: () => close(true), text: `Use ${cost}` }),
    ],
  }).then((value) => value === true);
}

// ── dropdown menus ────────────────────────────────────────────────────────

let closeOpenMenu = null;

export function openMenu(anchor, items) {
  closeOpenMenu?.();

  const popup = el('div', { class: 'menu-popup' });
  for (const item of items) {
    if (item === '-') { popup.append(el('hr')); continue; }
    popup.append(el('button', {
      disabled: item.disabled === true,
      onClick: () => { dismiss(); item.onClick?.(); },
    }, [
      el('span', { text: item.label }),
      item.shortcut ? el('span', { class: 'shortcut', text: item.shortcut }) : null,
    ]));
  }

  const rect = anchor.getBoundingClientRect();
  popup.style.left = `${Math.round(rect.left)}px`;
  popup.style.top = `${Math.round(rect.bottom + 2)}px`;
  menuRoot().append(popup);
  anchor.classList.add('is-open');

  // Keep the menu on screen if it would run off the right edge.
  const popupRect = popup.getBoundingClientRect();
  if (popupRect.right > window.innerWidth - 8) {
    popup.style.left = `${Math.round(window.innerWidth - popupRect.width - 8)}px`;
  }

  const dismiss = () => {
    popup.remove();
    anchor.classList.remove('is-open');
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    closeOpenMenu = null;
  };
  const onDown = (event) => { if (!popup.contains(event.target) && event.target !== anchor) dismiss(); };
  const onKey = (event) => { if (event.key === 'Escape') dismiss(); };
  setTimeout(() => {
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
  closeOpenMenu = dismiss;
  return dismiss;
}

// ── tooltips ──────────────────────────────────────────────────────────────

let tipNode = null;
let tipTimer = null;

export function attachTooltip(target, render) {
  on(target, 'mouseenter', () => {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      hideTooltip();
      tipNode = el('div', { class: 'tooltip', html: render() });
      document.body.append(tipNode);
      const rect = target.getBoundingClientRect();
      const tip = tipNode.getBoundingClientRect();
      tipNode.style.left = `${Math.round(rect.right + 8)}px`;
      tipNode.style.top = `${Math.round(Math.min(rect.top, window.innerHeight - tip.height - 8))}px`;
    }, 380);
  });
  on(target, 'mouseleave', hideTooltip);
  on(target, 'mousedown', hideTooltip);
}

export function hideTooltip() {
  clearTimeout(tipTimer);
  tipNode?.remove();
  tipNode = null;
}

// ── busy overlay ──────────────────────────────────────────────────────────

export const busy = {
  /** Show the stage overlay for a running job. Returns a controller. */
  start({ title, message = '', onCancel = null }) {
    const overlay = $('#stage-overlay');
    const bar = el('i');
    overlay.replaceChildren(
      el('div', { class: 'spinner spinner--lg' }),
      el('h3', { text: title }),
      el('p', { class: 'busy-message', text: message }),
      el('div', { class: 'progressbar' }, [bar]),
      onCancel ? el('button', { class: 'btn', onClick: onCancel, text: 'Cancel' }) : null,
    );
    overlay.hidden = false;

    const jobEl = $('#status-job');
    jobEl.hidden = false;
    $('#status-job-text').textContent = message || title;
    $('#status-job-cancel').hidden = !onCancel;
    $('#status-job-cancel').onclick = onCancel || null;

    return {
      update(text, fraction = null) {
        const p = overlay.querySelector('.busy-message');
        if (p && text) p.textContent = text;
        if (text) $('#status-job-text').textContent = text;
        bar.style.width = fraction == null ? '35%' : `${Math.round(fraction * 100)}%`;
        if (fraction == null) bar.style.animation = 'none';
      },
      done() {
        overlay.hidden = true;
        overlay.replaceChildren();
        jobEl.hidden = true;
      },
    };
  },
};

// ── shared bits of markup ─────────────────────────────────────────────────

export function toolGuide(tools) {
  return el('div', { class: 'guide' }, tools.map((tool) => el('div', { class: 'guide__tool' }, [
    el('div', { html: icon(tool.icon) }),
    el('div', {}, [
      el('h4', {}, [
        tool.name,
        el('span', {
          class: `tag ${tool.ai ? 'tag--ai' : 'tag--free'}`,
          text: costLabel(tool),
        }),
      ]),
      el('p', { text: tool.help }),
    ]),
  ])));
}

export function costLabel(tool) {
  if (tool.id === 'aiscope') return 'free · Learn 15';
  if (!tool.ai) return 'free';
  return typeof tool.cost === 'number' ? `${tool.cost} credits` : `${tool.cost.min}–${tool.cost.max} credits`;
}

export function sourcesList(sources) {
  if (!sources?.length) return null;
  return el('ul', { class: 'sources' }, sources.slice(0, 6).map((source, i) => el('li', {}, [
    el('span', { class: 'n', text: `${i + 1}.` }),
    el('a', {
      href: '#',
      text: source.title || source.uri,
      onClick: (event) => { event.preventDefault(); window.hazelnut.openExternal(source.uri); },
    }),
  ])));
}

export { escapeHtml };
