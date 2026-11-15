import { emptyWallet, equip, startingInventory, startingWallet, type CatalogId, type DrinkId, type Inventory, type MerchantKind, type SpecialOffer, type Wallet } from './game/rules';

export interface SaveData {
  muted: boolean;
  seenIntro: boolean;
  tutorialDone: boolean;
  wallet: Wallet;
  inventory: Inventory;
  merchantKind: MerchantKind;
  merchantCards: CatalogId[];
  merchantSpecial: SpecialOffer | null;
  drink: DrinkId | null;
  spent: number;
  villageSeen: number;
  handRevealed: boolean;
  kidGiftGiven: boolean;
  grandpaMet: boolean;
  natureSeed: number;
  talkedTo: string[];
  lifetimeRings: Wallet;
  wins: number;
  bestTimeMs: number;
}

const KEY = 'pixel-game:save';
const defaults = (): SaveData => ({
  muted: false, seenIntro: false, tutorialDone: false, wallet: startingWallet(), inventory: startingInventory(), merchantKind: 'peddler', merchantCards: [], merchantSpecial: null, drink: null, spent: 0, villageSeen: 1, handRevealed: false, kidGiftGiven: false, grandpaMet: false, natureSeed: 0, talkedTo: [], lifetimeRings: emptyWallet(), wins: 0, bestTimeMs: 0,
});

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
    const legacy = p.rings;
    return {
      ...d, ...p,
      wallet: { ...emptyWallet(), ...(p.wallet ?? legacy ?? d.wallet) },
      inventory: p.inventory ? { ...d.inventory, ...p.inventory } : migrateUpgrades(p.upgrades),
      lifetimeRings: { ...d.lifetimeRings, ...(p.lifetimeRings ?? legacy ?? {}) },
    };
  } catch {   }
  return d;
}

export function writeSave(data: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {   }
}

export function resetSave(): SaveData {
  const fresh = { ...defaults(), muted: loadSave().muted };
  writeSave(fresh);
  return fresh;
}

export function updateSave(change: (s: SaveData) => SaveData): SaveData {
  const next = change(loadSave());
  writeSave(next);
  return next;
}
