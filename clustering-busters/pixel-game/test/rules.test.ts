import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addRings, bossStage, buyItem, CATALOG, countRings, damageTaken, deathDrop, emptyWallet, equip, formatTime, hitDamage,
  item, itemsOfKind, loadout, msUntilRetailer, msUntilRetailerLeaves, pay, retailerVisit, RINGS, rollRing, rollStock,
  seededRng, stageStartHp, startingInventory, startingWallet, SUPPLIES, TREASURY, walletValue, weapon, BOSS_MAX_HP,
  rollCards, DRINKS, CARD_COUNT,
  type CatalogId,
} from '../src/game/rules.ts';

const fixed = (v: number) => () => v;

// ---- the chart -------------------------------------------------------------------------

test('catalog matches the team chart: [cz name, damage, cooldown s, price]', () => {
  const chart: Record<string, [string, number | undefined, number | undefined, number]> = {
    sling: ['prak', 5, 0.5, 100], javelin: ['oštěp', 10, 1, 120], bow: ['luk', 20, 2, 150], crossbow: ['kuše', 40, 4, 180], handCannon: ['píšťala', 60, 6, 200],
    dagger: ['dagger', 5, 0.3, 80], sword: ['meč', 15, 1, 120], axe: ['sekera', 30, 2, 150], mace: ['palcát', 60, 4, 200], warHammer: ['válečné kladivo', 75, 5, 220], spear: ['kopí', 90, 6, 250],
    fireball: ['fireball', 20, 2, 100], freeze: ['freeze', 20, 3, 120], poison: ['poison', 10, 10, 150], paralysis: ['paralyzace', undefined, 15, 150],
    push: ['push', 5, 6, 120], healthSuck: ['health suck', undefined, 30, 250], bomb: ['bomba', 100, 10, 300], shield: ['shield', undefined, 20, 300],
    leather: ['kůže', undefined, undefined, 50], copper: ['měděné', undefined, undefined, 75], bronze: ['bronz', undefined, undefined, 100],
    chainmail: ['kroužkové', undefined, undefined, 125], iron: ['železo', undefined, undefined, 150], steel: ['ocel', undefined, undefined, 200], magnetite: ['magnetit', undefined, undefined, 350],
  };
  assert.equal(CATALOG.length, Object.keys(chart).length);
  for (const [id, [cz, dmg, cd, price]] of Object.entries(chart)) {
    const it = item(id as CatalogId);
    assert.equal(it.cz, cz, id);
    assert.equal(it.damage, dmg, `${id} damage`);
    assert.equal(it.cooldownMs, cd === undefined ? undefined : cd * 1000, `${id} cooldown`);
    assert.equal(it.price, price, `${id} price`);
  }
  assert.deepEqual(itemsOfKind('armor').map((a) => a.armor), [0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75]);
  assert.ok(item('spear').reach! > item('sword').reach!, 'kopí: a bit more range');
});

test('the chart is balanced: melee ~15 dps, ranged ~10 dps', () => {
  for (const it of itemsOfKind('melee')) {
    const dps = it.damage! / (it.cooldownMs! / 1000);
    assert.ok(dps >= 15 && dps <= 17, `${it.id} ${dps}`);
  }
  for (const it of itemsOfKind('range')) assert.equal(it.damage! / (it.cooldownMs! / 1000), 10, it.id);
});

test('every price is a multiple of the classic ring, so change always works', () => {
  for (const it of CATALOG) assert.equal(it.price % RINGS.classic.value, 0, it.id);
  for (const s of Object.values(SUPPLIES)) assert.equal(s.price % RINGS.classic.value, 0, s.name);
});

test('weapons: fists are free, chart weapons keep their numbers', () => {
  assert.equal(weapon('fists').kind, 'melee');
  assert.deepEqual([weapon('sword').damage, weapon('sword').cooldownMs, weapon('sword').kind], [15, 1000, 'melee']);
  assert.equal(weapon('crossbow').kind, 'shooting');
  assert.equal(hitDamage(15, 1.2), 18);
  assert.equal(hitDamage(3, 0.1), 1);
});

test('armor takes its share of the damage; the shield blocks all; never below 1', () => {
  assert.equal(damageTaken(20, 0), 20);
  assert.equal(damageTaken(20, 0.5), 10);
  assert.equal(damageTaken(20, 0.75), 5);
  assert.equal(damageTaken(1, 0.75), 1);
  assert.equal(damageTaken(20, 0.3, true), 0);
});

// ---- rings and paying ------------------------------------------------------------------

test('rings are money: classic 5, rare 25, super rare 100; a new game has 100', () => {
  assert.equal(walletValue({ classic: 3, rare: 2, superRare: 1 }), 165);
  assert.equal(walletValue(startingWallet()), 100);
  assert.deepEqual(addRings(emptyWallet(), ['rare', 'classic', 'rare']), { classic: 1, rare: 2, superRare: 0 });
});

test('paying uses the cheapest rings first and gives change in classic rings', () => {
  assert.deepEqual(pay({ classic: 20, rare: 0, superRare: 0 }, 80), { classic: 4, rare: 0, superRare: 0 });
  assert.deepEqual(pay({ classic: 1, rare: 3, superRare: 0 }, 75), { classic: 1, rare: 0, superRare: 0 }); // 5 + 75 = 80, change 1 classic
  assert.deepEqual(pay({ classic: 0, rare: 0, superRare: 1 }, 75), { classic: 5, rare: 0, superRare: 0 });        // 100, change 25 = 5 classic
  assert.equal(pay({ classic: 3, rare: 0, superRare: 0 }, 20), null);
  assert.equal(pay({ classic: 9, rare: 0, superRare: 0 }, 7), null); // not a multiple of 5
});

