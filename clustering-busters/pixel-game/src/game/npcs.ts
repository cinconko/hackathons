export type NpcId = 'elder' | 'kid' | 'sergeant';

export interface Npc { readonly name: string; readonly sprite: string }
export const NPCS: Readonly<Record<NpcId, Npc>> = {
  elder: { name: 'Elder Mira', sprite: 'elder' },
  kid: { name: 'Tobi', sprite: 'kid' },
  sergeant: { name: 'Sergeant Brann', sprite: 'sergeant' },
};

export const GRANDPA: Npc = { name: 'Grandpa', sprite: 'grandpa' };

export function bouncedBackLines(kept: number): string[] {
  return [
    'You have been bounced back!',
    kept ? `At least you kept ${kept} ring${kept === 1 ? '' : 's'}. The merchant has new cards.` : 'No rings this time, eh? The merchant has new cards.',
  ];
}

export interface NpcState {
  wins: number;
  villageLevel: number;
  villageName: string;
  hasWeapon: boolean;
  ownsArmor: boolean;
  kidGiftGiven: boolean;
}

export interface Talk { lines: string[]; giftRing?: boolean }

type Rng = () => number;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

export function talk(id: NpcId, s: NpcState, rng: Rng): Talk {
  if (id === 'kid') {
    if (!s.kidGiftGiven) {
      return {
        lines: ['Psst! I fell in the well yesterday.', 'Found this at the bottom. Mum says I can\'t keep shiny things.', 'Here, it\'s yours! Don\'t tell her.'],
        giftRing: true,
      };
    }
    return {
      lines: [pick(rng, [
        'Bet you can\'t jump in the well without screaming.',
        'When I grow up I\'m going to ride the catapult. Every day.',
        'Mossback has a key on his neck. I saw it! Well, I heard about it.',
        s.wins > 0 ? `You beat Mossback ${s.wins} time${s.wins === 1 ? '' : 's'}! Teach me!` : 'Have you beaten Mossback yet? No? Hehe.',
        s.villageLevel >= 6 ? 'The horses go to the shop nobody is at. Clever horses.' : 'I want a horse. A big one. With a cart.',
      ])],
    };
  }
  if (id === 'elder') {
    const lines: string[] = [];
    if (s.wins === 0) {
      lines.push('Mossback fights in three stages, child. Each one meaner than the last.');
      lines.push(pick(rng, [
        'Watch for the red lines. He warns you before he shoots or charges.',
        'The red circle around him means a ring of bullets is coming. Step away.',
        'In his last stage he spins bullets too fast to warn you. Keep moving.',
      ]));
    } else {
      lines.push(`You brought the treasury home ${s.wins} time${s.wins === 1 ? '' : 's'}. The village remembers.`);
    }
    lines.push(s.villageLevel < 6
      ? `We are a ${s.villageName.toLowerCase()} now. Spend your rings here and we grow, and Mossback drops more of them.`
      : 'Ringfall City... I remember when this was a campfire in the woods.');
    if (!s.hasWeapon) lines.push('And for heaven\'s sake, buy a weapon from the merchant. Fists won\'t do.');
    return { lines };
  }
  const lines = ['Training ground is through the gate, recruit. The dummy doesn\'t hit back.'];
  lines.push(pick(rng, [
    'Every blade on the merchant\'s chart hits about as hard over time. Fast and small, or slow and big: your choice.',
    'Ranged weapons hit softer, but from safety. Know when to keep your distance.',
    'The spear reaches further than any other blade. Use that.',
    'Specials are on your number keys. The shield blocks everything for five seconds.',
  ]));
  if (!s.ownsArmor) lines.push('No armor? Even leather takes the edge off. The merchant sells it.');
  return { lines };
}
