import Phaser from 'phaser';
import { playMusic, sfx } from '../media';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { dustPuff } from '../fx';
import { addRings, RINGS, TREASURY, walletValue, type FightResult, type Rarity, type Wallet } from '../game/rules';
import { addKeys, dress, heroLook, near, steer, type Keys } from '../player';
import { loadSave } from '../save';
import { banner, fadeToScene, FONT, hex, title } from '../ui';

// The stolen treasury: Mossback's stone vault behind the arena wall. The door bursts open, the
// three chests wait on a raised dais at the back, gold piles glint in the torchlight. Walk up to a
// chest: it flies open and the rings arc out over the floor, then come to you; a big tally at the
// top counts what the vault gave. When all are picked up, walk out the glowing door: the result
// screen (and, on the first win, the ending cutscene) takes it from there.

type Sprite = Phaser.Physics.Arcade.Sprite;
export interface TreasuryData { found: Rarity[]; wallet: Wallet; timeMs: number }

const WALL_H = 46;                                             // the back wall, from the top of the room
const FLOOR_Y = PLAY.y + WALL_H;
const DOOR = { x: PLAY.x + 12, y: PLAY.y + 116 };              // in the left wall, at floor level
const DAIS = { x: WIDTH / 2, y: FLOOR_Y - 6, w: 196, h: 24 };   // the raised stone platform for the chests
const CHESTS = [-52, 0, 52].map((dx) => ({ x: WIDTH / 2 + dx, y: DAIS.y + 6 }));
const BANNER_Y = PLAY.y + 104;                               // banners on the open floor, clear of the chests and the tally
const TORCHES = [PLAY.x + 36, PLAY.x + 104, PLAY.x + PLAY.width - 104, PLAY.x + PLAY.width - 36];
const PILES = [[PLAY.x + 34, PLAY.y + 150], [PLAY.x + PLAY.width - 34, PLAY.y + 150], [PLAY.x + 46, FLOOR_Y + 14], [PLAY.x + PLAY.width - 46, FLOOR_Y + 14]] as const;

