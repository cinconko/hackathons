// The hero's animation frames, made from his one drawing (the team draws a single front view per
// look: the farmer, each knight). Pure pixel work on RGBA arrays (no Phaser), so tests run in Node.
// Every frame keeps the drawing's exact size (10x18, 13x18), so nothing else has to move.
//
//   step 'left' / 'right'  that leg lifted 1 px (its foot leaves the ground)
//   breathe                head and body sink 1 px onto the legs (the idle breath)

export type HeroFrame = 'left' | 'right' | 'breathe';

/** How many rows at the bottom are legs: the bottom sixth, at least 2 (3 of 18). */
export const legRows = (h: number) => Math.max(2, Math.round(h / 6));

const opaque = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3] >= 128;

/**
 * The column where the left leg ends and the right begins: the middle of the gap between the two
 * feet in the bottom row (the drawings have one), or the middle of the drawing if there is none.
 */
export function legSplit(d: Uint8ClampedArray, w: number, h: number): number {
  const y = h - 1;
  const cols = [...Array(w).keys()].filter((x) => opaque(d, w, x, y));
  if (cols.length < 2) return Math.floor(w / 2);
  for (let i = 1; i < cols.length; i++) {
    if (cols[i] - cols[i - 1] > 1) return Math.floor((cols[i] + cols[i - 1]) / 2) + 1;   // first column of the right leg's side
  }
  return Math.floor((cols[0] + cols[cols.length - 1] + 1) / 2);
}

/** Moves the pixels of a box by (0, dy), clearing where they were. */
function shiftBox(src: Uint8ClampedArray, out: Uint8ClampedArray, w: number, h: number, x0: number, x1: number, y0: number, y1: number, dy: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x < x1; x++) out.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4);
  for (let y = y0; y <= y1; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= h) continue;
    for (let x = x0; x < x1; x++) {
      const s = (y * w + x) * 4;
      if (src[s + 3] < 128) continue;   // only the drawing moves; what it moves over keeps showing
      out.set(src.subarray(s, s + 4), (ty * w + x) * 4);
    }
  }
}

/** One frame of the hero, the same size as the drawing. */
export function heroFrame(src: Uint8ClampedArray, w: number, h: number, frame: HeroFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const legs = legRows(h);
  const top = h - legs;   // first leg row
  if (frame === 'breathe') {
    shiftBox(src, out, w, h, 0, w, 0, top - 1, 1);
    return out;
  }
  const split = legSplit(src, w, h);
  const [x0, x1] = frame === 'left' ? [0, split] : [split, w];
  shiftBox(src, out, w, h, x0, x1, top, h - 1, -1);
  return out;
}

/** The walk: left step, stand, right step, stand. */
export const WALK: readonly (HeroFrame | null)[] = ['left', null, 'right', null];
export const WALK_MS = 130;            // per frame: 4 frames = a little over half a second per stride
export const BREATH_MS = 1800;         // one idle breath in, out
