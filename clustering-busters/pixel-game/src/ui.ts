// Small helpers every scene shares: text style, banners, floating text, wallet HUD, fades.
import Phaser from 'phaser';
import { PLAY, WIDTH } from './config';
import { RARITY_ORDER, RINGS, walletValue, type Wallet } from './game/rules';

export const FONT = { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' };
export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function banner(scene: Phaser.Scene, title: string, sub: string, y = PLAY.y + 46) {
  const t = scene.add.text(WIDTH / 2, y, title, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(955);
  const s = scene.add.text(WIDTH / 2, y + 14, sub, { ...FONT, color: '#cccccc' }).setOrigin(0.5).setDepth(955);
  scene.tweens.add({ targets: [t, s], alpha: 0, delay: 1800, duration: 500, onComplete: () => { t.destroy(); s.destroy(); } });
}

export function floatText(scene: Phaser.Scene, x: number, y: number, msg: string, color: string) {
  const t = scene.add.text(x, y, msg, { ...FONT, color }).setOrigin(0.5).setDepth(955);
  scene.tweens.add({ targets: t, y: y - 10, alpha: 0, duration: 800, onComplete: () => t.destroy() });
}

/** A 6x6 ring outline. */
export function ringIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
  g.fillStyle(color).fillRect(x + 1, y, 4, 1).fillRect(x + 1, y + 5, 4, 1).fillRect(x, y + 1, 1, 4).fillRect(x + 5, y + 1, 1, 4);
}

/** Wallet HUD: three ring icons with counts and the total worth. Call update() when it changes. */
export function walletHud(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics().setDepth(950);
  const counts = RARITY_ORDER.map((_r, i) => scene.add.text(x + 8 + i * 22, y - 1, '', FONT).setDepth(950));
  const worth = scene.add.text(x + 70, y - 1, '', { ...FONT, color: '#ffcc44' }).setDepth(950);
  RARITY_ORDER.forEach((r, i) => ringIcon(g, x + i * 22, y, RINGS[r].color));
  return {
    update(w: Wallet) {
      RARITY_ORDER.forEach((r, i) => counts[i].setText(String(w[r])));
      worth.setText(`= ${walletValue(w)} rings`);
    },
  };
}

/** Fade the camera out, then start another scene (which should fade itself in). */
export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, ms = 450, rgb: [number, number, number] = [0, 0, 0]) {
  scene.cameras.main.fadeOut(ms, ...rgb);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
