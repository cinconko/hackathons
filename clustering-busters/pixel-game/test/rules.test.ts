import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addRings, bossStage, buyUpgrade, countRings, deathDrop, emptyWallet, formatTime, hitDamage, ITEMS, loadout,
  msUntilRetailer, msUntilRetailerLeaves, noUpgrades, pay, retailerVisit, rollRing, rollStock, seededRng,
  stageStartHp, TREASURY, walletValue, BOSS_MAX_HP, PLAYER_HP,
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

test('rings are money: classic 1, rare 5, super rare 20', () => {
  assert.equal(walletValue({ classic: 3, rare: 2, superRare: 1 }), 33);
  assert.deepEqual(addRings(emptyWallet(), ['rare', 'classic', 'rare']), { classic: 1, rare: 2, superRare: 0 });
});

test('paying uses the cheapest rings first and gives change in classic rings', () => {
  assert.deepEqual(pay({ classic: 10, rare: 1, superRare: 1 }, 6), { classic: 4, rare: 1, superRare: 1 });
  assert.deepEqual(pay({ classic: 2, rare: 1, superRare: 0 }, 6), { classic: 1, rare: 0, superRare: 0 });   // 2 + 5 = 7, change 1
  assert.deepEqual(pay({ classic: 0, rare: 0, superRare: 1 }, 8), { classic: 12, rare: 0, superRare: 0 });  // 20, change 12
  assert.equal(pay({ classic: 3, rare: 0, superRare: 0 }, 4), null);
  assert.deepEqual(pay({ classic: 1, rare: 0, superRare: 0 }, 0), { classic: 1, rare: 0, superRare: 0 });
});

test('paying never creates or loses value', () => {
  const rng = seededRng(3);
  for (let i = 0; i < 2000; i++) {
    const w = { classic: Math.floor(rng() * 12), rare: Math.floor(rng() * 4), superRare: Math.floor(rng() * 3) };
    const price = Math.floor(rng() * 70);
    const after = pay(w, price);
    if (walletValue(w) < price) { assert.equal(after, null); continue; }
    assert.ok(after);
    assert.equal(walletValue(after), walletValue(w) - price);
    for (const k of ['classic', 'rare', 'superRare'] as const) assert.ok(after[k] >= 0);
  }
});

test('village: buying raises the level, stops at max, needs enough rings', () => {
  const rich = { classic: 0, rare: 0, superRare: 5 };
  const a = buyUpgrade(rich, noUpgrades(), 'bow');
  assert.ok(a.ok);
  if (!a.ok) return;
  assert.equal(a.upgrades.bow, 1);
  assert.equal(walletValue(a.wallet), 100 - 6);
  assert.deepEqual(buyUpgrade(a.wallet, a.upgrades, 'bow'), { ok: false, reason: 'maxed' });
  assert.deepEqual(buyUpgrade(emptyWallet(), noUpgrades(), 'heart'), { ok: false, reason: 'too poor' });
});

test('loadout follows the upgrades', () => {
  assert.deepEqual(loadout(noUpgrades()), { weapons: ['fists', 'sword'], maxHp: PLAYER_HP, damageMul: 1, speedMul: 1 });
  const l = loadout({ bow: 1, bombs: 1, heart: 2, sharp: 2, boots: 1 });
  assert.deepEqual(l.weapons, ['fists', 'sword', 'bow', 'bombs']);
  assert.equal(l.maxHp, PLAYER_HP + 2);
  assert.ok(Math.abs(l.damageMul - 1.3) < 1e-9);
  assert.ok(Math.abs(l.speedMul - 1.1) < 1e-9);
});

test('treasury: 3 chests worth 50 classic rings', () => {
  assert.equal(TREASURY.length, 3);
  assert.equal(walletValue(addRings(emptyWallet(), TREASURY.flat())), 50);
});
