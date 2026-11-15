import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkTicket, issueTicket, TICKET_MAX_AGE_MS, TICKET_SLACK_MS } from '../src/game/ticket.ts';

const SECRET = 'test-secret';
const T0 = 1_700_000_000_000;

test('a real run: the ticket checks out and names its run', async () => {
  const t = await issueTicket(SECRET, T0, '11111111-2222-3333-4444-555555555555');
  const r = await checkTicket(SECRET, t, 90_000, T0 + 95_000);
  assert.deepEqual(r, { ok: true, runId: '11111111-2222-3333-4444-555555555555' });
});

test('no claiming a time faster than the clock: the run must have lasted that long', async () => {
  const t = await issueTicket(SECRET, T0);
  assert.equal((await checkTicket(SECRET, t, 90_000, T0 + 30_000)).ok, false);
  assert.equal((await checkTicket(SECRET, t, 90_000, T0 + 90_000 - TICKET_SLACK_MS)).ok, true);
});

test('forged, edited, foreign or expired tickets are refused', async () => {
  const t = await issueTicket(SECRET, T0);
  const [id, , sig] = t.split('.');
  assert.equal((await checkTicket(SECRET, `${id}.${T0 - 600_000}.${sig}`, 90_000, T0 + 95_000)).ok, false, 'backdated');
  assert.equal((await checkTicket('other-secret', t, 90_000, T0 + 95_000)).ok, false, 'wrong key');
  assert.equal((await checkTicket(SECRET, t, 90_000, T0 + TICKET_MAX_AGE_MS + 1)).ok, false, 'expired');
  assert.equal((await checkTicket(SECRET, t, 90_000, T0 - 1)).ok, false, 'from the future');
  for (const bad of [undefined, 42, '', 'a.b.c', `${t}.x`, 'x'.repeat(300)]) {
    assert.equal((await checkTicket(SECRET, bad, 90_000, T0 + 95_000)).ok, false, String(bad));
  }
});
