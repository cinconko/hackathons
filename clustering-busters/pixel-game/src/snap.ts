export const ON_FROM = 128;

export function snapAlpha(data: Uint8ClampedArray, onFrom = ON_FROM): void {
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= onFrom ? 255 : 0;
}
