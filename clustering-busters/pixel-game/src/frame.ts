import Phaser from 'phaser';
import { FRAME, HEIGHT, WIDTH } from './config';

const RING_COLORS = [0x0d0d12, 0x2b2b3a, 0x4a4a66, 0x8a8ab0];
const GOLD = 0xffcc44;

export function drawFrame(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(1000);
  for (let i = 0; i < FRAME; i++) {
    g.fillStyle(RING_COLORS[i] ?? RING_COLORS[RING_COLORS.length - 1]);
    const w = WIDTH - 2 * i;
    const h = HEIGHT - 2 * i;
    g.fillRect(i, i, w, 1);
    g.fillRect(i, i + h - 1, w, 1);
    g.fillRect(i, i, 1, h);
    g.fillRect(i + w - 1, i, 1, h);
  }
  g.fillStyle(GOLD);
  for (const [x, y] of [[0, 0], [WIDTH - 2, 0], [0, HEIGHT - 2], [WIDTH - 2, HEIGHT - 2]]) {
    g.fillRect(x, y, 2, 2);
  }
  return g;
}
