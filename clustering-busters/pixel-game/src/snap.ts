// Pure pixel helpers (no Phaser), so the tests can run them in Node.

/** Alpha from which a smoothed edge pixel counts as part of the letter (0..255). */
export const ON_FROM = 64;     // low enough to keep thin strokes like ( ) and / whole

/** Snap RGBA pixels to whole pixels: alpha becomes 0 or 255, the colour stays as drawn. */
export function snapAlpha(data: Uint8ClampedArray, onFrom = ON_FROM): void {
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= onFrom ? 255 : 0;
}
