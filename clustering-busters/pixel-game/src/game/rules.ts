// Pure game rules: no Phaser, no DOM. Everything the fight decides lives here, so it can be
// tuned in one place and tested with `npm test` (node --test, no extra packages).
//
//   the team's chart (CATALOG) ──► village merchant: buy once, equip ──► loadout for a fight
//   boss HP ──► stage 1 / 2 / 3 ──► drop rings on every stage change and on death
//   fight clock ──► fisherman away / here (every 30 s, stays 10 s) ──► 3 supplies in stock
//   boss dies ──► key ──► hidden door ──► treasury chests full of rings
//   rings are the only money (one wallet: village, fisherman, kept between runs)

export type Rng = () => number;

// ---- The catalog: the team's weapons chart ---------------------------------------------
// Source: the chart image "WhatsApp Image 2026-11-14 at 15.59.30.jpeg" (typ / zbraň /
// damage / cooldown / cena). Czech names kept in `cz` so it is easy to check against it.
// Every melee weapon there deals ~15 damage per second and every ranged one ~10: the choice
// is about feel (fast small hits or slow big ones), not power. Prices are in rings.

export type ItemKind = 'range' | 'melee' | 'special' | 'armor';

export type RangeId = 'sling' | 'javelin' | 'bow' | 'crossbow' | 'handCannon';
export type MeleeId = 'dagger' | 'sword' | 'axe' | 'mace' | 'warHammer' | 'spear';
export type SpecialId = 'fireball' | 'freeze' | 'poison' | 'paralysis' | 'push' | 'healthSuck' | 'bomb' | 'shield';
export type ArmorId = 'leather' | 'copper' | 'bronze' | 'chainmail' | 'iron' | 'steel' | 'magnetite';
export type CatalogId = RangeId | MeleeId | SpecialId | ArmorId;

export interface CatalogItem {
  readonly id: CatalogId;
  readonly kind: ItemKind;
  readonly name: string;
  readonly cz: string;           // the name in the chart
  readonly price: number;        // rings
  readonly damage?: number;
  readonly cooldownMs?: number;
  readonly reach?: number;       // melee: how far the swing reaches (game pixels)
  readonly speed?: number;       // range: projectile speed (game pixels per second)
  readonly armor?: number;       // armor: share of damage taken away (0.05 = -5 %)
  readonly desc: string;
}

