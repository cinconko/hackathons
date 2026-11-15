export const NICK_MIN = 2;
export const NICK_MAX = 14;
export const TIME_MIN_MS = 20_000;
export const TIME_MAX_MS = 2 * 60 * 60_000;
export const BOARD_SIZE = 10;

export interface Score { nick: string; timeMs: number }

export function cleanNick(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const nick = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if ([...nick].length < NICK_MIN || [...nick].length > NICK_MAX) return null;
  return /^[\p{L}\p{N} _.-]+$/u.test(nick) ? nick : null;
}

export function validTime(ms: unknown): ms is number {
  return typeof ms === 'number' && Number.isInteger(ms) && ms >= TIME_MIN_MS && ms <= TIME_MAX_MS;
}

export function sortScores<T extends Score>(scores: readonly T[]): T[] {
  return scores.map((s, i) => ({ s, i })).sort((a, b) => a.s.timeMs - b.s.timeMs || a.i - b.i).map((x) => x.s);
}

export const rankFor = (fasterCount: number): number => fasterCount + 1;
