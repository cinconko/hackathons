import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTalk, TUTORIAL_DODGES, TUTORIAL_HITS, TUTORIAL_TEXT, tutorialNext, tutorialOver, tutorialStart, type TutorialEvent, type TutorialState } from '../src/game/tutorial.ts';

const run = (events: TutorialEvent[], s: TutorialState = tutorialStart()) => events.reduce(tutorialNext, s);

test('the whole training: walk in, hit the dummy, dodge, listen, done', () => {
  const s = run(['next', 'enterYard', ...Array(TUTORIAL_HITS).fill('hitDummy'), ...Array(TUTORIAL_DODGES).fill('dodged'), 'next', 'next']);
  assert.equal(s.step, 'done');
  assert.ok(tutorialOver(s));
});

test('each step waits for its own goal', () => {
  assert.equal(run(['next', 'hitDummy', 'dodged']).step, 'walk', 'no hitting before you are in the yard');
  assert.deepEqual(run(['next', 'enterYard', 'hitDummy']), { step: 'attack', count: 1 });
  assert.equal(run(['next', 'enterYard', ...Array(TUTORIAL_HITS).fill('hitDummy'), 'hitDummy']).step, 'dodge', 'extra hits do not skip the dodging');
  assert.deepEqual(run(['next', 'enterYard', ...Array(TUTORIAL_HITS).fill('hitDummy'), 'dodged']), { step: 'dodge', count: 1 });
});

test('Esc skips from any step, and a finished or skipped tutorial stays that way', () => {
  for (const n of [0, 1, 2, 5, 8]) {
    const events: TutorialEvent[] = ['next', 'enterYard', 'hitDummy', 'hitDummy', 'hitDummy', 'dodged', 'dodged', 'dodged', 'next'].slice(0, n) as TutorialEvent[];
    assert.equal(run([...events, 'skip']).step, 'skipped', `skip after ${n} events`);
  }
  assert.equal(run(['skip', 'next', 'enterYard']).step, 'skipped');
  assert.equal(tutorialNext({ step: 'done', count: 0 }, 'skip').step, 'done');
});

test('Brann talks on the offer, gear and catapult steps; every step has words', () => {
  assert.deepEqual((['offer', 'walk', 'attack', 'dodge', 'gear', 'catapult'] as const).filter((step) => isTalk({ step, count: 0 })), ['offer', 'gear', 'catapult']);
  for (const step of ['offer', 'gear', 'catapult'] as const) assert.ok(TUTORIAL_TEXT[step].talk?.length);
  for (const step of ['walk', 'attack', 'dodge'] as const) assert.ok(TUTORIAL_TEXT[step].text.length > 10);
});
