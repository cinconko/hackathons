import Phaser from 'phaser';

export const BASE = { w: 40, h: 22, pivot: { x: 28, y: 4 }, winch: { x: 6, y: 9 } };
export const ARM = { w: 30, pivotX: 2, len: 23 };

export interface Catapult { base: Phaser.GameObjects.Image; arm: Phaser.GameObjects.Image; winch: Phaser.GameObjects.Image; pin: Phaser.GameObjects.Image; rope: Phaser.GameObjects.Graphics; scale: number }

export function placeCatapult(s: Phaser.Scene, x: number, y: number, rotation: number, scale = 1, depth = 6): Catapult {
  const base = s.add.image(x, y, 'catapult_base').setOrigin(BASE.pivot.x / BASE.w, BASE.pivot.y / BASE.h).setScale(scale).setDepth(depth);
  const winch = s.add.image(x + (BASE.winch.x - BASE.pivot.x) * scale, y + (BASE.winch.y - BASE.pivot.y) * scale, 'catapult_winch').setScale(scale).setDepth(depth + 1);
  const arm = s.add.image(x, y, 'catapult_arm').setOrigin(ARM.pivotX / ARM.w, 0.5).setRotation(rotation).setScale(scale).setDepth(depth + 1);
  const pin = s.add.image(x, y, 'catapult_pin').setScale(scale).setDepth(depth + 2);
  const rope = s.add.graphics().setDepth(depth);
  const c = { base, arm, winch, pin, rope, scale };
  drawRope(c, rotation, 3);
  return c;
}

export function drawRope(c: Catapult, rotation: number, sag: number) {
  const k = c.scale;
  const a = { x: c.winch.x, y: c.winch.y };
  const b = { x: c.arm.x + Math.cos(rotation) * 9 * k, y: c.arm.y + Math.sin(rotation) * 9 * k };
  const steps = Math.max(2, Math.ceil(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / k));
  c.rope.clear().fillStyle(0xd8c8a0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    c.rope.fillRect(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag * k), k, k);
  }
}

export function seat(c: Catapult, rotation: number) {
  const r = ARM.len * c.scale;
  return { x: c.arm.x + Math.cos(rotation) * r, y: c.arm.y + Math.sin(rotation) * r - 4 * c.scale };
}
