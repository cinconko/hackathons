// Typed localStorage save. Missing or corrupt data falls back to defaults.
import type { Rarity } from './game/rules';

export interface SaveData {
  muted: boolean;
  wins: number;
  bestTimeMs: number;               // fastest win, 0 = no win yet
  rings: Record<Rarity, number>;    // every ring ever collected
}

const KEY = 'pixel-game:save';
const DEFAULTS: SaveData = { muted: false, wins: 0, bestTimeMs: 0, rings: { classic: 0, rare: 0, superRare: 0 } };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return { ...DEFAULTS, ...parsed, rings: { ...DEFAULTS.rings, ...(parsed.rings ?? {}) } };
    }
  } catch { /* private mode or corrupt JSON */ }
  return { ...DEFAULTS, rings: { ...DEFAULTS.rings } };
}

export function writeSave(data: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota or blocked */ }
}