export class TreasuryScene extends Phaser.Scene {
  private player!: Sprite;
  private keys!: Keys;
  private rings: Rarity[] = [];      // found this run (the fight's drops + the vault)
  private wallet!: Wallet;           // everything you own
  private data0!: TreasuryData;
  private chests: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Graphics; open: boolean }[] = [];
  private loot!: Phaser.Physics.Arcade.Group;
  private flying = 0;                // rings still in the air
  private counter!: Phaser.GameObjects.Text;
  private tally!: Phaser.GameObjects.Text;
  private vaultValue = 0;            // rings worth from the vault (the big tally)
  private door!: Phaser.GameObjects.Image;
  private entering = true;
  private leaving = false;
  private allDone = false;

  constructor() { super('treasury'); }

  create(data: TreasuryData) {
    this.data0 = { found: data.found ?? [], wallet: data.wallet ?? loadSave().wallet, timeMs: data.timeMs ?? 0 };
    this.rings = [...this.data0.found];
    this.wallet = { ...this.data0.wallet };
    this.entering = true;
    this.leaving = false;
    this.allDone = false;
    this.flying = 0;
    this.vaultValue = 0;
    this.physics.world.setBounds(PLAY.x + 4, FLOOR_Y + 8, PLAY.width - 8, PLAY.height - WALL_H - 10);
    this.drawRoom();

    this.door = this.add.image(DOOR.x, DOOR.y, 'door').setScale(2).setDepth(6);
    this.chests = CHESTS.map((c) => ({
      img: this.add.image(c.x, c.y, 'chest').setScale(2).setDepth(7),
      glow: this.glow(c.x, c.y, 20, 0xffcc44, 3),
      open: false,
    }));
    this.player = this.physics.add.sprite(DOOR.x, DOOR.y + 4, 'player').setCollideWorldBounds(true).setDepth(10).setVisible(false);
    dress(this.player, heroLook(this, loadSave().inventory.armor));
    this.loot = this.physics.add.group();
    this.physics.add.overlap(this.player, this.loot, (_p, r) => this.collect(r as Sprite));
    this.keys = addKeys(this);

    // HUD: your wallet top left; the vault's tally appears top centre with the first ring
    this.add.rectangle(PLAY.x, PLAY.y, 74, 12, 0x000000, 0.55).setOrigin(0).setDepth(949);
    this.counter = this.add.text(PLAY.x + 4, PLAY.y + 2, '', { ...FONT, color: '#ffcc44' }).setDepth(950);
    this.tally = this.add.text(WIDTH / 2, PLAY.y + 6, '', title(16, '#ffcc44')).setOrigin(0.5, 0).setDepth(950).setAlpha(0);
    this.tally.setStroke('#000000', 3);
    drawFrame(this);
    this.cameras.main.fadeIn(500);
    playMusic(this, 'treasury');
    this.time.delayedCall(550, () => this.burstIn());
  }

  update() {
    this.counter.setText(`${walletValue(this.wallet)} rings`);
    if (this.entering || this.leaving) return;
    steer(this.player, this.keys, 1);
    this.chests.forEach((c, i) => { if (!c.open && near(this.player, c.img.x, c.img.y + 18, 18)) this.openChest(i); });
    this.loot.getChildren().forEach((r) => { if ((r as Sprite).getData('magnet')) this.physics.moveToObject(r, this.player, 170); });

    const empty = this.loot.countActive() === 0 && this.flying === 0;
    if (this.chests.every((c) => c.open) && empty && !this.allDone) this.finish();
    if (near(this.player, DOOR.x + 6, DOOR.y + 4, 16) && empty && this.chests.some((c) => c.open)) this.leave();
  }

  /** The door bursts open (shake, dust) and you step in. */
  private burstIn() {
    sfx(this, 'door');
    this.cameras.main.shake(220, 0.01);
    this.door.setTexture('door_open');
    dustPuff(this, DOOR.x + 10, DOOR.y + 12, 10, 14);
    this.player.setVisible(true);
    this.tweens.add({
      targets: this.player, x: DOOR.x + 26, duration: 420, ease: 'Quad.easeOut',
      onComplete: () => { this.entering = false; banner(this, 'THE TREASURY', 'Walk up to the chests.', BANNER_Y); },
    });
  }

  private openChest(i: number) {
    const c = this.chests[i];
    c.open = true;
    c.img.setTexture('chest_open');
    this.tweens.add({ targets: c.glow, alpha: 0, duration: 600 });
    this.tweens.add({ targets: c.img, scaleX: 2.3, scaleY: 1.7, duration: 90, yoyo: true, ease: 'Quad.easeOut' });   // the lid kicks
    sfx(this, 'door');
    this.cameras.main.shake(160, 0.008);
    this.sparkles(c.img.x, c.img.y - 8, 8, 16);
    // the rings arc out one after another and land on the floor in front of the dais
    TREASURY[i].forEach((rarity, n) => {
      this.flying++;
      this.time.delayedCall(n * 55, () => this.flyRing(rarity, c.img.x, c.img.y - 10, n, TREASURY[i].length));
    });
  }

  /** One ring: a high arc out of the chest to a spot on the floor, then it is loot that comes to you. */
  private flyRing(rarity: Rarity, x0: number, y0: number, n: number, of: number) {
    const spread = (n / Math.max(1, of - 1) - 0.5) * 2;                    // -1 .. 1 across the burst
    const x1 = Phaser.Math.Clamp(x0 + spread * 46 + Phaser.Math.Between(-8, 8), PLAY.x + 20, PLAY.x + PLAY.width - 20);
    const y1 = FLOOR_Y + 30 + Phaser.Math.Between(0, 34);
    const ring = this.add.image(x0, y0, `ring_${rarity}`).setDepth(12);
    const peak = 26 + Phaser.Math.Between(0, 14);
    const st = { t: 0 };
    sfx(this, 'ring', 0.15);
    this.tweens.add({
      targets: st, t: 1, duration: 520, ease: 'Linear',
      onUpdate: () => ring.setPosition(x0 + (x1 - x0) * st.t, y0 + (y1 - y0) * st.t - Math.sin(st.t * Math.PI) * peak).setAngle(st.t * 360),
      onComplete: () => {
        ring.destroy();
        this.flying--;
        const r = this.loot.create(x1, y1, `ring_${rarity}`) as Sprite;
        r.setData('rarity', rarity).setDepth(8);
        this.tweens.add({ targets: r, y: y1 - 3, duration: 90, yoyo: true });   // a little bounce
        this.time.delayedCall(250, () => r.active && r.setData('magnet', true));
      },
    });
  }

  private collect(r: Sprite) {
    if (!r.active || !r.getData('magnet')) return;
    const rarity = r.getData('rarity') as Rarity;
    sfx(this, 'ring', 0.4);
    this.rings.push(rarity);
    this.wallet = addRings(this.wallet, [rarity]);
    this.vaultValue += RINGS[rarity].value;
    this.tally.setText(`+${this.vaultValue} RINGS`).setAlpha(1).setColor(hex(rarity === 'classic' ? 0xffcc44 : RINGS[rarity].color));
    this.tweens.killTweensOf(this.tally);
    this.tally.setScale(1.25);
    this.tweens.add({ targets: this.tally, scale: 1, duration: 160, ease: 'Quad.easeOut' });
    if (rarity !== 'classic') {
      const t = this.add.text(this.player.x, this.player.y - 14, RINGS[rarity].name, { ...FONT, color: hex(RINGS[rarity].color) }).setOrigin(0.5).setDepth(955);
      this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    }
    r.destroy();
  }

  /** Every chest open and every ring picked up: the total, and the door lights up. */
  private finish() {
    this.allDone = true;
    this.tally.setColor('#ffcc44');
    sfx(this, 'levelup', 0.5);
    banner(this, 'THE RINGS ARE YOURS', `+${this.vaultValue} rings from the vault. Walk out the door.`, BANNER_Y);
    this.glow(DOOR.x + 2, DOOR.y, 22, 0xffdd88, 5);
    this.sparkles(DOOR.x + 2, DOOR.y, 6, 12);
  }

  private leave() {
    this.leaving = true;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    // handed to the result screen as before: it saves this and, on the first win, plays the ending
    const result: FightResult = { won: true, found: this.rings, wallet: this.wallet, timeMs: this.data0.timeMs };
    fadeToScene(this, 'result', result, 500);
  }

  // ---- the vault ----

  /** A soft round light: see-through rings, breathing (drawn over the dark, so it shines). */
  private glow(x: number, y: number, r: number, color: number, depth: number, flat = 1): Phaser.GameObjects.Graphics {
    const g = this.add.graphics({ x, y }).setDepth(depth).setScale(1, flat);   // flat < 1: an oval pool on the floor
    for (let i = 4; i >= 1; i--) g.fillStyle(color, 0.08).fillCircle(0, 0, (r * i) / 4);
    this.tweens.add({ targets: g, scaleX: 1.08, scaleY: flat * 1.08, alpha: 0.8, yoyo: true, repeat: -1, duration: 260 + Math.min(r, 30) * 6, ease: 'Sine.easeInOut' });
    return g;
  }

  /** A few sparkles that rise and fade. */
  private sparkles(x: number, y: number, n: number, r: number) {
    for (let k = 0; k < n; k++) {
      const sp = this.add.image(x + Phaser.Math.Between(-r, r), y + Phaser.Math.Between(-r / 2, r / 2), 'sparkle').setDepth(13);
      this.tweens.add({ targets: sp, y: sp.y - 12, alpha: 0, duration: 650, delay: k * 50, onComplete: () => sp.destroy() });
    }
  }

  private drawRoom() {
    // the team's stone: brick for the walls, cobblestone for the floor, under a dark sheet
    this.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, WALL_H, 'path_brick').setOrigin(0).setDepth(0);
    this.add.tileSprite(PLAY.x, FLOOR_Y, PLAY.width, PLAY.height - WALL_H, 'path_cobble').setOrigin(0).setDepth(0);
    this.add.tileSprite(PLAY.x, FLOOR_Y, 14, PLAY.height - WALL_H, 'path_brick').setOrigin(0).setDepth(0);                     // left wall (the door)
    this.add.tileSprite(PLAY.x + PLAY.width - 14, FLOOR_Y, 14, PLAY.height - WALL_H, 'path_brick').setOrigin(0).setDepth(0);  // right wall
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x07040c, 0.62).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);               // a dark, hidden room
    g.fillStyle(0x000000, 0.35).fillRect(PLAY.x, PLAY.y, PLAY.width, 10);                          // the ceiling's shadow
    g.fillStyle(0x000000, 0.45).fillRect(PLAY.x, FLOOR_Y, PLAY.width, 3);                          // where wall meets floor
    for (const [x, w] of [[PLAY.x + 14, 2], [PLAY.x + PLAY.width - 16, 2]]) g.fillStyle(0x000000, 0.4).fillRect(x, FLOOR_Y, w, PLAY.height - WALL_H);
    // the dais: a stone platform with two steps, lit gold from the chests
    const d = this.add.graphics().setDepth(2);
    const L = DAIS.x - DAIS.w / 2;
    d.fillStyle(0x262230).fillRect(L - 8, DAIS.y + DAIS.h - 2, DAIS.w + 16, 6);                    // lower step
    d.fillStyle(0x34303e).fillRect(L - 4, DAIS.y + DAIS.h - 6, DAIS.w + 8, 5);                     // upper step
    d.fillStyle(0x4a4656).fillRect(L, DAIS.y, DAIS.w, DAIS.h - 6);                                 // the top
    d.fillStyle(0x6a6478).fillRect(L, DAIS.y, DAIS.w, 1);                                          // its lit edge
    d.fillStyle(0x7a5a1a, 0.9).fillRect(L + 6, DAIS.y + 4, DAIS.w - 12, 2);                        // a gold inlay
    this.glow(DAIS.x, DAIS.y + 10, 80, 0xffcc44, 3, 0.3);
    // torches on the back wall, each with a warm pool of light
    for (const x of TORCHES) {
      this.add.image(x, PLAY.y + 24, 'lantern').setScale(2).setDepth(4);
      this.glow(x, PLAY.y + 18, 26, 0xffaa44, 3);
    }
    // gold piles: mounds of coins and rings that glint (decoration, not loot)
    for (const [x, y] of PILES) this.goldPile(x, y);
  }

  private goldPile(x: number, y: number) {
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x6a4a10).fillEllipse(x, y + 2, 30, 10);
    g.fillStyle(0xa87a1c).fillEllipse(x, y, 24, 9);
    g.fillStyle(0xd8a82a).fillEllipse(x - 1, y - 2, 16, 7);
    g.fillStyle(0xffcc44).fillEllipse(x - 2, y - 4, 8, 4);
    for (const [dx, dy, r] of [[-9, 1, 'classic'], [7, 0, 'rare'], [1, -3, 'classic'], [10, 3, 'superRare']] as const) {
      this.add.image(x + dx, y + dy, `ring_${r}`).setDepth(3).setScale(0.7);
    }
    this.glow(x, y - 2, 14, 0xffcc44, 2);
    const glint = this.add.image(x + Phaser.Math.Between(-8, 8), y - 3, 'sparkle').setDepth(4).setAlpha(0);
    this.tweens.add({ targets: glint, alpha: 1, yoyo: true, repeat: -1, duration: 420, repeatDelay: 900 + Phaser.Math.Between(0, 1400), delay: Phaser.Math.Between(0, 1200) });
  }
}