export const CATALOG: readonly CatalogItem[] = [
  // range ("range")
  { id: 'sling', kind: 'range', name: 'Sling', cz: 'prak', price: 100, damage: 5, cooldownMs: 500, speed: 170, desc: 'fast stones' },
  { id: 'javelin', kind: 'range', name: 'Javelin', cz: 'oštěp', price: 120, damage: 10, cooldownMs: 1000, speed: 160, desc: 'thrown spear' },
  { id: 'bow', kind: 'range', name: 'Bow', cz: 'luk', price: 150, damage: 20, cooldownMs: 2000, speed: 220, desc: 'arrows' },
  { id: 'crossbow', kind: 'range', name: 'Crossbow', cz: 'kuše', price: 180, damage: 40, cooldownMs: 4000, speed: 260, desc: 'heavy bolts' },
  { id: 'handCannon', kind: 'range', name: 'Hand cannon', cz: 'píšťala', price: 200, damage: 60, cooldownMs: 6000, speed: 320, desc: 'one big shot' },
  // melee
  { id: 'dagger', kind: 'melee', name: 'Dagger', cz: 'dagger', price: 80, damage: 5, cooldownMs: 300, reach: 12, desc: 'very fast' },
  { id: 'sword', kind: 'melee', name: 'Sword', cz: 'meč', price: 120, damage: 15, cooldownMs: 1000, reach: 18, desc: 'all-rounder' },
  { id: 'axe', kind: 'melee', name: 'Axe', cz: 'sekera', price: 150, damage: 30, cooldownMs: 2000, reach: 18, desc: 'heavy chop' },
  { id: 'mace', kind: 'melee', name: 'Mace', cz: 'palcát', price: 200, damage: 60, cooldownMs: 4000, reach: 18, desc: 'crushing' },
  { id: 'warHammer', kind: 'melee', name: 'War hammer', cz: 'válečné kladivo', price: 220, damage: 75, cooldownMs: 5000, reach: 20, desc: 'slow, huge' },
  { id: 'spear', kind: 'melee', name: 'Spear', cz: 'kopí', price: 250, damage: 90, cooldownMs: 6000, reach: 30, desc: 'longer reach' },
  // specials ("speciální"): number keys in the fight
  { id: 'fireball', kind: 'special', name: 'Fireball', cz: 'fireball', price: 100, damage: 20, cooldownMs: 2000, desc: '20 dmg' },
  { id: 'freeze', kind: 'special', name: 'Freeze', cz: 'freeze', price: 120, damage: 20, cooldownMs: 3000, desc: '20 + slows him' },
  { id: 'poison', kind: 'special', name: 'Poison', cz: 'poison', price: 150, damage: 10, cooldownMs: 10000, desc: '10 + 1/s for 30 s' },
  { id: 'paralysis', kind: 'special', name: 'Paralysis', cz: 'paralyzace', price: 150, cooldownMs: 15000, desc: 'no attacks for 5 s' },
  { id: 'push', kind: 'special', name: 'Push', cz: 'push', price: 120, damage: 5, cooldownMs: 6000, desc: '5 + knocks him back' },
  { id: 'healthSuck', kind: 'special', name: 'Health suck', cz: 'health suck', price: 250, cooldownMs: 30000, desc: 'steal 2 hp/s' },
  { id: 'bomb', kind: 'special', name: 'Bomb', cz: 'bomba', price: 300, damage: 100, cooldownMs: 10000, desc: '100, 2 s fuse' },
  { id: 'shield', kind: 'special', name: 'Shield', cz: 'shield', price: 300, cooldownMs: 20000, desc: 'blocks all for 5 s' },
  // armor ("brnění"): one worn at a time
  { id: 'leather', kind: 'armor', name: 'Leather', cz: 'kůže', price: 50, armor: 0.05, desc: '-5% damage' },
  { id: 'copper', kind: 'armor', name: 'Copper', cz: 'měděné', price: 75, armor: 0.1, desc: '-10% damage' },
  { id: 'bronze', kind: 'armor', name: 'Bronze', cz: 'bronz', price: 100, armor: 0.15, desc: '-15% damage' },
  { id: 'chainmail', kind: 'armor', name: 'Chainmail', cz: 'kroužkové', price: 125, armor: 0.2, desc: '-20% damage' },
  { id: 'iron', kind: 'armor', name: 'Iron', cz: 'železo', price: 150, armor: 0.3, desc: '-30% damage' },
  { id: 'steel', kind: 'armor', name: 'Steel', cz: 'ocel', price: 200, armor: 0.5, desc: '-50% damage' },
  { id: 'magnetite', kind: 'armor', name: 'Magnetite', cz: 'magnetit', price: 350, armor: 0.75, desc: '-75% damage' },
];

export const ITEM_KINDS: readonly ItemKind[] = ['range', 'melee', 'special', 'armor'];
export const KIND_NAMES: Readonly<Record<ItemKind, string>> = { range: 'RANGE', melee: 'MELEE', special: 'SPECIAL', armor: 'ARMOR' };

const BY_ID = new Map(CATALOG.map((i) => [i.id, i]));
export function item(id: CatalogId): CatalogItem {
  const it = BY_ID.get(id);
  if (!it) throw new Error(`unknown item ${id}`);
  return it;
}
export const itemsOfKind = (kind: ItemKind) => CATALOG.filter((i) => i.kind === kind);

