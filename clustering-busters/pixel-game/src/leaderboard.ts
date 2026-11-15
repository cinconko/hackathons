// The leaderboard from the game's side: your nickname (remembered in this browser; the landing
// page sets the same key) and the calls to /api/scores. The rules (what a nick may be, which
// times count) are in src/game/leaderboard.ts; the server checks them again.
//
// Off Vercel (itch.io, `npm run dev`) there is no /api: every call fails quietly and the board
// says it is offline. A win never waits on the network.
import { cleanNick, type Score } from './game/leaderboard';

const NICK_KEY = 'pixel-game:nick';
const API = '/api/scores';
const TIMEOUT_MS = 6000;

export function loadNick(): string | null {
  try { return cleanNick(localStorage.getItem(NICK_KEY)); } catch { return null; }
}

export function saveNick(nick: string): void {
  try { localStorage.setItem(NICK_KEY, nick); } catch { /* private mode: asked again next time */ }
}

export interface Board { top: Score[]; total: number; rank?: number }

async function call(init?: RequestInit): Promise<Board | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, { ...init, signal: ctl.signal, headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as Board;
    return Array.isArray(body?.top) ? body : null;
  } catch {
    return null;   // offline, no /api here, or too slow
  } finally {
    clearTimeout(timer);
  }
}

/** The top of the board (null = offline). */
export const fetchBoard = (): Promise<Board | null> => call();

/**
 * The win just sent (or being sent). The result screen starts it; the board scene shows its
 * answer, whichever screen comes first.
 */
let pending: { timeMs: number; answer: Promise<Board | null> } | null = null;

/** Send a winning time under your nickname; resolves to the board with your rank, or null. */
export function submitWin(timeMs: number): Promise<Board | null> {
  const nick = loadNick();
  if (!nick) return Promise.resolve(null);
  const answer = call({ method: 'POST', body: JSON.stringify({ nick, timeMs }) });
  pending = { timeMs, answer };
  return answer;
}

/** The answer for this time if it was just sent, else a fresh board. */
export function boardFor(timeMs?: number): Promise<Board | null> {
  return timeMs !== undefined && pending?.timeMs === timeMs ? pending.answer : fetchBoard();
}

/** True while a name is being typed: the page-wide keys (M mute, F fullscreen, R reset) stay quiet. */
export const typing = { on: false };
