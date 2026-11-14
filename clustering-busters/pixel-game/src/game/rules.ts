// Pure game rules: no Phaser, no DOM. Everything the fight decides lives here, so it can be
// tuned in one place and tested with `npm test` (node --test, no extra packages).
//
//   boss HP ──► stage 1 / 2 / 3 ──► drop (ring + coins) on every stage change and on death
//   fight clock ──► fisherman away / here (every 30 s, stays 10 s) ──► 3 items in stock (coins)
//   rings = money ──► village upgrades (kept between runs) ──► loadout for the next fight
//   boss dies ──► key ──► hidden door ──► treasury chests full of rings

export type Rng = () => number;

// ---- Weapons --------------------------------------------------------------------------

export type WeaponId = 'fists' | 'sword' | 'bow' | 'bombs';
export type WeaponKind = 'melee' | 'shooting' | 'thrown';
export interface Weapon {
  readonly id: WeaponId;
  readonly name: string;
  readonly kind: WeaponKind;
  readonly damage: number;
  readonly cooldownMs: number;
  readonly range: number; // melee reach, or throw distance, in game pixels
}

export const WEAPONS: Readonly<Record<WeaponId, Weapon>> = {
  fists: { id: 'fists', name: 'Fists', kind: 'melee', damage: 1, cooldownMs: 220, range: 12 },
  sword: { id: 'sword', name: 'Sword', kind: 'melee', damage: 3, cooldownMs: 420, range: 20 },
  bow: { id: 'bow', name: 'Bow', kind: 'shooting', damage: 2, cooldownMs: 380, range: 200 },
  bombs: { id: 'bombs', name: 'Bombs', kind: 'thrown', damage: 6, cooldownMs: 1200, range: 60 },
};
export const WEAPON_ORDER: readonly WeaponId[] = ['fists', 'sword', 'bow', 'bombs'];
export const STARTING_WEAPONS: readonly WeaponId[] = ['fists', 'sword'];

// ---- Player ---------------------------------------------------------------------------

export const PLAYER_HP = 5;
export const PLAYER_SPEED = 80; // game pixels per second
export const INVULN_MS = 900;   // after a hit
export const STARTING_COINS = 5;

// ---- Rings ----------------------------------------------------------------------------

export type Rarity = 'classic' | 'rare' | 'superRare';
export const RARITY_ORDER: readonly Rarity[] = ['classic', 'rare', 'superRare'];

export interface RingInfo {
  readonly name: string;
  readonly color: number;
  readonly value: number; // worth, in classic rings
}
export const RINGS: Readonly<Record<Rarity, RingInfo>> = {
  classic: { name: 'Classic ring', color: 0xc8c8d0, value: 1 },
  rare: { name: 'Rare ring', color: 0x44aaff, value: 5 },
  superRare: { name: 'Super rare ring', color: 0xff55dd, value: 20 },
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

export interface Bonuses { damageMul: number; speedMul: number; bonusHp: number }

export function countRings(rings: readonly Rarity[]): Record<Rarity, number> {
  const out: Record<Rarity, number> = { classic: 0, rare: 0, superRare: 0 };
  for (const r of rings) out[r]++;
  return out;
}

/** Damage of one hit: weapon damage times the multiplier, never below 1. */
export function hitDamage(weapon: WeaponId, damageMul: number): number {
  return Math.max(1, Math.round(WEAPONS[weapon].damage * damageMul));
}

// ---- Boss: one boss, three stages split by HP thirds -----------------------------------

export type Stage = 1 | 2 | 3;
export type Pattern = 'ring' | 'aimed' | 'spiral';
export const BOSS_MAX_HP = 150;

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
  2: { name: 'Mossback, angry', color: 0xe08a2c, speed: 34, shotEveryMs: 1200, pattern: 'aimed', dashEveryMs: 0 },
  3: { name: 'Mossback, furious', color: 0xd83a3a, speed: 46, shotEveryMs: 650, pattern: 'spiral', dashEveryMs: 3200 },
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

export interface Drop { ring: Rarity; coins: number }
/** Leaving a stage drops one ring and a few coins. */
export function stageDrop(rng: Rng): Drop { return { ring: rollRing(rng), coins: 5 }; }
/** The boss's death drop: at least a rare ring. */
export function deathDrop(rng: Rng): Drop { return { ring: rollRing(rng, 'rare'), coins: 10 }; }
export const COIN_ON_HIT_CHANCE = 0.3;

// ---- Retailer: the fisherman -----------------------------------------------------------

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

export type ItemId = 'sword' | 'bow' | 'bombs' | 'potion' | 'bigPotion' | 'whetstone' | 'boots' | 'mysteryRing';
export interface Item {
  readonly name: string;
  readonly price: number;
  readonly desc: string;
  readonly weapon?: WeaponId; // buying it unlocks this weapon
}
export const ITEMS: Readonly<Record<ItemId, Item>> = {
  sword: { name: 'Sword', price: 8, desc: 'melee, 3 dmg', weapon: 'sword' },
  bow: { name: 'Bow', price: 10, desc: 'shoots arrows', weapon: 'bow' },
  bombs: { name: 'Bombs', price: 14, desc: 'thrown, big blast', weapon: 'bombs' },
  potion: { name: 'Potion', price: 4, desc: '+2 hearts' },
  bigPotion: { name: 'Big potion', price: 9, desc: 'all hearts' },
  whetstone: { name: 'Whetstone', price: 7, desc: '+20% damage' },
  boots: { name: 'Boots', price: 6, desc: '+15% speed' },
  mysteryRing: { name: 'Mystery ring', price: 15, desc: 'a random ring' },
};
export const ITEM_POOL = Object.keys(ITEMS) as ItemId[];
export const STOCK_SIZE = 3;

/** The 3 things the fisherman sells this visit. Weapons you already own are never offered. */
export function rollStock(rng: Rng, owned: readonly WeaponId[], count: number = STOCK_SIZE): ItemId[] {
  const pool = ITEM_POOL.filter((id) => {
    const w = ITEMS[id].weapon;
    return !w || !owned.includes(w);
  });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, count);
}