test('paying never creates or loses value', () => {
  const rng = seededRng(3);
  for (let i = 0; i < 2000; i++) {
    const w = { classic: Math.floor(rng() * 30), rare: Math.floor(rng() * 6), superRare: Math.floor(rng() * 3) };
    const price = Math.floor(rng() * 80) * 5;
    const after = pay(w, price);
    if (walletValue(w) < price) { assert.equal(after, null); continue; }
    assert.ok(after);
    assert.equal(walletValue(after), walletValue(w) - price);
    for (const k of ['classic', 'rare', 'superRare'] as const) assert.ok(after[k] >= 0 && Number.isInteger(after[k]));
  }
});

// ---- the village shop ------------------------------------------------------------------

test('buying: once only, needs the rings, equips what you bought', () => {
  const r = buyItem(startingWallet(), startingInventory(), 'dagger');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(walletValue(r.wallet), 20);
  assert.equal(r.inventory.melee, 'dagger');
  assert.deepEqual(buyItem(r.wallet, r.inventory, 'dagger'), { ok: false, reason: 'owned' });
  assert.deepEqual(buyItem(r.wallet, r.inventory, 'sword'), { ok: false, reason: 'too poor' });
});

test('equip only what you own; loadout follows the inventory', () => {
  let inv = { ...startingInventory(), owned: ['sword', 'dagger', 'bow', 'steel', 'shield', 'fireball'] as CatalogId[] };
  inv = equip(equip(equip(inv, 'sword'), 'bow'), 'steel');
  assert.equal(equip(inv, 'spear'), inv); // not owned: unchanged
  const l = loadout(inv);
  assert.deepEqual(l.weapons, ['fists', 'sword', 'bow']);
  assert.deepEqual(l.specials, ['fireball', 'shield']); // chart order
  assert.equal(l.armor, 0.5);
  assert.deepEqual(loadout(startingInventory()).weapons, ['fists']);
});

// ---- boss, drops, fisherman, treasury ---------------------------------------------------

test('boss has 3 stages split by HP thirds', () => {
  assert.equal(bossStage(BOSS_MAX_HP), 1);
  assert.equal(bossStage(401), 1);
  assert.equal(bossStage(400), 2);
  assert.equal(bossStage(200), 3);
  for (const s of [1, 2, 3] as const) assert.equal(bossStage(stageStartHp(s)), s);
});

test('ring odds: 5% super rare, 25% rare, 70% classic; the death drop is at least rare', () => {
  assert.equal(rollRing(fixed(0.01)), 'superRare');
  assert.equal(rollRing(fixed(0.05)), 'rare');
  assert.equal(rollRing(fixed(0.3)), 'classic');
  assert.equal(deathDrop(fixed(0.9)).rings[0], 'rare');
  const rng = seededRng(7);
  const many = countRings(Array.from({ length: 20000 }, () => rollRing(rng)));
  assert.ok(Math.abs(many.superRare / 20000 - 0.05) < 0.01);
  assert.ok(Math.abs(many.rare / 20000 - 0.25) < 0.02);
});

test('fisherman: every 30 s for 10 s, 3 different supplies', () => {
  assert.equal(retailerVisit(29_999), 0);
  assert.equal(retailerVisit(30_000), 1);
  assert.equal(retailerVisit(40_000), 0);
  assert.equal(msUntilRetailer(45_000), 15_000);
  assert.equal(msUntilRetailerLeaves(31_000), 9_000);
  for (let seed = 0; seed < 100; seed++) {
    const s = rollStock(seededRng(seed));
    assert.equal(new Set(s).size, 3);
    for (const id of s) assert.ok(id in SUPPLIES);
  }
});

test('treasury: 3 chests worth 330 rings', () => {
  assert.equal(TREASURY.length, 3);
  assert.equal(walletValue(addRings(emptyWallet(), TREASURY.flat())), 330);
});

test('time format', () => {
  assert.equal(formatTime(83_400), '1:23');
});

test('merchant cards: 3 different chart items you do not own; fewer when nearly all bought', () => {
  for (let seed = 0; seed < 100; seed++) {
    const owned: CatalogId[] = ['sword', 'bow', 'leather'];
    const cards = rollCards(seededRng(seed), owned);
    assert.equal(cards.length, CARD_COUNT);
    assert.equal(new Set(cards).size, CARD_COUNT);
    for (const id of cards) assert.ok(!owned.includes(id), `offered owned ${id}`);
  }
  const allButTwo = CATALOG.slice(2).map((i) => i.id);
  assert.equal(rollCards(seededRng(1), allButTwo).length, 2);
  assert.notDeepEqual(rollCards(seededRng(1), []), rollCards(seededRng(2), []));
});

test('bar drinks cost a multiple of 5 and each does one thing', () => {
  for (const d of Object.values(DRINKS)) {
    assert.equal(d.price % RINGS.classic.value, 0, d.name);
    assert.equal([d.hp, d.damage, d.speed].filter((v) => v > 0).length, 1, d.name);
  }
});