// Special effects: the chart's numbers, plus what the chart leaves open (marked "ours").
export const SPECIAL = {
  freezeSlowMs: 4000,    // ours: how long the slow lasts
  freezeFactor: 0.5,     // ours: he moves at half speed and shoots half as often
  poisonTickDmg: 1,      // 1/s
  poisonMs: 30_000,      // for 30 s
  paralysisMs: 5000,     // no attacks for 5 s
  pushDistance: 70,      // ours: how far he is pushed
  pushRadius: 60,        // ours: he must be this close
  suckPerSec: 2,         // 2 hp/s from him to you
  suckMs: 10_000,        // ours: for 10 s
  bombFuseMs: 2000,      // 2 s timer
  bombRadius: 28,        // ours
  bombThrow: 60,         // ours: how far you throw it
  shieldMs: 5000,        // blocks 100 % for 5 s
} as const;

// ---- Weapons in the fight --------------------------------------------------------------

/** Fists are always there and free (not in the chart). */
export type WeaponId = 'fists' | MeleeId | RangeId;
export interface Weapon {
  readonly id: WeaponId;
  readonly name: string;
  readonly kind: 'melee' | 'shooting';
  readonly damage: number;
  readonly cooldownMs: number;
  readonly reach: number;   // melee reach
  readonly speed: number;   // projectile speed (shooting)
}
export const FISTS: Weapon = { id: 'fists', name: 'Fists', kind: 'melee', damage: 3, cooldownMs: 350, reach: 12, speed: 0 };

export function weapon(id: WeaponId): Weapon {
  if (id === 'fists') return FISTS;
  const it = item(id);
  return {
    id, name: it.name, kind: it.kind === 'melee' ? 'melee' : 'shooting',
    damage: it.damage ?? 0, cooldownMs: it.cooldownMs ?? 1000, reach: it.reach ?? 0, speed: it.speed ?? 0,
  };
}

/** Damage of one hit: weapon damage times the multiplier, never below 1. */
export function hitDamage(base: number, damageMul: number): number {
  return Math.max(1, Math.round(base * damageMul));
}

// ---- Player ----------------------------------------------------------------------------

export const PLAYER_HP = 100;
export const PLAYER_SPEED = 80;  // game pixels per second
export const INVULN_MS = 900;    // after a hit
export const BULLET_DMG = 12;    // a boss bullet
export const CONTACT_DMG = 20;   // touching him (or his dash)

/** Damage after armor; a shield blocks everything. Never below 1 unless shielded. */
export function damageTaken(raw: number, armor: number, shielded = false): number {
  if (shielded) return 0;
  return Math.max(1, Math.round(raw * (1 - armor)));
}

// ---- Rings -----------------------------------------------------------------------------

export type Rarity = 'classic' | 'rare' | 'superRare';
export const RARITY_ORDER: readonly Rarity[] = ['classic', 'rare', 'superRare'];

export interface RingInfo { readonly name: string; readonly color: number; readonly value: number }
/** Values are multiples of 5 because every price in the chart is: change always works out. */
export const RINGS: Readonly<Record<Rarity, RingInfo>> = {
  classic: { name: 'Classic ring', color: 0xc8c8d0, value: 5 },
  rare: { name: 'Rare ring', color: 0x44aaff, value: 25 },
  superRare: { name: 'Super rare ring', color: 0xff55dd, value: 100 },
};

// Drop odds: 5 % super rare, 25 % rare, the rest classic.
export const RING_ODDS = { superRare: 0.05, rare: 0.25 } as const;

/** Rolls a ring. `floor` is the lowest rarity allowed (the final boss drop is at least rare). */
export function rollRing(rng: Rng, floor: Rarity = 'classic'): Rarity {
  const r = rng();
  const rolled: Rarity = r < RING_ODDS.superRare ? 'superRare'
    : r < RING_ODDS.superRare + RING_ODDS.rare ? 'rare'
      : 'classic';
  return RARITY_ORDER.indexOf(rolled) >= RARITY_ORDER.indexOf(floor) ? rolled : floor;
}

