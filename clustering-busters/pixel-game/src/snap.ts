// Pure pixel helpers (no Phaser), so the tests can run them in Node.

/** Alpha from which a smoothed edge pixel counts as part of the letter (0..255). */
// Silkscreen at 8 px sits exactly on the pixel grid: every real pixel of a letter is drawn at
// alpha >= 250, and the browser's smoothing adds a faint fringe around it (measured up to 87).
// At 64 that fringe turned on: O grew a tail (read as Q), 8 grew bars (read as $). 128 = the middle.
export const ON_FROM = 128;

/** Snap RGBA pixels to whole pixels: alpha becomes 0 or 255, the colour stays as drawn. */
export function snapAlpha(data: Uint8ClampedArray, onFrom = ON_FROM): void {
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= onFrom ? 255 : 0;
}
