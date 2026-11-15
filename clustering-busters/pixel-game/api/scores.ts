// The leaderboard API (a Vercel Function; the site is public, so these checks are the only guard).
//
//   GET  /api/scores                     -> { top: [{ nick, timeMs }], total }
//   POST /api/scores { nick, timeMs }    -> { top, total, rank }   (the win is saved first)
//
// The table is public.scores in Supabase (db/scores.sql). This file talks to it through
// Supabase's REST API with the service-role key, which lives only in Vercel's server env
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY): the browser never sees a database key. Every name
// and time is checked again here with the same rules the game uses (src/game/leaderboard.ts),
// because anything sent from a browser can be faked.
// '.js', not '.ts': Vercel compiles this function to JavaScript but keeps the import path as written
import { BOARD_SIZE, cleanNick, rankFor, validTime, type Score } from '../src/game/leaderboard.js';

declare const process: { env: Record<string, string | undefined> };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function db(path: string, init: RequestInit & { count?: boolean } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.count ? { Prefer: 'count=exact' } : {}),
      ...init.headers,
    },
  });
}

/** "0-9/123" -> 123 (PostgREST's Content-Range carries the total count). */
const totalOf = (res: Response): number => Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0;

async function board(): Promise<{ top: Score[]; total: number }> {
  const res = await db(`scores?select=nick,time_ms&order=time_ms.asc,id.asc&limit=${BOARD_SIZE}`, { count: true });
  if (!res.ok) throw new Error(`board: ${res.status}`);
  const rows = (await res.json()) as { nick: string; time_ms: number }[];
  return { top: rows.map((r) => ({ nick: r.nick, timeMs: r.time_ms })), total: totalOf(res) };
}

export async function GET(): Promise<Response> {
  try {
    return json(await board());
  } catch (e) {
    console.error('[scores] GET', e);
    return json({ error: 'The leaderboard is offline.' }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 512) return json({ error: 'Too big.' }, 413);
  let body: { nick?: unknown; timeMs?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Not JSON.' }, 400); }
  const nick = cleanNick(body.nick);
  if (!nick) return json({ error: 'Pick a name of 2-14 letters or digits.' }, 400);
  if (!validTime(body.timeMs)) return json({ error: 'That time is not possible.' }, 400);
  const timeMs = body.timeMs;
  try {
    const saved = await db('scores', { method: 'POST', body: JSON.stringify({ nick, time_ms: timeMs }), headers: { Prefer: 'return=minimal' } });
    if (!saved.ok) throw new Error(`insert: ${saved.status}`);
    // your place: how many recorded times are strictly faster
    const faster = await db(`scores?select=id&time_ms=lt.${timeMs}&limit=1`, { count: true });
    if (!faster.ok) throw new Error(`rank: ${faster.status}`);
    return json({ ...(await board()), rank: rankFor(totalOf(faster)) });
  } catch (e) {
    console.error('[scores] POST', e);
    return json({ error: 'The leaderboard is offline.' }, 503);
  }
}
