// Inline SVG, so the UI has no icon font and no network dependency.

const svg = (body, box = '0 0 24 24') =>
  `<svg viewBox="${box}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  brush: svg('<path d="M15.5 4.5 19.5 8.5 10 18l-4.6 1.1L6.5 14.5 15.5 4.5Z"/><path d="M13.6 6.6 17.4 10.4"/>'),
  'sparkle-brush': svg('<path d="M14.4 6.2 17.8 9.6 9.6 17.8l-4 .9.9-4 7.9-8.5Z"/><path d="M18.4 3.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z"/><path d="M5 4l.5 1.2L6.7 5.7 5.5 6.2 5 7.4 4.5 6.2 3.3 5.7 4.5 5.2 5 4Z"/>'),
  'eraser-magic': svg('<path d="M8.5 20H20"/><path d="M14.8 4.4 20 9.6a1.5 1.5 0 0 1 0 2.1l-7.2 7.2H8.2l-3.6-3.6a1.5 1.5 0 0 1 0-2.1l8.1-8.8a1.5 1.5 0 0 1 2.1 0Z"/><path d="m9.2 8.6 5.6 5.6"/>'),
  film: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.7h4M3 14.3h4M17 9.7h4M17 14.3h4"/>'),
  expand: svg('<path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"/><rect x="9" y="9" width="6" height="6" rx="1"/>'),
  scope: svg('<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/><path d="M10.8 8.3v5M8.3 10.8h5"/>'),
  eye: svg('<path d="M2.6 12S6 5.9 12 5.9 21.4 12 21.4 12 18 18.1 12 18.1 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.7"/>'),
  eyeOff: svg('<path d="M4 4l16 16"/><path d="M9.9 6.3A9.6 9.6 0 0 1 12 6c6 0 9.4 6 9.4 6a17 17 0 0 1-3 3.7M6.5 8.3A17 17 0 0 0 2.6 12S6 18 12 18a9.4 9.4 0 0 0 3.2-.55"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  undo: svg('<path d="M4 9h9a5 5 0 1 1 0 10H8"/><path d="m4 9 3.5-3.5M4 9l3.5 3.5"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3.5 12.5 8.5 4.7 8.5-4.7"/>'),
  image: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5L20 17"/>'),
  wand: svg('<path d="m5 19 9-9"/><path d="m14.5 4.5 5 5-3 3-5-5 3-3Z"/><path d="M4 6h2M5 5v2M18 17h2M19 16v2"/>'),
};

export function icon(name) {
  return ICONS[name] || ICONS.image;
}
