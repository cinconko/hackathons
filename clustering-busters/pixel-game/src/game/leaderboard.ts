// The leaderboard's rules: what a nickname may be, which times count, how a time ranks. Pure, so
// the game (src/leaderboard.ts) and the server (api/scores.ts) check exactly the same things,
// and it is tested without either running (test/leaderboard.test.ts).
//
// The browser can send anything, so the server re-checks every rule here before saving.

export const NICK_MIN = 2;
export const NICK_MAX = 14;                // fits the board's name column at 8px
export const TIME_MIN_MS = 20_000;         // nobody beats Mossback faster: below this it is not a real run
export const TIME_MAX_MS = 2 * 60 * 60_000;
export const BOARD_SIZE = 10;

export interface Score { nick: string; timeMs: number }

/**
 * A nickname made fit for the board, or null: spaces trimmed and squeezed, letters (any language),
 * digits, space, _ - . only, NICK_MIN to NICK_MAX characters long.
 */
export function cleanNick(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const nick = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if ([...nick].length < NICK_MIN || [...nick].length > NICK_MAX) return null;
  return /^[\p{L}\p{N} _.-]+$/u.test(nick) ? nick : null;
}

/** A winning time the board accepts: whole milliseconds in a believable range. */
export function validTime(ms: unknown): ms is number {
  return typeof ms === 'number' && Number.isInteger(ms) && ms >= TIME_MIN_MS && ms <= TIME_MAX_MS;
}

/** Fastest first; an equal time keeps the earlier one first (the list is in arrival order). */
export function sortScores<T extends Score>(scores: readonly T[]): T[] {
  return scores.map((s, i) => ({ s, i })).sort((a, b) => a.s.timeMs - b.s.timeMs || a.i - b.i).map((x) => x.s);
}

/** Where a time would place (1 = the best), given how many recorded times are strictly faster. */
export const rankFor = (fasterCount: number): number => fasterCount + 1;
