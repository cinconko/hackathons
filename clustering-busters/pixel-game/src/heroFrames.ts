// The hero's walking frames, made from his one drawing (the team draws a single front view per look:
// the farmer, each knight). Pure pixel work on RGBA arrays (no Phaser), so tests run in Node.
// Every frame keeps the drawing's exact size (9x16, 12x16), so nothing else has to move.
//
// Only the FEET move: the bottom rows where the two legs stand apart (a gap between them). The
// trousers, the belt and the body above stay exactly as drawn, so the hero never comes apart.
//
//   step 'left' / 'right'  that foot lifted 1 px (it leaves the ground)

export type HeroFrame = 'left' | 'right';

const opaque = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3] >= 128;

/** The opaque columns of row y, and whether there is a see-through gap between two of them. */
function gapIn(d: Uint8ClampedArray, w: number, y: number): number | null {
  const cols = [...Array(w).keys()].filter((x) => opaque(d, w, x, y));
  for (let i = 1; i < cols.length; i++) {
    if (cols[i] - cols[i - 1] > 1) return Math.floor((cols[i] + cols[i - 1]) / 2) + 1;   // first column of the right foot's side
  }
  return null;
}

/**
 * The feet: how many rows at the bottom have a gap between the legs (counted up from the bottom row,
 * at most a sixth of the height), and where the right foot's side begins. No gap = no feet to move.
 */
export function feet(d: Uint8ClampedArray, w: number, h: number): { rows: number; split: number } | null {
  const split = gapIn(d, w, h - 1);
  if (split === null) return null;
  let rows = 1;
  while (rows < Math.floor(h / 6) && gapIn(d, w, h - 1 - rows) !== null) rows++;
  return { rows, split };
}

/** One frame of the hero, the same size as the drawing. A drawing without separate feet is returned as is. */
export function heroFrame(src: Uint8ClampedArray, w: number, h: number, frame: HeroFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const f = feet(src, w, h);
  if (!f) return out;
  const [x0, x1] = frame === 'left' ? [0, f.split] : [f.split, w];
  const top = h - f.rows;
  // lift that foot one row: clear it, then draw it one row higher (over the trouser hem above it)
  for (let y = top; y < h; y++) for (let x = x0; x < x1; x++) out.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4);
  for (let y = top; y < h; y++) {
    for (let x = x0; x < x1; x++) {
      const s = (y * w + x) * 4;
      if (src[s + 3] >= 128) out.set(src.subarray(s, s + 4), ((y - 1) * w + x) * 4);
    }
  }
  return out;
}

/** The walk: left foot up, both down, right foot up, both down. */
export const WALK: readonly (HeroFrame | null)[] = ['left', null, 'right', null];
export const WALK_MS = 140;            // per frame: about a stride every half second at walking speed