export function countRings(rings: readonly Rarity[]): Record<Rarity, number> {
  const out: Record<Rarity, number> = { classic: 0, rare: 0, superRare: 0 };
  for (const r of rings) out[r]++;
  return out;
}

// ---- The wallet ------------------------------------------------------------------------

export type Wallet = Record<Rarity, number>;
export const emptyWallet = (): Wallet => ({ classic: 0, rare: 0, superRare: 0 });
/** A new game starts with 100 rings: enough for the dagger, the sling or leather armor. */
export const startingWallet = (): Wallet => ({ classic: 20, rare: 0, superRare: 0 });

export function walletValue(w: Wallet): number {
  return RARITY_ORDER.reduce((sum, r) => sum + w[r] * RINGS[r].value, 0);
}

export function addRings(w: Wallet, rings: readonly Rarity[]): Wallet {
  const out = { ...w };
  for (const r of rings) out[r]++;
  return out;
}

/**
 * Pays `price` rings from the wallet: cheapest rings first, and when a bigger ring overpays,
 * the change comes back as classic rings. null = not enough, or a price that is not a
 * multiple of the classic ring's value (no exact change possible).
 */
export function pay(w: Wallet, price: number): Wallet | null {
  const unit = RINGS.classic.value;
  if (price < 0 || price % unit !== 0 || walletValue(w) < price) return null;
  const out = { ...w };
  let rest = price;
  for (const r of RARITY_ORDER) {
    if (rest <= 0) break;
    const v = RINGS[r].value;
    const use = Math.min(out[r], Math.ceil(rest / v));
    out[r] -= use;
    rest -= use * v;
  }
  out.classic += -rest / unit; // change (rest is 0 or negative here)
  return out;
}

// ---- Inventory: what you bought, what you wear -----------------------------------------

export interface Inventory {
  owned: CatalogId[];
  melee: MeleeId | null;   // equipped
  range: RangeId | null;
  armor: ArmorId | null;
}
export const startingInventory = (): Inventory => ({ owned: [], melee: null, range: null, armor: null });

export type BuyResult = { ok: true; wallet: Wallet; inventory: Inventory } | { ok: false; reason: 'owned' | 'too poor' };

/** Buy an item. A new weapon or armor is equipped at once (you just bought it). */
export function buyItem(wallet: Wallet, inv: Inventory, id: CatalogId): BuyResult {
  if (inv.owned.includes(id)) return { ok: false, reason: 'owned' };
  const paid = pay(wallet, item(id).price);
  if (!paid) return { ok: false, reason: 'too poor' };
  return { ok: true, wallet: paid, inventory: equip({ ...inv, owned: [...inv.owned, id] }, id) };
}

/** Equip an owned weapon or armor in its slot. Specials need no equipping. */
export function equip(inv: Inventory, id: CatalogId): Inventory {
  if (!inv.owned.includes(id)) return inv;
  const k = item(id).kind;
  if (k === 'melee') return { ...inv, melee: id as MeleeId };
  if (k === 'range') return { ...inv, range: id as RangeId };
  if (k === 'armor') return { ...inv, armor: id as ArmorId };
  return inv;
}

// ---- The merchant's cards --------------------------------------------------------------

export const CARD_COUNT = 3;

/**
 * Deals the merchant's cards: random chart items you do not own yet (fewer when nearly
 * everything is bought). New cards every time you come back from the arena.
 */
