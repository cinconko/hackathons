import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { buyUpgrade, VILLAGE_ITEMS, VILLAGE_ORDER, type UpgradeId } from '../game/rules';
import { addKeys, near, steer, type Keys } from '../player';
import { loadSave, updateSave } from '../save';
import { dustPuff, bounce } from '../fx';
import { banner, FONT, walletHud } from '../ui';

// The hub between fights. Walk around, spend rings at the ring merchant, then jump into the
// catapult to fly into Mossback's arena.

type Sprite = Phaser.Physics.Arcade.Sprite;

const STALL = { x: PLAY.x + 120, y: PLAY.y + 46 };
const MERCHANT = { x: STALL.x, y: STALL.y - 6 };
const CATAPULT = { x: PLAY.x + PLAY.width - 40, y: PLAY.y + 104 };   // pivot of the arm
const ARM_REST = Math.PI * 0.92;     // arm lying back, bucket near the ground
const ARM_FIRE = -Math.PI * 0.35;    // arm after the throw
const ARM_LEN = 24;

export class VillageScene extends Phaser.Scene {
  private player!: Sprite;
  private keys!: Keys;
  private arm!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private wallet!: ReturnType<typeof walletHud>;
  private shop: Phaser.GameObjects.Container | null = null;
  private shopNote = '';
  private launching = false;

  constructor() { super('village'); }

