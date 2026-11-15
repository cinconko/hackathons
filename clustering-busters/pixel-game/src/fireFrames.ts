// The campfire's flicker, made from the team's one drawing (sprites/campfire_wood.png and
// campfire_stone.png). Pure pixel work on RGBA arrays (no Phaser), so tests run in Node.
//
// Only the FLAME moves: the flame-coloured pixels above the first row where the logs or stones
// start. The logs, the stones and the glow on them stay exactly as drawn in every frame.
//
//   still   as drawn
//   left    the flame's tip (its upper part) leans 1 px left
//   right   ... 1 px right
//   low     the flame's top row is gone: it dips for a moment
// No brightness pulsing: a whole fire flashing reads as a strobe, not a flicker.

export type FireFrame = 'still' | 'left' | 'right' | 'low';

/** The flicker: mostly still, a lean each way, now and then a dip; uneven timing. */
export const FLICKER: readonly [FireFrame, number][] = [['still', 170], ['left', 130], ['still', 120], ['right', 140], ['still', 150], ['low', 110]];

const isFlame = (d: Uint8ClampedArray, i: number) => d[i + 3] > 0 && d[i] > 180 && d[i] - d[i + 2] > 70;

/** Where the flame is: a mask over the pixels, its top row, and the first row of logs or stones. */
export function flame(d: Uint8ClampedArray, w: number, h: number): { mask: Uint8Array; top: number; base: number } | null {
  let base = h;
  for (let y = 0; y < h && base === h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0 && !isFlame(d, i)) { base = y; break; }
    }
  }
  const mask = new Uint8Array(w * h);
  let top = -1;
  for (let y = 0; y < base; y++) {
    for (let x = 0; x < w; x++) {
      if (isFlame(d, (y * w + x) * 4)) { mask[y * w + x] = 1; if (top < 0) top = y; }
    }
  }
  return top < 0 ? null : { mask, top, base };
}

/** One frame of the fire, the same size as the drawing. A drawing without a flame is returned as is. */
export function fireFrame(src: Uint8ClampedArray, w: number, h: number, frame: FireFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const f = flame(src, w, h);
  if (!f || frame === 'still') return out;
  const clear = (x: number, y: number) => out.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4);
  if (frame === 'low') {
    for (let x = 0; x < w; x++) if (f.mask[f.top * w + x]) clear(x, f.top);
    return out;
  }
  // lean: the upper part of the flame shifts 1 px, never onto the logs or stones
  const dx = frame === 'left' ? -1 : 1;
  const tipEnd = f.top + Math.max(1, Math.floor((f.base - f.top) * 0.45));
  for (let y = f.top; y < tipEnd; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) if (f.mask[y * w + x]) { row.push(x); }
    for (const x of row) clear(x, y);
    for (const x of row) {
      const nx = x + dx;
      if (nx < 0 || nx >= w) continue;
      const s = (y * w + x) * 4;
      const t = (y * w + nx) * 4;
      if (src[t + 3] > 0 && !f.mask[y * w + nx]) continue;   // something else is drawn there: leave it
      out.set(src.subarray(s, s + 4), t);
    }
  }
  return out;
}
