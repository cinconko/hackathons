// "In hand": weapon slots in the corner. The weapon in hand has a gold frame, the others are
// dimmed; its name and "Q: switch" beside them; in the fight a bar under it refills while it
// recharges. Shown only once you own a melee or ranged weapon (fists alone: no indicator).
import Phaser from 'phaser';
import { weapon, type WeaponId } from './game/rules';
import { FONT } from './ui';

const SLOT = 16;
const GAP = 2;

export function handHud(scene: Phaser.Scene, x: number, y: number) {
  const root = scene.add.container(x, y).setDepth(950).setVisible(false);
  let sig = '';
  let bar: Phaser.GameObjects.Graphics | null = null;

  const build = (weapons: readonly WeaponId[], current: number) => {
    root.removeAll(true);
    const bg = scene.add.graphics();
    root.add(bg);
    weapons.forEach((id, i) => {
      const sx = i * (SLOT + GAP);
      const on = i === current;
      bg.fillStyle(0x000000, 0.65).fillRect(sx, 0, SLOT, SLOT);
      bg.fillStyle(on ? 0xffcc44 : 0x55555f).fillRect(sx, 0, SLOT, 1).fillRect(sx, SLOT - 1, SLOT, 1).fillRect(sx, 0, 1, SLOT).fillRect(sx + SLOT - 1, 0, 1, SLOT);
      const ic = scene.add.image(sx + SLOT / 2, SLOT / 2, `held_${id}`);
      const long = Math.max(ic.width, ic.height);
      if (long > 10) ic.setRotation(-Math.PI / 4);          // long weapons lie diagonally to fit
      ic.setScale(Math.min(1.5, (long > 10 ? 17 : 12) / long));
      if (!on) ic.setAlpha(0.5);
      root.add(ic);
    });
    const tx = weapons.length * (SLOT + GAP) + 2;
    root.add(scene.add.text(tx, 0, weapon(weapons[current]).name, { ...FONT, color: '#ffffff' }));
    if (weapons.length > 1) root.add(scene.add.text(tx, 8, 'Q: switch', { ...FONT, color: '#9a9aa8' }));
    bar = scene.add.graphics();
    root.add(bar);
  };

  return {
    get visible() { return root.visible; },
    /** ready: 0..1 how far the weapon in hand has recharged (1 = ready, no bar). */
    update(weapons: readonly WeaponId[], current: number, ready = 1) {
      const s = `${weapons.join(',')}|${current}`;
      if (s !== sig) { sig = s; build(weapons, current); }
      if (!bar) return;
      bar.clear();
      if (ready < 1) {
        const sx = current * (SLOT + GAP);
        bar.fillStyle(0x000000, 0.7).fillRect(sx + 2, SLOT - 4, SLOT - 4, 2);
        bar.fillStyle(0xffffff).fillRect(sx + 2, SLOT - 4, Math.round((SLOT - 4) * ready), 2);
      }
    },
    show() { root.setVisible(true).setScale(1).setAlpha(1); },
    /** The first time: pops up from nothing, with sparkles. */
    reveal() {
      root.setVisible(true).setScale(0).setAlpha(1);
      scene.tweens.add({ targets: root, scale: 1, duration: 450, ease: 'Back.easeOut' });
      for (let i = 0; i < 8; i++) {
        const sp = scene.add.image(x + Phaser.Math.Between(0, 60), y + Phaser.Math.Between(-4, SLOT), 'sparkle').setDepth(951);
        scene.tweens.add({ targets: sp, y: sp.y - 12, alpha: 0, duration: 800, delay: 150 + i * 70, onComplete: () => sp.destroy() });
      }
    },
  };
}

/** You own a weapon (not just fists): the indicator is shown. */
export const hasWeapon = (weapons: readonly WeaponId[]) => weapons.length > 1;