// ---- Rings are money: the wallet ----------------------------------------------------

export type Wallet = Record<Rarity, number>;
export const emptyWallet = (): Wallet => ({ classic: 0, rare: 0, superRare: 0 });

export function walletValue(w: Wallet): number {
  return RARITY_ORDER.reduce((sum, r) => sum + w[r] * RINGS[r].value, 0);
}

export function addRings(w: Wallet, rings: readonly Rarity[]): Wallet {
  const out = { ...w };
  for (const r of rings) out[r]++;
  return out;
}

/**
 * Pays `price` (in classic rings) from the wallet: cheapest rings first, and when a bigger
 * ring overpays, the change comes back as classic rings. null = not enough.
 */
export function pay(w: Wallet, price: number): Wallet | null {
  if (price < 0 || walletValue(w) < price) return null;
  const out = { ...w };
  let rest = price;
  for (const r of RARITY_ORDER) {
    if (rest <= 0) break;
    const v = RINGS[r].value;
    const use = Math.min(out[r], Math.ceil(rest / v));
    out[r] -= use;
    rest -= use * v;
  }
  out.classic += -rest; // change (rest is 0 or negative here)
  return out;
}

// ---- The village: permanent upgrades bought with rings --------------------------------

export type UpgradeId = 'bow' | 'bombs' | 'heart' | 'sharp' | 'boots';
export type Upgrades = Record<UpgradeId, number>; // level of each, 0 = not bought
export const noUpgrades = (): Upgrades => ({ bow: 0, bombs: 0, heart: 0, sharp: 0, boots: 0 });

export interface VillageItem { readonly name: string; readonly desc: string; readonly price: number; readonly max: number }
export const VILLAGE_ITEMS: Readonly<Record<UpgradeId, VillageItem>> = {
  bow: { name: 'Bow', desc: 'start fights with a bow', price: 6, max: 1 },
  bombs: { name: 'Bombs', desc: 'start fights with bombs', price: 12, max: 1 },
  heart: { name: 'Heart charm', desc: '+1 heart', price: 8, max: 3 },
  sharp: { name: 'Sharp edge', desc: '+15% damage', price: 10, max: 3 },
  boots: { name: 'Swift boots', desc: '+10% speed', price: 6, max: 2 },
};
export const VILLAGE_ORDER: readonly UpgradeId[] = ['bow', 'bombs', 'heart', 'sharp', 'boots'];

export type BuyResult =
  | { ok: true; wallet: Wallet; upgrades: Upgrades }
  | { ok: false; reason: 'maxed' | 'too poor' };

export function buyUpgrade(wallet: Wallet, upgrades: Upgrades, id: UpgradeId): BuyResult {
  const item = VILLAGE_ITEMS[id];
  if (upgrades[id] >= item.max) return { ok: false, reason: 'maxed' };
  const paid = pay(wallet, item.price);
  if (!paid) return { ok: false, reason: 'too poor' };
  return { ok: true, wallet: paid, upgrades: { ...upgrades, [id]: upgrades[id] + 1 } };
}

export interface Loadout { weapons: WeaponId[]; maxHp: number; damageMul: number; speedMul: number }

/** What you bring into the arena, from the village upgrades. */
export function loadout(u: Upgrades): Loadout {
  const weapons: WeaponId[] = [...STARTING_WEAPONS];
  if (u.bow > 0) weapons.push('bow');
  if (u.bombs > 0) weapons.push('bombs');
  return { weapons, maxHp: PLAYER_HP + u.heart, damageMul: 1 + 0.15 * u.sharp, speedMul: 1 + 0.1 * u.boots };
}

// ---- The treasury: behind the hidden door, opened with the boss's key ------------------

const many = (r: Rarity, n: number): Rarity[] => Array.from({ length: n }, () => r);
/** Three chests. Worth 6 + 14 + 30 = 50 classic rings. */
export const TREASURY: readonly (readonly Rarity[])[] = [
  many('classic', 6),
  [...many('classic', 4), ...many('rare', 2)],
  [...many('rare', 2), 'superRare'],
];

// ---- Fight result and helpers ----------------------------------------------------------

export interface FightResult { won: boolean; rings: Rarity[]; timeMs: number; coins: number }

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
