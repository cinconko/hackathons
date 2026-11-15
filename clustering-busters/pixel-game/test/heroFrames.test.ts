import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feet, heroFrame } from '../src/heroFrames.ts';

const W = 6;
const H = 12;
function hero(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  const on = (x: number, y: number, v: number) => { const i = (y * W + x) * 4; d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255; };
  for (let y = 0; y < 11; y++) for (let x = 1; x <= 4; x++) on(x, y, 100 + y);
  on(1, 11, 50);
  on(4, 11, 60);
  return d;
}
const a = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4 + 3];
const v = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4];

test('the feet are only the bottom rows with a gap between the legs, not the trousers', () => {
  assert.deepEqual(feet(hero(), W, H), { rows: 1, split: 3 });
});

test('a step lifts one foot and leaves the trousers and the other foot exactly as drawn', () => {
  const src = hero();
  const left = heroFrame(src, W, H, 'left');
  assert.equal(a(left, 1, 11), 0, 'left foot off the ground');
  assert.equal(v(left, 1, 10), 50, 'left foot one row higher');
  assert.equal(v(left, 4, 11), 60, 'right foot still down');
  for (let y = 0; y < 10; y++) for (let x = 0; x < W; x++) assert.equal(v(left, x, y), v(src, x, y), `body untouched at ${x},${y}`);
  for (let x = 2; x < W; x++) assert.equal(v(left, x, 10), v(src, x, 10), 'the rest of the hem untouched');
  const right = heroFrame(src, W, H, 'right');
  assert.equal(a(right, 4, 11), 0);
  assert.equal(v(right, 1, 11), 50);
});

test('a drawing with no gap between the feet is left alone', () => {
  const d = hero();
  d.set([255, 255, 255, 255], (11 * W + 2) * 4);
  d.set([255, 255, 255, 255], (11 * W + 3) * 4);
  assert.equal(feet(d, W, H), null);
  assert.deepEqual(heroFrame(d, W, H, 'left'), d);
});

test('every frame keeps the drawing size and leaves the source untouched', () => {
  const src = hero();
  const copy = new Uint8ClampedArray(src);
  for (const f of ['left', 'right'] as const) assert.equal(heroFrame(src, W, H, f).length, W * H * 4);
  assert.deepEqual(src, copy);
});
