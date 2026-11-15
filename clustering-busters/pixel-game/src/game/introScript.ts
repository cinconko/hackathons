// The opening cutscene's story, as data: one list of lines per shot. The pictures are built in
// src/scenes/intro.ts (one build per shot, in this order); this file is only the words, so the
// story can be rewritten and tested without the game running (test/introScript.test.ts).
//
//   1 night     the treasury under the hill, Tobi peeking in
//   2 shake     the hill shakes, everyone runs
//   3 theft     Mossback carries the chest off
//   4 lair      the key around his neck
//   5 square    next morning: Mira, Grandpa, Tobi and you
//   6 catapult  you walk up to the catapult; Brann stops you (the training starts after this)

export type Speaker = 'mira' | 'grandpa' | 'tobi' | 'brann' | 'all';
export interface Line { readonly who?: Speaker; readonly text: string }

/** Name tag and its colour. 'all' is everyone in the square at once. */
export const SPEAKERS: Readonly<Record<Speaker, { name: string; color: string }>> = {
  mira: { name: 'Elder Mira', color: '#b8b8ff' },
  grandpa: { name: 'Grandpa', color: '#e8c070' },
  tobi: { name: 'Tobi', color: '#7ee07e' },
  brann: { name: 'Sergeant Brann', color: '#ff8a8a' },
  all: { name: 'Everyone', color: '#ffcc44' },
};

/** The longest line that still fits the caption bar (two rows of the 8px font). */
export const MAX_LINE = 96;

export const INTRO_SCRIPT: readonly (readonly Line[])[] = [
  [{ text: 'Every ring Ringfall ever found sleeps in the treasury under the hill.' }],
  [{ text: 'Then, one night, the hill shook.' }],
  [{ text: 'Mossback. He took every last ring, all the way back to his mountain.' }],
  [{ text: 'He locked them in a room. The only key hangs around his neck.' }],
  [
    { who: 'mira', text: 'No road climbs his mountain. None ever did.' },
    { who: 'grandpa', text: 'The old catapult does! I flew it once. Landed in a haystack.' },
    { who: 'tobi', text: 'Can I go? Please? I can go!' },
    { who: 'all', text: 'No.' },
    { who: 'mira', text: 'Then it falls to you. Bring our rings home.' },
  ],
  [
    { who: 'brann', text: 'Easy, recruit. Mossback would flatten you as you are.' },
    { who: 'brann', text: 'Training yard. Now.' },
  ],
];