  create(data: { fromIntro?: boolean; bouncedBack?: boolean; kept?: number } = {}) {
    this.shop = null;
    this.launching = false;
    this.shopNote = '';
    this.physics.world.setBounds(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    const solids = this.drawVillage();

    this.add.image(MERCHANT.x, MERCHANT.y, 'merchant').setDepth(6);
    this.add.image(STALL.x, STALL.y + 4, 'stall').setDepth(7);
    this.add.text(STALL.x, STALL.y - 22, 'RING MERCHANT', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(8);
    this.add.image(CATAPULT.x - 2, CATAPULT.y + 6, 'catapult_base').setDepth(6);
    this.arm = this.add.image(CATAPULT.x, CATAPULT.y, 'catapult_arm').setOrigin(0, 0.5).setRotation(ARM_REST).setDepth(7);
    this.add.text(PLAY.x + PLAY.width - 52, CATAPULT.y - 30, "TO MOSSBACK'S LAIR", { ...FONT, color: '#ff8888' }).setOrigin(0.5).setDepth(8);

    this.player = this.physics.add.sprite(PLAY.x + 30, PLAY.y + 112, 'player').setCollideWorldBounds(true).setDepth(10);
    this.physics.add.collider(this.player, solids);
    this.keys = addKeys(this);

    this.prompt = this.add.text(0, 0, '', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(950);
    this.wallet = walletHud(this, PLAY.x + 4, PLAY.y + 4);
    this.wallet.update(loadSave().wallet);
    this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 3, 'WASD move   E use', { ...FONT, color: '#556655' }).setOrigin(1, 0).setDepth(950);

    drawFrame(this);
    if (data.bouncedBack) {
      this.bounceIn(data.kept ?? 0);
    } else {
      this.cameras.main.fadeIn(data.fromIntro ? 900 : 500);
      banner(this, 'RINGFALL VILLAGE', 'Rings buy gear here. The catapult is east.');
    }
  }

  /** Bounced back by Mossback: comes bouncing in along the road from the east, skids, lies dizzy, gets up. */
  private bounceIn(kept: number) {
    this.launching = true; // no control until he is back on his feet
    this.cameras.main.fadeIn(350, 255, 255, 255);
    const roadY = PLAY.y + 112;
    const p = this.player;
    p.setPosition(PLAY.x + PLAY.width + 16, roadY - 40).setRotation(0);
    const thud = (x: number, y: number, i: number) => {
      dustPuff(this, x, y, 6, 14 - i * 2);
      this.cameras.main.shake(140 - i * 30, 0.018 - i * 0.004);
    };
    bounce(this, p, [
      { x: PLAY.x + 250, y: roadY, h: 34, ms: 520 },
      { x: PLAY.x + 205, y: roadY, h: 18, ms: 380 },
      { x: PLAY.x + 175, y: roadY, h: 8, ms: 260 },
      { x: PLAY.x + 160, y: roadY, h: 3, ms: 160 },
    ], { spin: -Math.PI * 2, onLand: thud }, () => {
      // skid to a stop, flat on his back
      this.tweens.add({ targets: p, x: p.x - 8, rotation: -Math.PI / 2, duration: 260, ease: 'Quad.easeOut', onComplete: () => this.dizzy(kept) });
    });
  }

  /** Stars circle his head, then he hops back onto his feet. */
  private dizzy(kept: number) {
    const p = this.player;
    const stars = [0, 1, 2].map(() => this.add.image(p.x, p.y - 8, 'sparkle').setDepth(12));
    const spin = { a: 0 };
    this.tweens.add({
      targets: spin, a: Math.PI * 6, duration: 1500,
      onUpdate: () => stars.forEach((st, i) => st.setPosition(p.x + Math.cos(spin.a + i * 2.1) * 7, p.y - 9 + Math.sin(spin.a + i * 2.1) * 2)),
      onComplete: () => {
        stars.forEach((st) => st.destroy());
        // get up: a little hop that turns him upright
        this.tweens.add({ targets: p, rotation: 0, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({
          targets: p, y: p.y - 6, duration: 130, yoyo: true, ease: 'Quad.easeOut',
          onComplete: () => {
            this.launching = false;
            banner(this, 'BOUNCED BACK HOME', kept ? `You kept ${kept} ring${kept === 1 ? '' : 's'}. The catapult is ready.` : 'No rings this time. The catapult is ready.');
          },
        });
      },
    });
    this.wallet.update(loadSave().wallet);
  }

  update() {
    if (this.launching) return;
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    if (this.shop) {
      VILLAGE_ORDER.forEach((id, i) => { if (JD(k[['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'][i]])) this.buy(id); });
      if (JD(k.E) || JD(k.ESC)) this.closeShop();
      return;
    }
    steer(this.player, k, 1);
    const atShop = near(this.player, STALL.x, STALL.y + 16, 22);
    const atCatapult = near(this.player, CATAPULT.x - 8, CATAPULT.y + 6, 22);
    if (atShop) this.prompt.setText('E: shop').setPosition(STALL.x, STALL.y + 26).setVisible(true);
    else if (atCatapult) this.prompt.setText('E: launch!').setPosition(CATAPULT.x - 6, CATAPULT.y + 20).setVisible(true);
    else this.prompt.setVisible(false);
    if (JD(k.E) || JD(k.ENTER)) {
      if (atShop) this.openShop();
      else if (atCatapult) this.launch();
    }
  }

  // ---- shop ----

  private openShop() {
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.shopNote = '';
    this.renderShop();
  }

  private closeShop() { this.shop?.destroy(); this.shop = null; this.prompt.setVisible(false); }

  private buy(id: UpgradeId) {
    const s = loadSave();
    const r = buyUpgrade(s.wallet, s.upgrades, id);
    const item = VILLAGE_ITEMS[id];
    if (!r.ok) {
      this.shopNote = r.reason === 'maxed' ? `${item.name}: you have all of them.` : `${item.name} costs ${item.price} rings. Beat Mossback for more.`;
    } else {
      updateSave((x) => ({ ...x, wallet: r.wallet, upgrades: r.upgrades }));
      this.wallet.update(r.wallet);
      this.shopNote = `Bought: ${item.name}.`;
    }
    this.renderShop();
  }

  private renderShop() {
    this.shop?.destroy();
    const s = loadSave();
    const w = 240;
    const h = 112;
    const x = (WIDTH - w) / 2;
    const y = PLAY.y + 24;
    const c = this.add.container(0, 0).setDepth(960);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6).fillRect(PLAY.x, PLAY.y + 14, PLAY.width, PLAY.height - 14);
    bg.fillStyle(0x1e1430).fillRect(x, y, w, h);
    bg.fillStyle(0x8a5fc0).fillRect(x, y, w, 1).fillRect(x, y + h - 1, w, 1).fillRect(x, y, 1, h).fillRect(x + w - 1, y, 1, h);
    c.add(bg);
    c.add(this.add.image(x + 12, y + 14, 'merchant'));
    c.add(this.add.text(x + 24, y + 5, 'THE RING MERCHANT', { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 24, y + 15, '"Rings only. Classic 1, rare 5, super rare 20."', { ...FONT, color: '#c9a8ff' }));
    VILLAGE_ORDER.forEach((id, i) => {
      const item = VILLAGE_ITEMS[id];
      const lvl = s.upgrades[id];
      const maxed = lvl >= item.max;
      const color = maxed ? '#666666' : '#ffffff';
      const line = `${i + 1} ${item.name.padEnd(12)} ${maxed ? ' MAX' : `${item.price}`.padStart(4)}  ${`${lvl}/${item.max}`}  ${item.desc}`;
      c.add(this.add.text(x + 8, y + 32 + i * 11, line, { ...FONT, color }));
    });
    if (this.shopNote) c.add(this.add.text(x + 8, y + 88, this.shopNote, { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 8, y + h - 11, '1-5: buy (price in rings)    E / Esc: leave', { ...FONT, color: '#888888' }));
    this.shop = c;
  }

  // ---- catapult ----

  private bucket(rotation: number) {
    return { x: CATAPULT.x + Math.cos(rotation) * ARM_LEN, y: CATAPULT.y + Math.sin(rotation) * ARM_LEN - 3 };
  }

  private launch() {
    this.launching = true;
    this.prompt.setVisible(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0).enable = false;
    const seat = this.bucket(ARM_REST);
    // 1. climb into the bucket
    this.tweens.add({
      targets: this.player, x: seat.x, y: seat.y, duration: 400, ease: 'Quad.easeOut',
      onComplete: () => {
        // 2. wind up (arm pulls back a little), then fire: the arm swings and carries the hero
        const state = { r: ARM_REST };
        const follow = () => {
          this.arm.setRotation(state.r);
          const b = this.bucket(state.r);
          this.player.setPosition(b.x, b.y);
        };
        this.tweens.add({
          targets: state, r: ARM_REST + 0.12, duration: 350, ease: 'Sine.easeInOut', onUpdate: follow,
          onComplete: () => this.tweens.add({ targets: state, r: ARM_FIRE, duration: 220, ease: 'Quad.easeIn', onUpdate: follow, onComplete: () => this.fly() }),
        });
      },
    });
  }

  private fly() {
    this.cameras.main.shake(150, 0.01);
    const start = { x: this.player.x, y: this.player.y };
    const t = { p: 0 };
    // 3. a high arc to the north-east, growing (closer to the camera) and spinning, then gone
    this.tweens.add({
      targets: t, p: 1, duration: 1100, ease: 'Sine.easeIn',
      onUpdate: () => {
        this.player.setPosition(start.x + 80 * t.p, start.y - 150 * t.p + 60 * t.p * t.p);
        this.player.setScale(1 + 2.5 * t.p).setRotation(t.p * Math.PI * 4);
      },
    });
    this.time.delayedCall(800, () => {
      this.cameras.main.fadeOut(400, 255, 255, 255);   // white flash: the jump cut into the arena
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('play', { landing: true }));
    });
  }

  // ---- the village itself ----

  private drawVillage(): Phaser.Physics.Arcade.StaticGroup {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x4f8a3a).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    for (let i = 0; i < 180; i++) {
      g.fillStyle(i % 5 ? 0x5c9a44 : 0x3f7a30).fillRect(PLAY.x + ((i * 53) % PLAY.width), PLAY.y + ((i * 97 + (i % 7) * 13) % PLAY.height), 1, 1);
    }
    g.fillStyle(0xc8a86a).fillRect(PLAY.x, PLAY.y + 104, PLAY.width - 48, 16);                     // main road
    g.fillStyle(0xb8985a).fillRect(PLAY.x, PLAY.y + 104, PLAY.width - 48, 1).fillRect(PLAY.x, PLAY.y + 119, PLAY.width - 48, 1);
    g.fillStyle(0xc8a86a).fillRect(STALL.x - 6, STALL.y + 14, 12, 90);                              // path to the stall
    g.fillStyle(0x6a6a6a).fillCircle(PLAY.x + 70, PLAY.y + 140, 7);                                   // well
    g.fillStyle(0x1e4f7a).fillCircle(PLAY.x + 70, PLAY.y + 140, 4);

    const solids = this.physics.add.staticGroup();
    const block = (x: number, y: number, w: number, h: number) => solids.add(this.add.zone(x, y, w, h));
    for (const [x, y] of [[PLAY.x + 34, PLAY.y + 40], [PLAY.x + 200, PLAY.y + 38], [PLAY.x + 236, PLAY.y + 48]] as const) {
      this.add.image(x, y, 'house').setDepth(5);
      block(x, y + 5, 26, 14);
    }
    for (const [x, y] of [[PLAY.x + 80, PLAY.y + 24], [PLAY.x + 160, PLAY.y + 150], [PLAY.x + 14, PLAY.y + 82], [PLAY.x + 280, PLAY.y + 150], [PLAY.x + 170, PLAY.y + 20]] as const) {
      this.add.image(x, y, 'tree').setDepth(5);
      block(x, y + 6, 6, 6);
    }
    block(STALL.x, STALL.y + 10, 40, 8);                    // the counter
    block(PLAY.x + 70, PLAY.y + 140, 12, 10);              // the well
    block(CATAPULT.x - 2, CATAPULT.y + 10, 24, 6);         // the catapult frame
    solids.refresh();
    return solids;
  }
}
