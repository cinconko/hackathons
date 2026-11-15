import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heroFrame, legRows, legSplit } from '../src/heroFrames.ts';

// A tiny 6x12 hero: rows 0-9 are the body (cols 1-4), rows 10-11 the legs (left foot col 1, right
// foot col 4, a gap between them), like the farmer and the knights.
const W = 6;
const H = 12;
function hero(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  const on = (x: number, y: number, v = 200) => { const i = (y * W + x) * 4; d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255; };
  for (let y = 0; y < 10; y++) for (let x = 1; x <= 4; x++) on(x, y, 100 + y);
  for (let y = 10; y < 12; y++) { on(1, y, 50); on(4, y, 60); }
  return d;
}
const a = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4 + 3];
const v = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4];

test('legs are the bottom sixth, at least two rows', () => {
  assert.equal(legRows(18), 3);
  assert.equal(legRows(12), 2);
  assert.equal(legRows(6), 2);
});

test('the legs split at the gap between the feet', () => {
  assert.equal(legSplit(hero(), W, H), 3);   // left foot at col 1, right at col 4: the right side starts at col 3
});

test('a step lifts one foot off the ground and leaves the other planted', () => {
  const left = heroFrame(hero(), W, H, 'left');
  assert.equal(a(left, 1, 11), 0, 'left foot left the ground');
  assert.equal(a(left, 1, 10), 255, 'left leg one row higher');
  assert.equal(a(left, 4, 11), 255, 'right foot still down');
  const right = heroFrame(hero(), W, H, 'right');
  assert.equal(a(right, 4, 11), 0);
  assert.equal(a(right, 1, 11), 255);
});

test('the breath sinks head and body by one row; the top row clears, the feet stay', () => {
  const b = heroFrame(hero(), W, H, 'breathe');
  assert.equal(a(b, 2, 0), 0, 'top row now empty');
  assert.equal(v(b, 2, 1), 100, 'row 0 of the body is now at row 1');
  assert.equal(a(b, 1, 11), 255);
  assert.equal(a(b, 4, 11), 255);
});

test('every frame keeps the drawing size and leaves the source untouched', () => {
  const src = hero();
  const copy = new Uint8ClampedArray(src);
  for (const f of ['left', 'right', 'breathe'] as const) assert.equal(heroFrame(src, W, H, f).length, W * H * 4);
  assert.deepEqual(src, copy);
});
