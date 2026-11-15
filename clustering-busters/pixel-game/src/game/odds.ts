// How random is Ringfall? Every chance in the game, worked out from the rules themselves
// (rules.ts), so the landing page can never show a number the game does not use. Pure, tested
// in test/odds.test.ts. Each fact has the sprite the page draws it with (the game's own textures).
import * as R from './rules.ts';   // the extension: the tests run this file in plain Node

export interface OddsRow { sprite: string; label: string; chance: number; note?: string }
export interface OddsGroup { id: string; title: string; blurb: string; rows: OddsRow[] }

/** Chance that at least one of `n` independent tries hits, each with chance `p`. */
export const atLeastOne = (p: number, n: number): number => 1 - (1 - p) ** n;

const classicShare = 1 - R.RING_ODDS.superRare - R.RING_ODDS.rare;
const CITY = 6;   // the biggest village level

export function oddsGroups(): OddsGroup[] {
  const robe: Record<R.MerchantKind, string> = { ranger: 'darkblue', smith: 'red', armorer: 'gray', alchemist: 'green', peddler: 'orange', special: 'special' };
  const classicMerchant = (1 - R.SPECIAL_MERCHANT_CHANCE) / R.CLASSIC_MERCHANTS.length;
  // the death drop: 2 rare-or-better + 1 rolled (+ classic); a rare-or-better roll is super rare as often as any roll
  const deathRolls = (level: number) => 3 + Math.round(4 * R.ringLuck(level)) - 4;
  const supplies = Object.keys(R.SUPPLIES) as R.SupplyId[];
  return [
    {
      id: 'rings', title: 'Every ring is a roll',
      blurb: 'Each ring Mossback drops is rolled the moment it falls.',
      rows: [
        { sprite: 'ring_classic', label: `${R.RINGS.classic.name} (worth ${R.RINGS.classic.value})`, chance: classicShare },
        { sprite: 'ring_rare', label: `${R.RINGS.rare.name} (worth ${R.RINGS.rare.value})`, chance: R.RING_ODDS.rare },
        { sprite: 'ring_superRare', label: `${R.RINGS.superRare.name} (worth ${R.RINGS.superRare.value})`, chance: R.RING_ODDS.superRare },
      ],
    },
    {
      id: 'boss', title: 'Shaking Mossback',
      blurb: 'Hits knock rings loose. Each stage he loses drops a guaranteed rare-or-better ring, and his last stand drops two.',
      rows: [
        { sprite: 'boss_1', label: 'A hit knocks a ring loose', chance: R.RING_ON_HIT_CHANCE, note: `${pct(R.RING_ON_HIT_CHANCE * R.ringLuck(CITY))} in Ringfall City` },
        { sprite: 'boss_nokey', label: 'His death drop holds a super rare', chance: atLeastOne(R.RING_ODDS.superRare, deathRolls(1)), note: `${pct(atLeastOne(R.RING_ODDS.superRare, deathRolls(CITY)))} in Ringfall City` },
      ],
    },
    {
      id: 'merchants', title: 'Who comes to the village?',
      blurb: 'After every fight a new merchant sets out his rug. His robe tells you what he sells.',
      rows: [
        ...R.CLASSIC_MERCHANTS.map((k) => ({ sprite: `merchant_${robe[k]}_0`, label: `The ${R.MERCHANT_NAMES[k]}`, chance: classicMerchant })),
        { sprite: 'merchant_special_0', label: 'The Special merchant (5 wares + a best deal)', chance: R.SPECIAL_MERCHANT_CHANCE },
        { sprite: 'chest', label: `His best deal: ${R.SPECIAL_DISCOUNTS.map((d) => `-${Math.round(d * 100)}%`).join(', ')}`, chance: 1 / R.SPECIAL_DISCOUNTS.length, note: 'each discount equally likely, when he comes' },
      ],
    },
    {
      id: 'fisher', title: 'The fisherman',
      blurb: `He comes to the pond every ${R.RETAILER_EVERY_MS / 1000} s of the fight and stays ${R.RETAILER_STAYS_MS / 1000} s, with ${R.STOCK_SIZE} of his ${supplies.length} supplies.`,
      rows: supplies.map((id) => ({ sprite: `supply_${id}`, label: `${R.SUPPLIES[id].name}: ${R.SUPPLIES[id].desc}`, chance: R.STOCK_SIZE / supplies.length, note: `${R.SUPPLIES[id].price} rings` })),
    },
    {
      id: 'village', title: 'Luck at home',
      blurb: `Spend rings and the village grows. Every level makes Mossback drop ${pct(R.RING_BONUS_PER_LEVEL)} more rings.`,
      rows: [
        { sprite: 'drop', label: 'Fall in the well and find a ring', chance: R.WELL_RING_CHANCE, note: 'once per visit' },
        { sprite: 'house_big', label: 'More rings in Ringfall City', chance: R.ringLuck(CITY) - 1, note: `x${R.ringLuck(CITY)}` },
      ],
    },
  ];
}

/** 0.0525 -> "5.3%", 0.25 -> "25%". */
export function pct(p: number): string {
  const v = p * 100;
  return `${Number.isInteger(Math.round(v * 10) / 10) ? Math.round(v) : (Math.round(v * 10) / 10).toFixed(1)}%`;
}

/** 0.05 -> "1 in 20". */
export const oneIn = (p: number): string => `1 in ${Math.round(1 / p)}`;
