import Phaser from 'phaser';
import { RINGS, RARITY_ORDER, STAGES } from '../game/rules';

// Generates all sprites in code (no art files yet). Real art goes in public/media/ (see its
// README): load it under the same texture key and delete the matching tex(...) call.
//
// Dev hooks (URL parameters), for testing a moment of the fight without playing up to it:
//   ?play            start the fight right away (skip the menu)
//   &t=30000         fight clock in ms (30000 = the fisherman has just arrived)
//   &stage=2         start the boss in stage 2 or 3
//   &shop            open the shop as soon as the fisherman is there
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const tex = (key: string, w: number, h: number, draw: () => void) => { g.clear(); draw(); g.generateTexture(key, w, h); };
    const px = (color: number, x: number, y: number, w = 1, h = 1, alpha = 1) => g.fillStyle(color, alpha).fillRect(x, y, w, h);

    // Hero 8x10: hair, face, blue tunic, belt, legs.
    tex('player', 8, 10, () => {
      px(0x5a3a1a, 1, 0, 6, 2);
      px(0xf2c79a, 1, 2, 6, 3);
      px(0x000000, 2, 3); px(0x000000, 5, 3);
      px(0x3a7bd5, 1, 5, 6, 3);
      px(0x6b4a2b, 1, 7, 6, 1);
      px(0x2b2b3a, 1, 8, 2, 2); px(0x2b2b3a, 5, 8, 2, 2);
    });

    // Boss 24x24, one sprite per stage colour (green, orange, red) plus an all-white hit flash.
    // Baked colours, not setTint: the Canvas renderer (no WebGL) ignores tints.
    const boss = (key: string, body: number, flash: boolean) => tex(key, 24, 24, () => {
      g.fillStyle(body).fillCircle(12, 13, 10);
      px(body, 3, 1, 3, 5); px(body, 18, 1, 3, 5);                   // horns
      if (flash) return;
      px(0x000000, 7, 9, 3, 4); px(0x000000, 14, 9, 3, 4);           // eyes
      px(0xffffff, 8, 10); px(0xffffff, 15, 10);                     // eye shine
      px(0x000000, 8, 17, 8, 2); px(0xffffff, 9, 17); px(0xffffff, 14, 17); // mouth + teeth
    });
    for (const s of [1, 2, 3] as const) boss(`boss_${s}`, STAGES[s].color, false);
    boss('boss_flash', 0xffffff, true);

    tex('bullet', 4, 4, () => { g.fillStyle(0xff4f7a).fillCircle(2, 2, 2); px(0xffffff, 1, 1); });
    tex('arrow', 8, 3, () => { px(0xd9c08c, 1, 1, 5, 1); px(0xe0e0e0, 6, 0, 2, 3); px(0xff4444, 0, 0, 1, 3); });
    tex('bomb', 6, 6, () => { g.fillStyle(0x222233).fillCircle(3, 3, 3); px(0x666688, 1, 1); px(0xffaa33, 4, 0); });
    tex('blast', 48, 48, () => { g.fillStyle(0xffaa33, 0.9).fillCircle(24, 24, 22); g.fillStyle(0xffffff, 0.8).fillCircle(24, 24, 11); });
    tex('slash', 20, 20, () => { g.lineStyle(3, 0xffffff, 1).beginPath().arc(10, 10, 8, -1.1, 1.1).strokePath(); });
    tex('punch', 8, 8, () => { g.fillStyle(0xffffff, 0.9).fillCircle(4, 4, 3); });
    tex('coin', 5, 5, () => { px(0xb8860b, 0, 0, 5, 5); px(0xffcc44, 1, 0, 3, 5); px(0xffcc44, 0, 1, 5, 3); px(0xfff1a8, 1, 1); });

    // Rings 7x7, one per rarity in its own colour, with a white gem on top.
    for (const r of RARITY_ORDER) {
      const c = RINGS[r].color;
      tex(`ring_${r}`, 7, 7, () => {
        px(c, 2, 0, 3, 1); px(c, 2, 6, 3, 1); px(c, 0, 2, 1, 3); px(c, 6, 2, 1, 3);
        px(c, 1, 1); px(c, 5, 1); px(c, 1, 5); px(c, 5, 5);
        px(0xffffff, 3, 0);
      });
    }

    // Fisherman 14x18: straw hat, white beard, green coat, boots, fishing rod.
    tex('fisher', 14, 18, () => {
      px(0xe8c34a, 3, 0, 8, 2); px(0xc9a136, 1, 2, 12, 1);
      px(0xf2c79a, 4, 3, 6, 3); px(0x000000, 5, 4); px(0x000000, 8, 4);
      px(0xdddddd, 4, 6, 6, 3);
      px(0x2f6f5e, 3, 9, 8, 6);
      px(0x3a2a1a, 4, 15, 2, 3); px(0x3a2a1a, 8, 15, 2, 3);
      px(0x8a6a3a, 12, 1, 1, 13);                                    // rod
      px(0xcccccc, 13, 1, 1, 9, 0.7);                                // line
    });
    g.destroy();

    const q = new URLSearchParams(window.location.search);
    if (q.has('play')) {
      this.scene.start('play', { startMs: Number(q.get('t') ?? 0), stage: Number(q.get('stage') ?? 1), openShop: q.has('shop') });
    } else {
      this.scene.start('menu');
    }
  }
}
