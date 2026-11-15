import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INTRO_SCRIPT, MAX_LINE, SPEAKERS } from '../src/game/introScript.ts';

test('six shots, each with at least one line', () => {
  assert.equal(INTRO_SCRIPT.length, 6);
  for (const shot of INTRO_SCRIPT) assert.ok(shot.length > 0);
});

test('every line has words, fits the caption bar, and its speaker has a name tag', () => {
  for (const line of INTRO_SCRIPT.flat()) {
    assert.ok(line.text.trim().length > 0);
    assert.ok(line.text.length <= MAX_LINE, `too long: "${line.text}"`);
    if (line.who) assert.ok(SPEAKERS[line.who].name);
  }
});

test('Brann has the last word: the training follows straight on', () => {
  assert.equal(INTRO_SCRIPT.at(-1)!.at(-1)!.who, 'brann');
});
