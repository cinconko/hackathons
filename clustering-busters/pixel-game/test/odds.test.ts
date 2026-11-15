import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atLeastOne, oddsGroups, oneIn, pct } from '../src/game/odds.ts';

const group = (id: string) => oddsGroups().find((g) => g.id === id)!;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('ring rarities and merchants each add up to 100%', () => {
  assert.ok(Math.abs(sum(group('rings').rows.map((r) => r.chance)) - 1) < 1e-9);
  const merchants = group('merchants').rows.filter((r) => r.sprite.startsWith('merchant_'));
  assert.equal(merchants.length, 6);
  assert.ok(Math.abs(sum(merchants.map((r) => r.chance)) - 1) < 1e-9);
});

test('the numbers the page shows', () => {
  assert.equal(pct(0.7), '70%');
  assert.equal(pct(0.2625), '26.3%');
  assert.equal(oneIn(0.05), '1 in 20');
  assert.ok(Math.abs(atLeastOne(0.05, 3) - 0.142625) < 1e-9);
  for (const g of oddsGroups()) for (const r of g.rows) assert.ok(r.chance > 0 && r.chance <= 1, `${g.id}: ${r.label}`);
});
