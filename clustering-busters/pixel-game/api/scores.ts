// Keep '.js': Vercel keeps import paths as written, and a '.ts' path crashes this function (ERR_MODULE_NOT_FOUND).
import { BOARD_SIZE, cleanNick, rankFor, validTime, type Score } from '../src/game/leaderboard.js';
import { checkTicket, issueTicket } from '../src/game/ticket.js';

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

const totalOf = (res: Response): number => Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0;

async function board(): Promise<{ top: Score[]; total: number }> {
  const res = await db(`scores?select=nick,time_ms&order=time_ms.asc,id.asc&limit=${BOARD_SIZE}`, { count: true });
  if (!res.ok) throw new Error(`board: ${res.status}`);
  const rows = (await res.json()) as { nick: string; time_ms: number }[];
  return { top: rows.map((r) => ({ nick: r.nick, timeMs: r.time_ms })), total: totalOf(res) };
}

// Prefer a dedicated SCORE_TICKET_SECRET; the service-role key is a server-only fallback so tickets work without new config.
const ticketSecret = () => process.env.SCORE_TICKET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get('run') === 'new') {
    const secret = ticketSecret();
    if (!secret) return json({ error: 'The leaderboard is offline.' }, 503);
    return json({ ticket: await issueTicket(secret) });
  }
  try {
    return json(await board());
  } catch (e) {
    console.error('[scores] GET', e);
    return json({ error: 'The leaderboard is offline.' }, 503);
  }
}

// Never trust the browser: re-check every name and time here; the service-role key must stay server-side.
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 512) return json({ error: 'Too big.' }, 413);
  let body: { nick?: unknown; timeMs?: unknown; ticket?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Not JSON.' }, 400); }
  const nick = cleanNick(body.nick);
  if (!nick) return json({ error: 'Pick a name of 2-14 letters or digits.' }, 400);
  if (!validTime(body.timeMs)) return json({ error: 'That time is not possible.' }, 400);
  const timeMs = body.timeMs;
  const secret = ticketSecret();
  if (!secret) return json({ error: 'The leaderboard is offline.' }, 503);
  const run = await checkTicket(secret, body.ticket, timeMs);
  if (!run.ok) return json({ error: run.why }, 400);
  try {
    // run_id is unique in the table, so one ticket can post one score.
    const saved = await db('scores', { method: 'POST', body: JSON.stringify({ nick, time_ms: timeMs, run_id: run.runId }), headers: { Prefer: 'return=minimal' } });
    if (saved.status === 409) return json({ error: 'That run is already on the board.' }, 409);
    if (!saved.ok) throw new Error(`insert: ${saved.status}`);
    const faster = await db(`scores?select=id&time_ms=lt.${timeMs}&limit=1`, { count: true });
    if (!faster.ok) throw new Error(`rank: ${faster.status}`);
    return json({ ...(await board()), rank: rankFor(totalOf(faster)) });
  } catch (e) {
    console.error('[scores] POST', e);
    return json({ error: 'The leaderboard is offline.' }, 503);
  }
}
