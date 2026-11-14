// Typed localStorage save. Missing or corrupt data falls back to defaults.
import { emptyWallet, noUpgrades, type Upgrades, type Wallet } from './game/rules';

export interface SaveData {
  muted: boolean;
  seenIntro: boolean;      // the opening cutscene plays once, then it is in the menu
  wallet: Wallet;          // rings you can spend in the village
  upgrades: Upgrades;      // what the village sold you (kept between runs)
  lifetimeRings: Wallet;   // every ring ever brought home
  wins: number;
  bestTimeMs: number;      // fastest win, 0 = no win yet
}

const KEY = 'pixel-game:save';
const defaults = (): SaveData => ({
  muted: false, seenIntro: false, wallet: emptyWallet(), upgrades: noUpgrades(), lifetimeRings: emptyWallet(), wins: 0, bestTimeMs: 0,
});

export function loadSave(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<SaveData> & { rings?: Wallet };
    const legacy = p.rings; // saves before rings were money: their rings become the wallet
    return {
      ...d, ...p,
      wallet: { ...d.wallet, ...(p.wallet ?? legacy ?? {}) },
      upgrades: { ...d.upgrades, ...(p.upgrades ?? {}) },
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
