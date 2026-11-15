// The ring, drawn once for everyone: the game's pickups (boot.ts makes ring_classic, ring_rare,
// ring_superRare from it) and the website's logo (src/landing/wordmark.ts) use the same pixels.
//
// A 9x9 ring seen from the front: a round band lit from the top left, a faceted stone set on top.
// The band and stone colours tell the rarity: classic is all silver with a pearl, rare is gold
// with a blue stone, super rare gold with a pink one. Pure data, no Phaser: easy to test and reuse.

export const RING_SIZE = 9;

/** w/g/d: stone shine, stone, stone shadow. H/B/D: band light, band, band shadow. '.' is empty. */
export const RING_PIXELS = [
  '...wgd...',
  '..wgggd..',
  '...dgd...',
  '..HBBBD..',
  '.HB...BD.',
  '.H.....D.',
  '.H.....D.',
  '.BD...DD.',
  '..DDDDD..',
] as const;

export type RingPart = 'w' | 'g' | 'd' | 'H' | 'B' | 'D';
export type RingLook = Record<RingPart, number>;

const SILVER = { H: 0xffffff, B: 0xc8c8d0, D: 0x6e6e7c };
const GOLD = { H: 0xfff3c4, B: 0xffcc44, D: 0xb8862a };

/** The game's three rings, by rarity (src/game/rules.ts RARITY_ORDER). */
export const RING_LOOKS: Record<'classic' | 'rare' | 'superRare', RingLook> = {
  classic: { ...SILVER, w: 0xffffff, g: 0xe4e4ec, d: 0x9a9aa8 },
  rare: { ...GOLD, w: 0xd2efff, g: 0x44aaff, d: 0x1f5fa6 },
  superRare: { ...GOLD, w: 0xffffff, g: 0xff55dd, d: 0xa02a8a },
};

/** Calls `dot` for every lit pixel of the ring in the given look. */
export function paintRing(look: RingLook, dot: (color: number, x: number, y: number) => void) {
  RING_PIXELS.forEach((row, y) => Array.from(row).forEach((p, x) => {
    if (p !== '.') dot(look[p as RingPart], x, y);
  }));
}