export function rollCards(rng: Rng, owned: readonly CatalogId[], count: number = CARD_COUNT): CatalogId[] {
  const pool = CATALOG.map((i) => i.id).filter((id) => !owned.includes(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, count);
}

// ---- The bar: one drink for the next fight ---------------------------------------------

export type DrinkId = 'ale' | 'mead' | 'cider';
export interface Drink { readonly name: string; readonly price: number; readonly desc: string; readonly hp: number; readonly damage: number; readonly speed: number }
export const DRINKS: Readonly<Record<DrinkId, Drink>> = {
  ale: { name: 'Ale', price: 25, desc: '+20 max hp', hp: 20, damage: 0, speed: 0 },
  mead: { name: 'Mead', price: 40, desc: '+15% damage', hp: 0, damage: 0.15, speed: 0 },
  cider: { name: 'Cider', price: 30, desc: '+10% speed', hp: 0, damage: 0, speed: 0.1 },
};
export const DRINK_ORDER: readonly DrinkId[] = ['ale', 'mead', 'cider'];

// ---- The village grows: rings spent in the village build it out ----------------------

export interface VillageLevel { readonly name: string; readonly at: number }
/** Total rings spent at the merchant and the bar unlock the next level. */
export const VILLAGE_LEVELS: readonly VillageLevel[] = [
  { name: 'Camp', at: 0 },
  { name: 'Hamlet', at: 150 },
  { name: 'Village', at: 400 },
  { name: 'Market town', at: 800 },
  { name: 'Town', at: 1400 },
  { name: 'Ringfall City', at: 2200 },
];

/** 1-based village level for this much spending. */
export function villageLevel(spent: number): number {
  let level = 1;
  VILLAGE_LEVELS.forEach((l, i) => { if (spent >= l.at) level = i + 1; });
  return level;
}

/** Where you are on the way to the next level (next = null at the top). */
export function villageProgress(spent: number): { level: number; name: string; next: number | null; frac: number } {
  const level = villageLevel(spent);
  const cur = VILLAGE_LEVELS[level - 1];
  const nxt = VILLAGE_LEVELS[level] ?? null;
  return { level, name: cur.name, next: nxt ? nxt.at : null, frac: nxt ? (spent - cur.at) / (nxt.at - cur.at) : 1 };
}

// ---- The well --------------------------------------------------------------------------

/** Chance of finding a ring at the bottom when you fall in (once per village visit). */
export const WELL_RING_CHANCE = 0.35;

export interface Loadout {
  weapons: WeaponId[];       // fists, then the equipped melee and ranged weapon
  specials: SpecialId[];     // every owned special, in chart order (keys 1..8)
  armor: number;             // share of damage taken away
  maxHp: number;
}

export function loadout(inv: Inventory): Loadout {
  const weapons: WeaponId[] = ['fists'];
  if (inv.melee) weapons.push(inv.melee);
  if (inv.range) weapons.push(inv.range);
  const specials = itemsOfKind('special').filter((i) => inv.owned.includes(i.id)).map((i) => i.id as SpecialId);
  return { weapons, specials, armor: inv.armor ? item(inv.armor).armor ?? 0 : 0, maxHp: PLAYER_HP };
}

// ---- Boss: one boss, three stages split by HP thirds -----------------------------------

export type Stage = 1 | 2 | 3;
export type Pattern = 'ring' | 'aimed' | 'spiral';
export const BOSS_MAX_HP = 600;      // ~1 minute with the chart's ~15 dps melee weapons
export const TELEGRAPH_MS = 450;     // aimed shots and dashes are shown as a red line first

export interface StageInfo {
  readonly name: string;
  readonly color: number;
  readonly speed: number;
  readonly shotEveryMs: number;
  readonly pattern: Pattern;
  readonly dashEveryMs: number; // 0 = never dashes
}
export const STAGES: Readonly<Record<Stage, StageInfo>> = {
  1: { name: 'Mossback', color: 0x5fbf4a, speed: 22, shotEveryMs: 1800, pattern: 'ring', dashEveryMs: 0 },
  2: { name: 'Mossback, angry', color: 0xe08a2c, speed: 34, shotEveryMs: 1400, pattern: 'aimed', dashEveryMs: 0 },
  3: { name: 'Mossback, furious', color: 0xd83a3a, speed: 46, shotEveryMs: 800, pattern: 'spiral', dashEveryMs: 3200 },
};

export function bossStage(hp: number, maxHp: number = BOSS_MAX_HP): Stage {
  if (hp > (maxHp * 2) / 3) return 1;
  if (hp > maxHp / 3) return 2;
  return 3;
}

/** Highest HP of a stage, used to start a fight in a later stage (dev hook). */
export function stageStartHp(stage: Stage, maxHp: number = BOSS_MAX_HP): number {
  return stage === 1 ? maxHp : stage === 2 ? Math.floor((maxHp * 2) / 3) : Math.floor(maxHp / 3);
}

export interface Drop { rings: Rarity[] }
/** Leaving a stage drops a rolled ring and two classic ones. */
export function stageDrop(rng: Rng): Drop { return { rings: [rollRing(rng), 'classic', 'classic'] }; }
/** The boss's death drop: a ring that is at least rare, and three classic ones. */
export function deathDrop(rng: Rng): Drop { return { rings: [rollRing(rng, 'rare'), 'classic', 'classic', 'classic'] }; }
/** Chance that a hit knocks a classic ring loose. */
export const RING_ON_HIT_CHANCE = 0.15;

// ---- Retailer: the fisherman, selling supplies -----------------------------------------

export const RETAILER_EVERY_MS = 30_000;
export const RETAILER_STAYS_MS = 10_000;

/** Which visit is happening at this fight time: 0 while he is away, then 1, 2, 3... */
export function retailerVisit(fightMs: number): number {
  if (fightMs < RETAILER_EVERY_MS) return 0;
  return fightMs % RETAILER_EVERY_MS < RETAILER_STAYS_MS ? Math.floor(fightMs / RETAILER_EVERY_MS) : 0;
}

/** Ms until he arrives (0 while he is here). */
export function msUntilRetailer(fightMs: number): number {
  return retailerVisit(fightMs) > 0 ? 0 : RETAILER_EVERY_MS - (fightMs % RETAILER_EVERY_MS);
}

/** Ms until he leaves (0 while he is away). */
export function msUntilRetailerLeaves(fightMs: number): number {
  return retailerVisit(fightMs) > 0 ? RETAILER_STAYS_MS - (fightMs % RETAILER_EVERY_MS) : 0;
}

export type SupplyId = 'potion' | 'bigPotion' | 'whetstone' | 'boots';
export interface Supply { readonly name: string; readonly price: number; readonly desc: string }
/** The fisherman's supplies (weapons are in the village now). Prices in rings, this fight only. */
export const SUPPLIES: Readonly<Record<SupplyId, Supply>> = {
  potion: { name: 'Potion', price: 30, desc: '+30 hp' },
  bigPotion: { name: 'Big potion', price: 75, desc: 'full hp' },
  whetstone: { name: 'Whetstone', price: 60, desc: '+20% damage' },
  boots: { name: 'Boots', price: 50, desc: '+15% speed' },
};
export const SUPPLY_POOL = Object.keys(SUPPLIES) as SupplyId[];
export const STOCK_SIZE = 3;

/** The 3 supplies the fisherman has this visit. */
export function rollStock(rng: Rng, count: number = STOCK_SIZE): SupplyId[] {
  const pool = [...SUPPLY_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, count);
}

// ---- The treasury: behind the hidden door, opened with the boss's key ------------------

const many = (r: Rarity, n: number): Rarity[] => Array.from({ length: n }, () => r);
/** Three chests. Worth 50 + 130 + 150 = 330 rings. */
export const TREASURY: readonly (readonly Rarity[])[] = [
  many('classic', 10),
  [...many('classic', 6), ...many('rare', 4)],
  [...many('rare', 2), 'superRare'],
];

// ---- Fight result and helpers ----------------------------------------------------------

/** found = rings picked up this run (shown on the result screen); wallet = what you own now. */
export interface FightResult { won: boolean; found: Rarity[]; wallet: Wallet; timeMs: number }

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Small seeded RNG (mulberry32) for repeatable tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
