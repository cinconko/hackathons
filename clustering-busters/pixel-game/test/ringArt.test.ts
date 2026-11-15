import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paintRing, RING_LOOKS, RING_PIXELS, RING_SIZE } from '../src/ringArt.ts';

test('the ring is a square of RING_SIZE and every pixel has a colour in every look', () => {
  assert.equal(RING_PIXELS.length, RING_SIZE);
  for (const row of RING_PIXELS) assert.equal(row.length, RING_SIZE);
  for (const look of Object.values(RING_LOOKS)) {
    let lit = 0;
    paintRing(look, (c) => { assert.equal(typeof c, 'number'); lit++; });
    assert.ok(lit > 20, 'a ring, not a dot');
  }
});

test('the rarities differ in their stone, so you can tell them apart', () => {
  const stones = new Set(Object.values(RING_LOOKS).map((l) => l.g));
  assert.equal(stones.size, 3);
});
