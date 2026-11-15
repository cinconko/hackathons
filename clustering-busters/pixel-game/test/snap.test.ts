import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ON_FROM, snapAlpha } from '../src/snap.ts';

test('text pixels are snapped fully on or fully off, colours kept (no grey fog when scaled up)', () => {
  const d = new Uint8ClampedArray([255, 204, 68, 30, 255, 204, 68, ON_FROM - 1, 255, 204, 68, ON_FROM, 255, 204, 68, 255]);
  snapAlpha(d);
  assert.deepEqual([d[3], d[7], d[11], d[15]], [0, 0, 255, 255]);
  assert.deepEqual([d[8], d[9], d[10]], [255, 204, 68]);
});

test("the font's faint fringe stays off (an O must not grow a tail and read as Q)", () => {
  const d = new Uint8ClampedArray([255, 255, 255, 87, 255, 255, 255, 250]);
  snapAlpha(d);
  assert.deepEqual([d[3], d[7]], [0, 255]);
});
