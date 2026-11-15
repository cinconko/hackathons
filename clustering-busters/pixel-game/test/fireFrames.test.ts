import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fireFrame, flame, FLICKER } from '../src/fireFrames.ts';

const W = 7;
const H = 8;
function fire(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, r: number, g: number, b: number) => d.set([r, g, b, 255], (y * W + x) * 4);
  put(3, 0, 255, 200, 60);
  for (let x = 2; x <= 4; x++) put(x, 1, 255, 150, 40);
  for (let y = 2; y <= 4; y++) for (let x = 1; x <= 5; x++) put(x, y, 240, 120, 30);
  for (let y = 5; y < H; y++) for (let x = 0; x < W; x++) put(x, y, 110, 60, 40);
  put(0, 6, 230, 140, 60);
  return d;
}
const px = (d: Uint8ClampedArray, x: number, y: number) => [...d.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];
const rowsFrom = (d: Uint8ClampedArray, y: number) => [...d.subarray(y * W * 4)];

test('the flame is found above the logs; the logs are never flame', () => {
  const f = flame(fire(), W, H)!;
  assert.equal(f.top, 0);
  assert.equal(f.base, 5);
  assert.equal(f.mask[6 * W + 0], 0, 'the orange log end is not flame');
});

test('every frame leaves the logs exactly as drawn', () => {
  const src = fire();
  for (const [frame] of FLICKER) assert.deepEqual(rowsFrom(fireFrame(src, W, H, frame), 5), rowsFrom(src, 5), frame);
});

test('the tip leans left and right; the dip removes the top row; nothing changes size', () => {
  const src = fire();
  const left = fireFrame(src, W, H, 'left');
  assert.equal(px(left, 2, 0)[3], 255); assert.equal(px(left, 3, 0)[3], 0);
  const right = fireFrame(src, W, H, 'right');
  assert.equal(px(right, 4, 0)[3], 255); assert.equal(px(right, 3, 0)[3], 0);
  const low = fireFrame(src, W, H, 'low');
  assert.equal(px(low, 3, 0)[3], 0); assert.deepEqual(px(low, 3, 1), px(src, 3, 1));
  for (const [frame] of FLICKER) assert.equal(fireFrame(src, W, H, frame).length, src.length);
});
