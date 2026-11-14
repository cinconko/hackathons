import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bossStage, countRings, deathDrop, formatTime, hitDamage, ITEMS, msUntilRetailer, msUntilRetailerLeaves,
  retailerVisit, ringBonuses, rollRing, rollStock, seededRng, stageStartHp, BOSS_MAX_HP,
} from '../src/game/rules.ts';

const fixed = (v: number) => () => v;

test('boss has 3 stages split by HP thirds', () => {
  assert.equal(bossStage(150), 1);
  assert.equal(bossStage(101), 1);
  assert.equal(bossStage(100), 2);
  assert.equal(bossStage(51), 2);
  assert.equal(bossStage(50), 3);
  assert.equal(bossStage(0), 3);
  for (const s of [1, 2, 3] as const) assert.equal(bossStage(stageStartHp(s)), s);
  assert.equal(stageStartHp(1), BOSS_MAX_HP);
});

test('rings: 5% super rare, 25% rare, 70% classic', () => {
  assert.equal(rollRing(fixed(0.01)), 'superRare');
  assert.equal(rollRing(fixed(0.049)), 'superRare');
  assert.equal(rollRing(fixed(0.05)), 'rare');
  assert.equal(rollRing(fixed(0.29)), 'rare');
  assert.equal(rollRing(fixed(0.3)), 'classic');
  assert.equal(rollRing(fixed(0.99)), 'classic');
});

test('rings: a floor raises low rolls, the death drop is at least rare', () => {
  assert.equal(rollRing(fixed(0.9), 'rare'), 'rare');
  assert.equal(rollRing(fixed(0.01), 'rare'), 'superRare');
  assert.equal(deathDrop(fixed(0.9)).ring, 'rare');
});

test('rings: odds hold over many rolls', () => {
  const rng = seededRng(7);
  const many = countRings(Array.from({ length: 20000 }, () => rollRing(rng)));
  assert.equal(many.classic + many.rare + many.superRare, 20000);
  assert.ok(Math.abs(many.superRare / 20000 - 0.05) < 0.01, `super rare ${many.superRare}`);
  assert.ok(Math.abs(many.rare / 20000 - 0.25) < 0.02, `rare ${many.rare}`);
});

test('ring bonuses add up', () => {
  assert.deepEqual(ringBonuses([]), { damageMul: 1, speedMul: 1, bonusHp: 0 });
  const b = ringBonuses(['classic', 'rare', 'superRare']);
  assert.ok(Math.abs(b.damageMul - 1.85) < 1e-9);
  assert.ok(Math.abs(b.speedMul - 1.25) < 1e-9);
  assert.equal(b.bonusHp, 1);
});

test('damage is weapon damage times the multiplier, never below 1', () => {
  assert.equal(hitDamage('fists', 1), 1);
  assert.equal(hitDamage('fists', 0.1), 1);
  assert.equal(hitDamage('sword', 1.5), 5);
  assert.equal(hitDamage('bombs', 1), 6);
});

test('fisherman comes every 30 s and stays 10 s', () => {
  assert.equal(retailerVisit(0), 0);
  assert.equal(retailerVisit(29_999), 0);
  assert.equal(retailerVisit(30_000), 1);
  assert.equal(retailerVisit(39_999), 1);
  assert.equal(retailerVisit(40_000), 0);
  assert.equal(retailerVisit(60_000), 2);
  assert.equal(msUntilRetailer(0), 30_000);
  assert.equal(msUntilRetailer(45_000), 15_000);
  assert.equal(msUntilRetailer(31_000), 0);
  assert.equal(msUntilRetailerLeaves(31_000), 9_000);
  assert.equal(msUntilRetailerLeaves(45_000), 0);
});

test('fisherman sells 3 different items and never a weapon you own', () => {
  for (let seed = 0; seed < 200; seed++) {
    const stock = rollStock(seededRng(seed), ['fists', 'sword', 'bow']);
    assert.equal(stock.length, 3);
    assert.equal(new Set(stock).size, 3);
    for (const id of stock) assert.ok(!['sword', 'bow'].includes(ITEMS[id].weapon ?? ''), `offered owned ${id}`);
  }
  assert.deepEqual(rollStock(seededRng(42), ['fists']), rollStock(seededRng(42), ['fists']));
});

test('time format', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(83_400), '1:23');
});
