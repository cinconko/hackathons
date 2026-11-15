import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanNick, NICK_MAX, rankFor, sortScores, TIME_MAX_MS, TIME_MIN_MS, validTime } from '../src/game/leaderboard.ts';

test('nicknames: trimmed and squeezed, any language, no markup or symbols', () => {
  assert.equal(cleanNick('  Tobi   the  Brave '), 'Tobi the Brave');
  assert.equal(cleanNick('Šimon_42'), 'Šimon_42');
  assert.equal(cleanNick('x'), null, 'too short');
  assert.equal(cleanNick('a'.repeat(NICK_MAX + 1)), null, 'too long');
  assert.equal(cleanNick('<script>'), null);
  assert.equal(cleanNick('rings$$$'), null);
  assert.equal(cleanNick(42), null);
  assert.equal(cleanNick(undefined), null);
});

test('times: whole ms in a believable range', () => {
  assert.ok(validTime(95_000));
  assert.ok(!validTime(TIME_MIN_MS - 1), 'faster than anyone can win');
  assert.ok(!validTime(TIME_MAX_MS + 1));
  assert.ok(!validTime(95_000.5));
  assert.ok(!validTime('95000'));
  assert.ok(!validTime(NaN));
});

test('the board: fastest first, an equal time keeps the earlier one first', () => {
  const s = sortScores([{ nick: 'b', timeMs: 90_000 }, { nick: 'a', timeMs: 60_000 }, { nick: 'c', timeMs: 90_000 }]);
  assert.deepEqual(s.map((x) => x.nick), ['a', 'b', 'c']);
  assert.equal(rankFor(0), 1);
  assert.equal(rankFor(4), 5);
});
