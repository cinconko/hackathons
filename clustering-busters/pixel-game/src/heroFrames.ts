export type HeroFrame = 'left' | 'right';

const opaque = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3] >= 128;

function gapIn(d: Uint8ClampedArray, w: number, y: number): number | null {
  const cols = [...Array(w).keys()].filter((x) => opaque(d, w, x, y));
  for (let i = 1; i < cols.length; i++) {
    if (cols[i] - cols[i - 1] > 1) return Math.floor((cols[i] + cols[i - 1]) / 2) + 1;
  }
  return null;
}

export function feet(d: Uint8ClampedArray, w: number, h: number): { rows: number; split: number } | null {
  const split = gapIn(d, w, h - 1);
  if (split === null) return null;
  let rows = 1;
  while (rows < Math.floor(h / 6) && gapIn(d, w, h - 1 - rows) !== null) rows++;
  return { rows, split };
}

export function heroFrame(src: Uint8ClampedArray, w: number, h: number, frame: HeroFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const f = feet(src, w, h);
  if (!f) return out;
  const [x0, x1] = frame === 'left' ? [0, f.split] : [f.split, w];
  const top = h - f.rows;
  for (let y = top; y < h; y++) for (let x = x0; x < x1; x++) out.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4);
  for (let y = top; y < h; y++) {
    for (let x = x0; x < x1; x++) {
      const s = (y * w + x) * 4;
      if (src[s + 3] >= 128) out.set(src.subarray(s, s + 4), ((y - 1) * w + x) * 4);
    }
  }
  return out;
}

export const WALK: readonly (HeroFrame | null)[] = ['left', null, 'right', null];
export const WALK_MS = 140;
