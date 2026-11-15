export const TICKET_SLACK_MS = 5_000;
export const TICKET_MAX_AGE_MS = 3 * 60 * 60_000;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function issueTicket(secret: string, now = Date.now(), runId: string = crypto.randomUUID()): Promise<string> {
  const body = `${runId}.${now}`;
  return `${body}.${hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)))}`;
}

export type TicketCheck = { ok: true; runId: string } | { ok: false; why: string };

// The run's real age caps the time it can claim: you cannot report a win faster than the clock allows.
export async function checkTicket(secret: string, ticket: unknown, timeMs: number, now = Date.now()): Promise<TicketCheck> {
  if (typeof ticket !== 'string' || ticket.length > 200) return { ok: false, why: 'No run ticket.' };
  const [runId, at, sig, extra] = ticket.split('.');
  if (extra !== undefined || !UUID.test(runId ?? '') || !/^\d{1,15}$/.test(at ?? '') || !/^[0-9a-f]{64}$/.test(sig ?? '')) {
    return { ok: false, why: 'Bad run ticket.' };
  }
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), unhex(sig), enc.encode(`${runId}.${at}`));
  if (!valid) return { ok: false, why: 'Bad run ticket.' };
  const age = now - Number(at);
  if (age < 0 || age > TICKET_MAX_AGE_MS) return { ok: false, why: 'That run ticket expired.' };
  if (timeMs > age + TICKET_SLACK_MS) return { ok: false, why: 'That time is not possible.' };
  return { ok: true, runId };
}
