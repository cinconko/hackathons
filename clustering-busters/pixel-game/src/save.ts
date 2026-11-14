// Typed localStorage save. Missing or corrupt data falls back to defaults.
import { emptyWallet, equip, startingInventory, startingWallet, type CatalogId, type DrinkId, type Inventory, type SpecialOffer, type Wallet } from './game/rules';

export interface SaveData {
  muted: boolean;
  seenIntro: boolean;      // the opening cutscene plays once, then it is in the menu
  wallet: Wallet;          // all your rings: the only money (village and fisherman)
  inventory: Inventory;    // what the village sold you and what you wear (kept between runs)
  merchantCards: CatalogId[]; // the 4 random cards on the merchant's table (dealt again after every run)
  merchantSpecial: SpecialOffer | null; // the 5th card: a top item at a discount
  drink: DrinkId | null;   // bought at the bar, drunk at the start of the next fight
  spent: number;           // rings spent in the village: it grows with them
  villageSeen: number;     // the village level the player has already watched being built
  handRevealed: boolean;   // the "in hand" indicator has popped up once (after the first weapon)
  kidGiftGiven: boolean;   // Tobi gave you the ring from the well
  talkedTo: string[];      // people you have talked to (no "!" over them any more)
  lifetimeRings: Wallet;   // every ring ever found
  wins: number;
  bestTimeMs: number;      // fastest win, 0 = no win yet
}

const KEY = 'pixel-game:save';
const defaults = (): SaveData => ({
  muted: false, seenIntro: false, wallet: startingWallet(), inventory: startingInventory(), merchantCards: [], merchantSpecial: null, drink: null, spent: 0, villageSeen: 1, handRevealed: false, kidGiftGiven: false, talkedTo: [], lifetimeRings: emptyWallet(), wins: 0, bestTimeMs: 0,
});

/** Saves from before the weapons chart had "upgrades": a bought bow becomes the chart's bow, bombs the bomb special. */
function migrateUpgrades(up: Record<string, number> | undefined): Inventory {
  let inv = startingInventory();
  const add = (id: CatalogId) => { inv = equip({ ...inv, owned: [...inv.owned, id] }, id); };
  if (up?.bow) add('bow');
  if (up?.bombs) add('bomb');
  return inv;
}

export function loadSave(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<SaveData> & { rings?: Wallet; upgrades?: Record<string, number> };
    const legacy = p.rings; // saves before rings were money: their rings become the wallet
    return {
      ...d, ...p,
      wallet: { ...emptyWallet(), ...(p.wallet ?? legacy ?? d.wallet) },
      inventory: p.inventory ? { ...d.inventory, ...p.inventory } : migrateUpgrades(p.upgrades),
      lifetimeRings: { ...d.lifetimeRings, ...(p.lifetimeRings ?? legacy ?? {}) },
    };
  } catch { /* private mode or corrupt JSON */ }
  return d;
}

export function writeSave(data: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota or blocked */ }
}

export function updateSave(change: (s: SaveData) => SaveData): SaveData {
  const next = change(loadSave());
  writeSave(next);
  return next;
}
