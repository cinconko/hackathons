// Small motion effects shared by scenes.
import Phaser from 'phaser';

export interface Hop { x: number; y: number; h: number; ms: number }

/**
 * Bounces `obj` through a list of landing points. Each hop is a parabola of height h
 * (y = lerp - h * 4t(1-t)) and spins a little; onLand runs at every touchdown.
 */
export function bounce(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.Components.Transform,
  hops: Hop[],
  opts: { spin?: number; onLand?: (x: number, y: number, i: number) => void },
  done: () => void,
) {
  const step = (i: number) => {
    if (i >= hops.length) { done(); return; }
    const hop = hops[i];
    const from = { x: obj.x, y: obj.y, r: obj.rotation };
    const t = { k: 0 };
    scene.tweens.add({
      targets: t, k: 1, duration: hop.ms, ease: 'Linear',
      onUpdate: () => {
        obj.setPosition(from.x + (hop.x - from.x) * t.k, from.y + (hop.y - from.y) * t.k - hop.h * 4 * t.k * (1 - t.k));
        obj.setRotation(from.r + (opts.spin ?? 0) * (hop.h / 30) * t.k);
      },
      onComplete: () => { opts.onLand?.(hop.x, hop.y, i); step(i + 1); },
    });
  };
  step(0);
}

/** A ring of dust where something hit the ground. */
export function dustPuff(scene: Phaser.Scene, x: number, y: number, n = 6, r = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = scene.add.image(x, y + 4, 'dust').setDepth(11);
    scene.tweens.add({ targets: d, x: x + Math.cos(a) * r, y: y + 4 + Math.sin(a) * r * 0.4, alpha: 0, duration: 420, onComplete: () => d.destroy() });
  }
}
