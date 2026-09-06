// Image plumbing shared by the main process and both renderers.
//
// Everything crossing the IPC boundary is a data URL. It is bulkier than a raw
// buffer but it survives structured cloning, drops straight into an <img>, and
// keeps the renderer from ever needing filesystem access.
//
// No Node built-ins here: Hazelnut Mini's Android build imports this file in a
// browser, where `Buffer` does not exist.

const DATA_URL_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?(;base64)?,(.*)$/is;

export function parseDataUrl(dataUrl) {
  const m = DATA_URL_RE.exec(String(dataUrl || ''));
  if (!m) throw new Error('Not a data URL.');
  const [, mimeType = 'application/octet-stream', b64, payload] = m;
  return {
    mimeType,
    base64: b64 ? payload : utf8ToBase64(decodeURIComponent(payload)),
  };
}

export function toDataUrl(base64, mimeType = 'image/png') {
  return `data:${mimeType};base64,${base64}`;
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Base64 to raw bytes, without going through Node's Buffer. */
export function base64ToBytes(base64) {
  const binary = atob(String(base64 || ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Rough decoded byte count of a base64 payload, without decoding it. */
export function base64Bytes(base64) {
  const s = String(base64 || '');
  const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}

/**
 * Read a PNG or JPEG header far enough to get its pixel dimensions. Used to
 * price a job and to sanity-check what the model sent back, without pulling in
 * an image library or spinning up a canvas in the main process.
 */
export function imageSize(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (o) => view.getUint32(o, false);
  const u16 = (o) => view.getUint16(o, false);
  // PNG: 8-byte signature, then an IHDR chunk whose payload starts at 16.
  if (buf.length > 24 && u32(0) === 0x89504e47) {
    return { width: u32(16), height: u32(20), type: 'image/png' };
  }
  // JPEG: walk the marker segments to the first SOF.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      const len = u16(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf
        && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { height: u16(i + 5), width: u16(i + 7), type: 'image/jpeg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

export function megapixels(width, height) {
  return (width * height) / 1_000_000;
}

/** A short, filesystem-safe stamp for generated filenames. */
export function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
