export type FireFrame = 'still' | 'left' | 'right' | 'low';

export const FLICKER: readonly [FireFrame, number][] = [['still', 170], ['left', 130], ['still', 120], ['right', 140], ['still', 150], ['low', 110]];

const isFlame = (d: Uint8ClampedArray, i: number) => d[i + 3] > 0 && d[i] > 180 && d[i] - d[i + 2] > 70;

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

export function fireFrame(src: Uint8ClampedArray, w: number, h: number, frame: FireFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const f = flame(src, w, h);
  if (!f || frame === 'still') return out;
  const clear = (x: number, y: number) => out.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 4);
  if (frame === 'low') {
    for (let x = 0; x < w; x++) if (f.mask[f.top * w + x]) clear(x, f.top);
    return out;
  }
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
      if (src[t + 3] > 0 && !f.mask[y * w + nx]) continue;
      out.set(src.subarray(s, s + 4), t);
    }
  }
  return out;
}
