// The combat tutorial after the opening cutscene: Sergeant Brann at the training yard. Pure rules
// (which step, what moves it on); the screen side is src/tutorial.ts. Esc skips at any step.
//
//   offer     Brann offers to train you       Enter: train   Esc: skip
//   walk      walk into the training yard     done when you are inside
//   attack    aim with the mouse, hit the dummy 3 times
//   dodge     he throws practice balls; a red line shows where; dodge 3
//   gear      the merchant, Q, 1-8 (talk)     Enter
//   catapult  off to the lair (talk)          Enter, then done

export type TutorialStep = 'offer' | 'walk' | 'attack' | 'dodge' | 'gear' | 'catapult' | 'done' | 'skipped';
export type TutorialEvent = 'next' | 'skip' | 'enterYard' | 'hitDummy' | 'dodged';
export interface TutorialState { readonly step: TutorialStep; readonly count: number }

export const TUTORIAL_HITS = 3;
export const TUTORIAL_DODGES = 3;

/** What the box at the top says, per step (talk steps are spoken by Brann instead). */
export const TUTORIAL_TEXT: Readonly<Record<TutorialStep, { title: string; text: string; talk?: string[] }>> = {
  offer: { title: 'TRAINING', text: '', talk: ['Recruit! Before you face Mossback, show me you can fight.', 'Enter: train with me    Esc: skip the training'] },
  walk: { title: 'TRAINING 1/4', text: 'Walk with WASD into the training yard.' },
  attack: { title: 'TRAINING 2/4', text: `Aim with the mouse. Click or Space: hit the dummy ${TUTORIAL_HITS} times.` },
  dodge: { title: 'TRAINING 3/4', text: `A red line shows where a ball will fly. Step out of it! Dodge ${TUTORIAL_DODGES}.` },
  gear: {
    title: 'TRAINING 4/4', text: 'Listen to Brann.',
    talk: ['Fists won\'t beat Mossback. The merchant sells weapons, armor and specials, for rings.', 'In the fight, Q switches weapons and 1-8 cast the specials you own.'],
  },
  catapult: { title: 'TRAINING 4/4', text: 'Listen to Brann.', talk: ['When you are ready, the catapult in the east throws you into his lair. Get that key!'] },
  done: { title: '', text: '' },
  skipped: { title: '', text: '' },
};

export const tutorialStart = (): TutorialState => ({ step: 'offer', count: 0 });

/** Is the tutorial over (finished or skipped)? */
export const tutorialOver = (s: TutorialState): boolean => s.step === 'done' || s.step === 'skipped';

/** Steps where Brann talks and you only press Enter (the player stands still). */
export const isTalk = (s: TutorialState): boolean => s.step === 'offer' || s.step === 'gear' || s.step === 'catapult';

/** One event in, the next state out. Anything that does not fit the current step is ignored. */
export function tutorialNext(s: TutorialState, e: TutorialEvent): TutorialState {
  if (tutorialOver(s)) return s;
  if (e === 'skip') return { step: 'skipped', count: 0 };
  const to = (step: TutorialStep): TutorialState => ({ step, count: 0 });
  switch (s.step) {
    case 'offer': return e === 'next' ? to('walk') : s;
    case 'walk': return e === 'enterYard' ? to('attack') : s;
    case 'attack':
      if (e !== 'hitDummy') return s;
      return s.count + 1 >= TUTORIAL_HITS ? to('dodge') : { step: 'attack', count: s.count + 1 };
    case 'dodge':
      if (e !== 'dodged') return s;
      return s.count + 1 >= TUTORIAL_DODGES ? to('gear') : { step: 'dodge', count: s.count + 1 };
    case 'gear': return e === 'next' ? to('catapult') : s;
    case 'catapult': return e === 'next' ? to('done') : s;
    default: return s;
  }
}
