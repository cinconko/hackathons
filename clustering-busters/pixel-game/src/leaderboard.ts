import { cleanNick, type Score } from './game/leaderboard';

const NICK_KEY = 'pixel-game:nick';
const API = (globalThis as { RINGFALL_API?: string }).RINGFALL_API ?? '/api/scores';   // itch.html points this at the website's API
const TIMEOUT_MS = 6000;

export function loadNick(): string | null {
  try { return cleanNick(localStorage.getItem(NICK_KEY)); } catch { return null; }
}

export function saveNick(nick: string): void {
  try { localStorage.setItem(NICK_KEY, nick); } catch {   }
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
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchBoard = (): Promise<Board | null> => call();

let pending: { timeMs: number; answer: Promise<Board | null> } | null = null;
let runTicket: Promise<string | null> = Promise.resolve(null);

async function fetchTicket(): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}?run=new`, { signal: ctl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { ticket?: unknown };
    return typeof body?.ticket === 'string' ? body.ticket : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function startRun(): void {
  runTicket = fetchTicket();
}

export function submitWin(timeMs: number): Promise<Board | null> {
  const nick = loadNick();
  if (!nick) return Promise.resolve(null);
  const answer = runTicket.then((ticket) => {
    runTicket = Promise.resolve(null);
    return ticket ? call({ method: 'POST', body: JSON.stringify({ nick, timeMs, ticket }) }) : null;
  });
  pending = { timeMs, answer };
  return answer;
}

export function boardFor(timeMs?: number): Promise<Board | null> {
  return timeMs !== undefined && pending?.timeMs === timeMs ? pending.answer : fetchBoard();
}

export const typing = { on: false };
