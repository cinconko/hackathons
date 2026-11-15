// The catapult (textures drawn in boot.ts): one place that knows how its parts fit together, used by
// the village (where you launch) and the intro (the shot where you walk up to it).
import Phaser from 'phaser';

/** Where the arm's axle sits in the base texture (40x22), and the winch's centre. */
export const BASE = { w: 40, h: 22, pivot: { x: 28, y: 4 }, winch: { x: 6, y: 9 } };
/** The arm texture (30x8): its pivot, and how far out the bucket's seat is. */
export const ARM = { w: 30, pivotX: 2, len: 23 };

export interface Catapult { base: Phaser.GameObjects.Image; arm: Phaser.GameObjects.Image; winch: Phaser.GameObjects.Image; pin: Phaser.GameObjects.Image; rope: Phaser.GameObjects.Graphics; scale: number }

/** Puts the catapult with its axle at (x, y). Depths: base and rope, winch +1, arm +1, the pin over the arm +2. */
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

/**
 * The rope from the winch drum to the arm (tied 9 px out from the hub): `sag` px of slack in the
 * middle (0 = pulled tight). It is what visibly holds the arm down.
 */
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

/** The bucket's seat (where the hero sits) for an arm at `rotation`. */
export function seat(c: Catapult, rotation: number) {
  const r = ARM.len * c.scale;
  return { x: c.arm.x + Math.cos(rotation) * r, y: c.arm.y + Math.sin(rotation) * r - 4 * c.scale };
}
