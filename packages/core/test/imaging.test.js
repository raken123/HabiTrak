import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDataUrl, toDataUrl, base64Bytes, base64ToBytes, imageSize, megapixels, stamp } from '../imaging.js';

test('data URLs round-trip', () => {
  const url = toDataUrl('aGVsbG8=', 'image/png');
  assert.equal(url, 'data:image/png;base64,aGVsbG8=');
  assert.deepEqual(parseDataUrl(url), { mimeType: 'image/png', base64: 'aGVsbG8=' });
});

test('a non-base64 data URL is re-encoded rather than rejected', () => {
  const { base64 } = parseDataUrl('data:text/plain,hello%20world');
  assert.equal(new TextDecoder().decode(base64ToBytes(base64)), 'hello world');
});

test('anything that is not a data URL is refused', () => {
  assert.throws(() => parseDataUrl('https://example.org/a.png'), /Not a data URL/);
  assert.throws(() => parseDataUrl(''), /Not a data URL/);
});

test('base64Bytes counts padding correctly', () => {
  assert.equal(base64Bytes('AAAA'), 3);
  assert.equal(base64Bytes('AAA='), 2);
  assert.equal(base64Bytes('AA=='), 1);
});

test('PNG dimensions are read from the header', () => {
  const png = new Uint8Array(30);
  const view = new DataView(png.buffer);
  view.setUint32(0, 0x89504e47);
  view.setUint32(16, 1920);
  view.setUint32(20, 1080);
  assert.deepEqual(imageSize(png), { width: 1920, height: 1080, type: 'image/png' });
  assert.equal(megapixels(1920, 1080).toFixed(3), '2.074');
});

test('JPEG dimensions are found by walking the markers', () => {
  // SOI, an APP0 segment to walk past, then an SOF0 carrying the size.
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  assert.deepEqual(imageSize(bytes), { width: 800, height: 600, type: 'image/jpeg' });
});

test('an unrecognised buffer returns null instead of guessing', () => {
  assert.equal(imageSize(new Uint8Array([1, 2, 3, 4])), null);
});

test('stamp is filesystem-safe and sortable', () => {
  assert.match(stamp(new Date(Date.UTC(2026, 0, 2, 3, 4, 5))), /^\d{8}-\d{6}$/);
});
