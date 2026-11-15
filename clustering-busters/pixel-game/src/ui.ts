import Phaser from 'phaser';
import { PLAY, WIDTH } from './config';
import { RARITY_ORDER, walletValue, type Wallet } from './game/rules';

export const FONT = { fontFamily: 'silkscreen, monospace', fontSize: '8px', color: '#ffffff' };
export const TITLE_FONT = 'alagard, monospace';
export const title = (size: 16 | 32, color = '#ffffff') => ({ fontFamily: TITLE_FONT, fontSize: `${size}px`, color });
export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

const shownBanners = new WeakMap<Phaser.Scene, (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[]>();

export function banner(scene: Phaser.Scene, title: string, sub: string, y = PLAY.y + 46) {
  shownBanners.get(scene)?.forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); });
  const t = scene.add.text(WIDTH / 2, y, title, { fontFamily: TITLE_FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(955);
  const s = scene.add.text(WIDTH / 2, y + 14, sub, { ...FONT, color: '#cccccc' }).setOrigin(0.5).setDepth(955);
  const w = Math.min(PLAY.width - 4, Math.ceil(Math.max(t.width, s.width)) + 16);
  const band = scene.add.graphics().setDepth(954);
  band.fillStyle(0x000000, 0.72).fillRect(Math.round(WIDTH / 2 - w / 2), Math.round(y - 11), w, 32);
  const all = [band, t, s];
  shownBanners.set(scene, all);
  scene.tweens.add({ targets: all, alpha: 0, delay: 1800, duration: 500, onComplete: () => all.forEach((o) => o.destroy()) });
}

export function clearBanner(scene: Phaser.Scene) {
  shownBanners.get(scene)?.forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); });
  shownBanners.delete(scene);
}

export function floatText(scene: Phaser.Scene, x: number, y: number, msg: string, color: string) {
  const t = scene.add.text(x, y, msg, { ...FONT, color }).setOrigin(0.5).setDepth(955);
  scene.tweens.add({ targets: t, y: y - 10, alpha: 0, duration: 800, onComplete: () => t.destroy() });
}

export function walletHud(scene: Phaser.Scene, x: number, y: number) {
  const counts = RARITY_ORDER.map((_r, i) => scene.add.text(x + 10 + i * 25, y - 1, '', FONT).setDepth(950));
  const worth = scene.add.text(x + 79, y - 1, '', { ...FONT, color: '#ffcc44' }).setDepth(950);
  RARITY_ORDER.forEach((r, i) => scene.add.image(x + 4 + i * 25, y + 2, `ring_${r}`).setDepth(950));
  return {
    update(w: Wallet) {
      RARITY_ORDER.forEach((r, i) => counts[i].setText(String(w[r])));
      worth.setText(`${walletValue(w)} rings`);
    },
  };
}

export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, ms = 450, rgb: [number, number, number] = [0, 0, 0]) {
  scene.cameras.main.fadeOut(ms, ...rgb);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
