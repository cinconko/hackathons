// Small helpers every scene shares: text style, banners, floating text, wallet HUD, fades.
import Phaser from 'phaser';
import { PLAY, WIDTH } from './config';
import { RARITY_ORDER, RINGS, walletValue, type Wallet } from './game/rules';

/**
 * All small text: Silkscreen (public/media/fonts/silkscreen.ttf, SIL Open Font License), a pixel font
 * drawn for 8 px. The browser's monospace was not made for 8 px and came out foggy when scaled up.
 */
export const FONT = { fontFamily: 'silkscreen, monospace', fontSize: '8px', color: '#ffffff' };
/**
 * Titles: Alagard by Hewett Tsoi (public/media/fonts/alagard.ttf; "Give credit if used").
 * A pixel font drawn for 16 px: use 16 or 32, never sizes in between (they blur).
 */
export const TITLE_FONT = 'alagard, monospace';
export const title = (size: 16 | 32, color = '#ffffff') => ({ fontFamily: TITLE_FONT, fontSize: `${size}px`, color });
export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

const shownBanners = new WeakMap<Phaser.Scene, Phaser.GameObjects.Text[]>();

/** A big centred title with a line under it. A new banner replaces the one still showing. */
export function banner(scene: Phaser.Scene, title: string, sub: string, y = PLAY.y + 46) {
  shownBanners.get(scene)?.forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); });
  const t = scene.add.text(WIDTH / 2, y, title, { fontFamily: TITLE_FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(955);
  const s = scene.add.text(WIDTH / 2, y + 14, sub, { ...FONT, color: '#cccccc' }).setOrigin(0.5).setDepth(955);
  shownBanners.set(scene, [t, s]);
  scene.tweens.add({ targets: [t, s], alpha: 0, delay: 1800, duration: 500, onComplete: () => { t.destroy(); s.destroy(); } });
}

/** Take the banner off the screen at once (a window opened over it). */
export function clearBanner(scene: Phaser.Scene) {
  shownBanners.get(scene)?.forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); });
  shownBanners.delete(scene);
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
  const counts = RARITY_ORDER.map((_r, i) => scene.add.text(x + 8 + i * 24, y - 1, '', FONT).setDepth(950));
  const worth = scene.add.text(x + 76, y - 1, '', { ...FONT, color: '#ffcc44' }).setDepth(950);
  RARITY_ORDER.forEach((r, i) => ringIcon(g, x + i * 24, y, RINGS[r].color));
  return {
    update(w: Wallet) {
      RARITY_ORDER.forEach((r, i) => counts[i].setText(String(w[r])));
      worth.setText(`${walletValue(w)} rings`);
    },
  };
}

/** Fade the camera out, then start another scene (which should fade itself in). */
export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, ms = 450, rgb: [number, number, number] = [0, 0, 0]) {
  scene.cameras.main.fadeOut(ms, ...rgb);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
