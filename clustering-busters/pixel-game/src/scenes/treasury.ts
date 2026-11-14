import Phaser from 'phaser';
import { playMusic, sfx } from '../media';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { addRings, RINGS, TREASURY, walletValue, type FightResult, type Rarity, type Wallet } from '../game/rules';
import { addKeys, near, steer, type Keys } from '../player';
import { loadSave } from '../save';
import { banner, fadeToScene, FONT, hex } from '../ui';

// The hidden room behind the arena wall. Three chests full of rings; walk into one to open it.
// When the rings are collected, walk out the door: the result screen, then home to the village.

type Sprite = Phaser.Physics.Arcade.Sprite;
export interface TreasuryData { found: Rarity[]; wallet: Wallet; timeMs: number }

const DOOR = { x: PLAY.x + 10, y: PLAY.y + PLAY.height / 2 + 8 };
const CHESTS = [
  { x: PLAY.x + 110, y: PLAY.y + 48 },
  { x: WIDTH / 2 + 30, y: PLAY.y + 40 },
  { x: PLAY.x + PLAY.width - 60, y: PLAY.y + 52 },
];

export class TreasuryScene extends Phaser.Scene {
  private player!: Sprite;
  private keys!: Keys;
  private rings: Rarity[] = [];      // found this run
  private wallet!: Wallet;           // everything you own
  private data0!: TreasuryData;
  private chests: { img: Phaser.GameObjects.Image; open: boolean }[] = [];
  private loot!: Phaser.Physics.Arcade.Group;
  private counter!: Phaser.GameObjects.Text;
  private leaving = false;
  private allDone = false;

  constructor() { super('treasury'); }

  create(data: TreasuryData) {
    this.data0 = { found: data.found ?? [], wallet: data.wallet ?? loadSave().wallet, timeMs: data.timeMs ?? 0 };
    this.rings = [...this.data0.found];
    this.wallet = { ...this.data0.wallet };
    this.leaving = false;
    this.allDone = false;
    this.physics.world.setBounds(PLAY.x + 6, PLAY.y + 20, PLAY.width - 12, PLAY.height - 26);
    this.drawRoom();

    this.add.image(DOOR.x, DOOR.y, 'door_open').setDepth(3);
    this.chests = CHESTS.map((c) => ({ img: this.add.image(c.x, c.y, 'chest').setDepth(5), open: false }));
    this.player = this.physics.add.sprite(DOOR.x + 16, DOOR.y + 4, 'player').setCollideWorldBounds(true).setDepth(10);
    this.loot = this.physics.add.group();
    this.physics.add.overlap(this.player, this.loot, (_p, r) => this.collect(r as Sprite));
    this.keys = addKeys(this);

    this.counter = this.add.text(PLAY.x + 4, PLAY.y + 4, '', { ...FONT, color: '#ffcc44' }).setDepth(950);
    drawFrame(this);
    this.cameras.main.fadeIn(500);
    playMusic(this, 'treasury');
    banner(this, 'THE TREASURY', 'Open the chests. Then walk out the door.');
  }

  update() {
    this.counter.setText(`Rings: ${walletValue(this.wallet)}`);
    if (this.leaving) return;
    steer(this.player, this.keys, 1);
    this.chests.forEach((c, i) => { if (!c.open && near(this.player, c.img.x, c.img.y + 4, 14)) this.openChest(i); });
    this.loot.getChildren().forEach((r) => { if ((r as Sprite).getData('magnet')) this.physics.moveToObject(r, this.player, 170); });

    const allOpen = this.chests.every((c) => c.open) && this.loot.countActive() === 0;
    if (allOpen && !this.allDone) { this.allDone = true; banner(this, 'THE RINGS ARE YOURS', 'Walk out the door to go home.'); }
    if (near(this.player, DOOR.x, DOOR.y, 10) && this.loot.countActive() === 0 && this.chests.some((c) => c.open)) this.leave();
  }

  private openChest(i: number) {
    const c = this.chests[i];
    c.open = true;
    c.img.setTexture('chest_open');
    sfx(this, 'door');
    this.cameras.main.shake(120, 0.006);
    TREASURY[i].forEach((rarity, n) => {
      const r = this.loot.create(c.img.x, c.img.y - 4, `ring_${rarity}`) as Sprite;
      r.setData('rarity', rarity).setDepth(8);
      const a = -Math.PI / 2 + (n / TREASURY[i].length - 0.5) * 2.4;
      (r.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(a) * 70, Math.sin(a) * 70).setDrag(80, 80);
      this.time.delayedCall(450, () => r.active && r.setData('magnet', true));
    });
  }

  private collect(r: Sprite) {
    if (!r.active || !r.getData('magnet')) return;
    const rarity = r.getData('rarity') as Rarity;
    sfx(this, 'ring', 0.4);
    this.rings.push(rarity);
    this.wallet = addRings(this.wallet, [rarity]);
    if (rarity !== 'classic') {
      const t = this.add.text(this.player.x, this.player.y - 12, RINGS[rarity].name, { ...FONT, color: hex(RINGS[rarity].color) }).setOrigin(0.5).setDepth(955);
      this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    }
    r.destroy();
  }

  private leave() {
    this.leaving = true;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    const result: FightResult = { won: true, found: this.rings, wallet: this.wallet, timeMs: this.data0.timeMs };
    fadeToScene(this, 'result', result, 500);
  }

  private drawRoom() {
    const g = this.add.graphics().setDepth(0);
    this.add.tileSprite(PLAY.x, PLAY.y + 20, PLAY.width, PLAY.height - 20, 'floor_wood').setOrigin(0).setDepth(0);  // plank floor
    this.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, 20, 'wall_wood').setOrigin(0).setDepth(0);                     // back wall
    g.fillStyle(0x000000, 0.35).fillRect(PLAY.x, PLAY.y + 20, PLAY.width, PLAY.height - 20);       // a dim, hidden room
    g.fillStyle(0x000000, 0.5).fillRect(PLAY.x, PLAY.y + 20, PLAY.width, 2);                        // shadow under the wall
    g.fillStyle(0xffcc44, 0.08).fillEllipse(WIDTH / 2, PLAY.y + 60, 220, 70);                           // gold glow
    for (const x of [PLAY.x + 60, WIDTH / 2 - 30, WIDTH / 2 + 90, PLAY.x + PLAY.width - 24]) {
      const t = this.add.image(x, PLAY.y + 12, 'torch').setDepth(2);
      this.tweens.add({ targets: t, alpha: 0.6, yoyo: true, repeat: -1, duration: 160 + (x % 7) * 20 });
    }
  }
}
