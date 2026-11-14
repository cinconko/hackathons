import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import * as R from '../game/rules';
import { addKeys, near, steer, type Keys } from '../player';
import { bounce, dustPuff } from '../fx';
import { loadSave, updateSave } from '../save';
import { banner as showBanner, fadeToScene, floatText as showFloat } from '../ui';

// The boss fight. Rules (stages, drops, the fisherman's timing and stock, damage) come from
// game/rules.ts; this scene only moves sprites, reads input and draws.
//
// Every timer runs on fightMs, which stops while the shop is open: the boss, the bullets and
// the fisherman's 10 s stay all wait for you while you shop.
//
//   catapult ─► landing (shadow, dust, shake) ─► fight ─► boss dies, drops the key from his neck
//   ─► take the key ─► the hidden door in the west wall opens ─► treasury

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
interface Dir { x: number; y: number }
export interface PlayData { startMs?: number; stage?: number; openShop?: boolean; bossDead?: boolean; landing?: boolean; lose?: boolean }

const FONT = { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' };
const FISHER_X = WIDTH / 2;
const FISHER_Y = PLAY.y + PLAY.height - 26;
const ARROW_SPEED = 200;
const BLAST_RADIUS = 26;
const WALL = 8;                                              // the west wall's thickness
const DOOR = { x: PLAY.x + WALL / 2 + 2, y: PLAY.y + PLAY.height / 2 };

const asSprite = (o: unknown) => o as Sprite;

export class PlayScene extends Phaser.Scene {
  private rng: R.Rng = Math.random;
  private player!: Sprite;
  private boss!: Sprite;
  private fisher!: Phaser.GameObjects.Image;
  private fisherPrompt!: Phaser.GameObjects.Text;
  private bullets!: Phaser.Physics.Arcade.Group;
  private arrows!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private hud!: Phaser.GameObjects.Graphics;
  private texts!: { coins: Phaser.GameObjects.Text; weapon: Phaser.GameObjects.Text; boss: Phaser.GameObjects.Text; retailer: Phaser.GameObjects.Text; rings: Phaser.GameObjects.Text[] };
  private keys!: Keys;
  private kit!: R.Loadout;
  private door!: Phaser.GameObjects.Image;
  private keyIcon!: Phaser.GameObjects.Image;

  // fight state (reset in create, because Phaser reuses the scene object)
  private fightMs = 0;
  private hp = R.PLAYER_HP;
  private coins = R.STARTING_COINS;
  private owned: R.WeaponId[] = [];
  private weapon: R.WeaponId = 'fists';
  private rings: R.Rarity[] = [];
  private upgrades = { damage: 0, speed: 0 };
  private facing: Dir = { x: 1, y: 0 };
  private nextAttackAt = 0;
  private invulnUntil = 0;
  private bossHp = R.BOSS_MAX_HP;
  private stage: R.Stage = 1;
  private bossInvulnUntil = 0;
  private nextShotAt = 0;
  private nextDashAt = 0;
  private dashUntil = 0;
  private spiralAngle = 0;
  private bossDead = false;
  private ended = false;
  private visit = 0;
  private stock: R.ItemId[] = [];
  private sold = new Set<number>();
  private shop: Phaser.GameObjects.Container | null = null;
  private shopNote = '';
  private devOpenShop = false;
  private landed = true;
  private hasKey = false;
  private doorOpen = false;

  constructor() { super('play'); }

  create(data: PlayData = {}) {
    const startStage = (data.stage === 2 || data.stage === 3 ? data.stage : 1) as R.Stage;
    this.fightMs = Math.max(0, data.startMs ?? 0);
    this.coins = R.STARTING_COINS;
    this.kit = R.loadout(loadSave().upgrades);
    this.owned = [...this.kit.weapons];
    this.weapon = 'sword';
    this.hasKey = false;
    this.doorOpen = false;
    this.rings = [];
    this.upgrades = { damage: 0, speed: 0 };
    this.facing = { x: 1, y: 0 };
    this.nextAttackAt = 0;
    this.invulnUntil = 0;
    this.stage = startStage;
    this.bossHp = R.stageStartHp(startStage);
    this.bossInvulnUntil = 0;
    this.nextShotAt = this.fightMs + 1500;
    this.nextDashAt = this.fightMs + R.STAGES[startStage].dashEveryMs;
    this.dashUntil = 0;
    this.spiralAngle = 0;
    this.bossDead = false;
    this.ended = false;
    this.visit = 0;
    this.stock = [];
    this.sold = new Set();
    this.shop = null;
    this.shopNote = '';
    this.devOpenShop = !!data.openShop;
    this.hp = this.kit.maxHp;

    this.physics.world.setBounds(PLAY.x + WALL, PLAY.y, PLAY.width - WALL, PLAY.height);
    this.drawArena();
    this.door = this.add.image(DOOR.x, DOOR.y, 'door').setDepth(4).setVisible(false);

    this.fisher = this.add.image(FISHER_X, FISHER_Y, 'fisher').setDepth(5).setVisible(false);
    this.fisherPrompt = this.add.text(FISHER_X, FISHER_Y - 16, 'E: shop', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(950).setVisible(false);

    this.player = this.physics.add.sprite(PLAY.x + 70, PLAY.y + PLAY.height / 2, 'player').setCollideWorldBounds(true).setDepth(10);
    this.boss = this.physics.add.sprite(PLAY.x + PLAY.width - 50, PLAY.y + PLAY.height / 2, `boss_${startStage}`).setCollideWorldBounds(true).setDepth(9);
    (this.boss.body as Body).setCircle(10, 2, 2);
    this.applyBossTint();

    this.bullets = this.physics.add.group();
    this.arrows = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.physics.add.overlap(this.player, this.bullets, (_p, b) => { asSprite(b).destroy(); this.hurtPlayer(); });
    this.physics.add.overlap(this.player, this.boss, () => this.hurtPlayer());
    this.physics.add.overlap(this.boss, this.arrows, (_b, a) => {
      const arrow = asSprite(a);
      const dmg = arrow.getData('dmg') as number;
      arrow.destroy();
      this.damageBoss(dmg);
    });
    this.physics.add.overlap(this.player, this.pickups, (_p, item) => this.collect(asSprite(item)));

    this.keys = addKeys(this);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.shop || this.ended || !this.landed) return;
      const dx = p.worldX - this.player.x;
      const dy = p.worldY - this.player.y;
      const len = Math.hypot(dx, dy) || 1;
      this.facing = { x: dx / len, y: dy / len };
      this.attack(this.facing);
    });

    this.hud = this.add.graphics().setDepth(940);
    this.texts = {
      coins: this.add.text(PLAY.x + WALL + 3, PLAY.y + 10, '', { ...FONT, color: '#ffcc44' }).setDepth(950),
      weapon: this.add.text(PLAY.x + WALL + 3, PLAY.y + PLAY.height - 11, '', FONT).setDepth(950),
      boss: this.add.text(WIDTH / 2, PLAY.y + 10, '', { ...FONT, color: '#dddddd' }).setOrigin(0.5, 0).setDepth(950),
      retailer: this.add.text(PLAY.x + PLAY.width - 3, PLAY.y + 2, '', { ...FONT, color: '#9fd3ff' }).setOrigin(1, 0).setDepth(950),
      rings: R.RARITY_ORDER.map((_r, i) => this.add.text(PLAY.x + PLAY.width - 54 + i * 18 + 8, PLAY.y + PLAY.height - 11, '', FONT).setDepth(950)),
    };
    this.keyIcon = this.add.image(PLAY.x + WALL + 8 + this.kit.maxHp * 9, PLAY.y + 5, 'key').setDepth(950).setVisible(false);

    drawFrame(this);
    if (data.bossDead) { this.bossHp = 0; this.killBoss(); }
    if (data.lose) this.time.delayedCall(400, () => { this.hp = 0; this.thrownOut(); }); // dev hook
    if (data.landing) this.land();
    else { this.landed = true; if (startStage === 1 && !data.bossDead) this.banner('MOSSBACK', 'Stage 1 of 3'); }
  }

  /** Fell out of the catapult's sky: a shadow grows, the hero drops in, dust and a shake, then fight. */
  private land() {
    this.landed = false;
    this.cameras.main.fadeIn(350, 255, 255, 255);
    const x = this.player.x;
    const y = this.player.y;
    this.player.setVisible(false);
    const shadow = this.add.image(x, y + 5, 'shadow').setDepth(9).setScale(0.2);
    this.tweens.add({ targets: shadow, scale: 1.4, duration: 700, ease: 'Quad.easeIn' });
    const faller = this.add.image(x, y - 140, 'player').setDepth(12).setScale(2.5);
    this.tweens.add({
      targets: faller, y, scale: 1, duration: 700, ease: 'Quad.easeIn',
      onComplete: () => {
        faller.destroy();
        shadow.destroy();
        this.player.setVisible(true);
        this.cameras.main.shake(260, 0.02);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const d = this.add.image(x, y + 4, 'dust').setDepth(11);
          this.tweens.add({ targets: d, x: x + Math.cos(a) * 16, y: y + 4 + Math.sin(a) * 7, alpha: 0, duration: 450, onComplete: () => d.destroy() });
        }
        this.landed = true;
        this.nextShotAt = this.fightMs + 1500;
        this.banner('MOSSBACK', 'Get the key around his neck');
      },
    });
  }

  update(_t: number, delta: number) {
    if (this.ended) return;
    if (this.shop) { this.shopKeys(); return; }
    if (!this.landed) { this.drawHud(); return; }
    this.fightMs += delta;
    this.movePlayer();
    this.actionKeys();
    if (!this.bossDead) this.updateBoss();
    this.updateRetailer();
    this.cleanupProjectiles();
    if (this.bossDead) {
      this.pickups.getChildren().forEach((c) => { if ((c as Sprite).getData('kind') !== 'key') this.physics.moveToObject(c, this.player, 150); });
      if (this.hasKey && this.doorOpen && near(this.player, DOOR.x + 6, DOOR.y, 12)) this.enterTreasury();
    }
    this.drawHud();
  }

  // ---- player ------------------------------------------------------------------------

  private bonuses(): R.Bonuses {
    return { damageMul: this.kit.damageMul + this.upgrades.damage, speedMul: this.kit.speedMul + this.upgrades.speed, bonusHp: 0 };
  }

  private maxHp(): number { return this.kit.maxHp; }

  private movePlayer() {
    const dir = steer(this.player, this.keys, this.bonuses().speedMul);
    if (dir) this.facing = dir;
  }

  private actionKeys() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    if (JD(k.SPACE) || JD(k.J)) this.attack(this.facing);
    if (JD(k.Q)) this.cycleWeapon();
    (['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((name, i) => { if (JD(k[name])) this.selectWeapon(R.WEAPON_ORDER[i]); });
    if (JD(k.E) && this.nearFisher()) this.openShop();
  }

  private selectWeapon(w: R.WeaponId) {
    if (!this.owned.includes(w)) { this.floatText(this.player.x, this.player.y - 10, `no ${R.WEAPONS[w].name.toLowerCase()}`, '#ff8888'); return; }
    this.weapon = w;
  }

  private cycleWeapon() {
    const owned = R.WEAPON_ORDER.filter((w) => this.owned.includes(w));
    this.weapon = owned[(owned.indexOf(this.weapon) + 1) % owned.length];
  }

  private attack(dir: Dir) {
    const w = R.WEAPONS[this.weapon];
    if (this.fightMs < this.nextAttackAt) return;
    this.nextAttackAt = this.fightMs + w.cooldownMs;
    const dmg = R.hitDamage(this.weapon, this.bonuses().damageMul);
    if (w.kind === 'melee') this.melee(dir, w, dmg);
    else if (w.kind === 'shooting') this.shoot(dir, dmg);
    else this.throwBomb(dir, w, dmg);
  }

  private melee(dir: Dir, w: R.Weapon, dmg: number) {
    const reach = w.range * 0.6;
    const cx = this.player.x + dir.x * reach;
    const cy = this.player.y + dir.y * reach;
    const fx = this.add.image(cx, cy, w.id === 'fists' ? 'punch' : 'slash').setRotation(Math.atan2(dir.y, dir.x)).setDepth(11);
    this.tweens.add({ targets: fx, alpha: 0, duration: 140, onComplete: () => fx.destroy() });
    if (!this.bossDead && Phaser.Math.Distance.Between(cx, cy, this.boss.x, this.boss.y) < 11 + reach) this.damageBoss(dmg);
  }

  private shoot(dir: Dir, dmg: number) {
    const a = asSprite(this.arrows.create(this.player.x, this.player.y, 'arrow'));
    a.setRotation(Math.atan2(dir.y, dir.x)).setDepth(11).setData('dmg', dmg).setData('dies', this.fightMs + 1500);
    (a.body as Body).setVelocity(dir.x * ARROW_SPEED, dir.y * ARROW_SPEED);
  }

  private throwBomb(dir: Dir, w: R.Weapon, dmg: number) {
    const tx = Phaser.Math.Clamp(this.player.x + dir.x * w.range, PLAY.x + 4, PLAY.x + PLAY.width - 4);
    const ty = Phaser.Math.Clamp(this.player.y + dir.y * w.range, PLAY.y + 4, PLAY.y + PLAY.height - 4);
    const bomb = this.add.image(this.player.x, this.player.y, 'bomb').setDepth(11);
    this.tweens.add({
      targets: bomb, x: tx, y: ty, duration: 350, ease: 'Quad.easeOut',
      onComplete: () => this.time.delayedCall(450, () => {
        bomb.destroy();
        const blast = this.add.image(tx, ty, 'blast').setDepth(11).setScale(0.4);
        this.tweens.add({ targets: blast, scale: 1.2, alpha: 0, duration: 300, onComplete: () => blast.destroy() });
        this.cameras.main.shake(120, 0.01);
        if (!this.bossDead && Phaser.Math.Distance.Between(tx, ty, this.boss.x, this.boss.y) < BLAST_RADIUS) this.damageBoss(dmg);
      }),
    });
  }

  private hurtPlayer() {
    if (this.ended || this.bossDead || this.fightMs < this.invulnUntil) return;
    this.hp -= 1;
    this.invulnUntil = this.fightMs + R.INVULN_MS;
    this.cameras.main.shake(100, 0.008);
    this.tweens.add({ targets: this.player, alpha: 0.2, yoyo: true, repeat: 4, duration: 90, onComplete: () => this.player.setAlpha(1) });
    if (this.hp <= 0) this.thrownOut();
  }

  // ---- boss --------------------------------------------------------------------------

  private applyBossTint() {
    this.boss.setTexture(`boss_${this.stage}`);
  }

  private updateBoss() {
    const now = this.fightMs;
    const st = R.STAGES[this.stage];
    if (now >= this.dashUntil) {
      if (st.dashEveryMs > 0 && now >= this.nextDashAt) {
        this.physics.moveToObject(this.boss, this.player, 150);
        this.dashUntil = now + 350;
        this.nextDashAt = now + st.dashEveryMs;
      } else {
        this.physics.moveToObject(this.boss, this.player, st.speed);
      }
    }
    if (now >= this.nextShotAt && now >= this.bossInvulnUntil) {
      this.fire(st.pattern);
      this.nextShotAt = now + st.shotEveryMs;
    }
  }

  private fire(pattern: R.Pattern) {
    const { x, y } = this.boss;
    if (pattern === 'ring') {
      for (let i = 0; i < 10; i++) this.bullet(x, y, (i / 10) * Math.PI * 2, 55);
    } else if (pattern === 'aimed') {
      const a = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
      for (const d of [-0.25, 0, 0.25]) this.bullet(x, y, a + d, 85);
    } else {
      for (let i = 0; i < 4; i++) this.bullet(x, y, this.spiralAngle + (i * Math.PI) / 2, 70);
      this.spiralAngle += 0.35;
    }
  }

  private bullet(x: number, y: number, angle: number, speed: number) {
    const b = asSprite(this.bullets.create(x, y, 'bullet'));
    b.setDepth(8);
    (b.body as Body).setCircle(2).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  private damageBoss(dmg: number) {
    if (this.bossDead || this.fightMs < this.bossInvulnUntil) return;
    this.bossHp = Math.max(0, this.bossHp - dmg);
    this.boss.setTexture('boss_flash');
    this.time.delayedCall(60, () => { if (this.boss.active) this.applyBossTint(); });
    this.floatText(this.boss.x, this.boss.y - 14, `-${dmg}`, '#ffffff');
    if (this.rng() < R.COIN_ON_HIT_CHANCE) this.spawnCoin(this.boss.x, this.boss.y);
    if (this.bossHp <= 0) { this.killBoss(); return; }
    const next = R.bossStage(this.bossHp);
    for (let s = this.stage + 1; s <= next; s++) this.enterStage(s as R.Stage);
  }

  private enterStage(next: R.Stage) {
    this.stage = next;
    this.applyBossTint();
    this.bossInvulnUntil = this.fightMs + 1200;
    this.nextShotAt = this.fightMs + 1500;
    this.nextDashAt = this.fightMs + R.STAGES[next].dashEveryMs;
    this.bullets.clear(true, true);
    this.drop(R.stageDrop(this.rng));
    this.cameras.main.shake(200, 0.015);
    this.tweens.add({ targets: this.boss, alpha: 0.3, yoyo: true, repeat: 5, duration: 100, onComplete: () => this.boss.setAlpha(1) });
    this.banner(`STAGE ${next}`, R.STAGES[next].name);
  }

  private killBoss() {
    this.bossDead = true;
    this.bullets.clear(true, true);
    this.drop(R.deathDrop(this.rng));
    (this.boss.body as Body).setVelocity(0, 0).enable = false;
    this.cameras.main.shake(300, 0.02);
    this.tweens.add({ targets: this.boss, alpha: 0, scale: 1.6, duration: 900 });
    this.boss.setTexture('boss_nokey');
    const key = asSprite(this.pickups.create(this.boss.x, this.boss.y + 8, 'key'));
    key.setData('kind', 'key').setDepth(7).setCollideWorldBounds(true);
    this.tweens.add({ targets: key, y: key.y - 3, yoyo: true, repeat: -1, duration: 350 });
    this.banner('MOSSBACK FALLS', 'The key fell from his neck. Take it!');
  }

  // ---- drops -------------------------------------------------------------------------

  private drop(d: R.Drop) {
    this.spawnRing(this.boss.x, this.boss.y, d.ring);
    for (let i = 0; i < d.coins; i++) this.spawnCoin(this.boss.x, this.boss.y);
  }

  private scatter(item: Sprite) {
    const a = this.rng() * Math.PI * 2;
    const s = 40 + this.rng() * 40;
    item.setDepth(7).setCollideWorldBounds(true);
    (item.body as Body).setVelocity(Math.cos(a) * s, Math.sin(a) * s).setDrag(90, 90);
  }

  private spawnCoin(x: number, y: number) {
    const c = asSprite(this.pickups.create(x, y, 'coin'));
    c.setData('kind', 'coin');
    this.scatter(c);
  }

  private spawnRing(x: number, y: number, rarity: R.Rarity) {
    const r = asSprite(this.pickups.create(x, y, `ring_${rarity}`));
    r.setData('kind', 'ring').setData('rarity', rarity);
    this.scatter(r);
    this.tweens.add({ targets: r, scale: 1.3, yoyo: true, repeat: -1, duration: 400 });
  }

  private collect(item: Sprite) {
    if (!item.active) return;
    const kind = item.getData('kind');
    if (kind === 'coin') this.coins++;
    else if (kind === 'key') this.takeKey();
    else this.addRing(item.getData('rarity') as R.Rarity);
    item.destroy();
  }

  private takeKey() {
    this.hasKey = true;
    this.keyIcon.setVisible(true);
    this.time.delayedCall(700, () => this.revealDoor());
  }

  /** The key glows and part of the west wall turns out to be a door. */
  private revealDoor() {
    this.doorOpen = true;
    this.door.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.door, alpha: 1, duration: 600 });
    this.cameras.main.shake(300, 0.012);
    for (let i = 0; i < 6; i++) {
      const sp = this.add.image(DOOR.x + Phaser.Math.Between(-4, 4), DOOR.y + Phaser.Math.Between(-8, 8), 'sparkle').setDepth(12);
      this.tweens.add({ targets: sp, alpha: 0, y: sp.y - 8, duration: 900, delay: i * 120, onComplete: () => sp.destroy() });
    }
    this.time.delayedCall(400, () => this.door.setTexture('door_open'));
    this.banner('A HIDDEN DOOR!', 'West wall. The treasury is behind it.');
  }

  private enterTreasury() {
    if (this.ended) return;
    this.ended = true;
    (this.player.body as Body).setVelocity(0, 0);
    // rings still on the floor are yours
    for (const c of this.pickups.getChildren() as Sprite[]) if (c.getData('kind') === 'ring') this.rings.push(c.getData('rarity') as R.Rarity);
    fadeToScene(this, 'treasury', { rings: [...this.rings], coins: this.coins, timeMs: Math.round(this.fightMs) }, 500);
  }

  private addRing(rarity: R.Rarity) {
    this.rings.push(rarity);
    const info = R.RINGS[rarity];
    this.floatText(this.player.x, this.player.y - 12, info.name, `#${info.color.toString(16).padStart(6, '0')}`);
  }

  // ---- the fisherman -----------------------------------------------------------------

  private nearFisher(): boolean {
    return this.visit > 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, FISHER_X, FISHER_Y) < 24;
  }

  private updateRetailer() {
    const v = this.bossDead ? 0 : R.retailerVisit(this.fightMs);
    if (v !== this.visit) {
      this.visit = v;
      if (v > 0) {
        this.stock = R.rollStock(this.rng, this.owned);
        this.sold = new Set();
        this.fisher.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.fisher, alpha: 1, duration: 300 });
        this.banner('THE FISHERMAN IS HERE', 'Go to the pond, press E');
      } else {
        this.tweens.add({ targets: this.fisher, alpha: 0, duration: 300, onComplete: () => this.fisher.setVisible(false) });
      }
    }
    this.fisherPrompt.setVisible(this.nearFisher());
    if (this.devOpenShop && this.visit > 0) { this.devOpenShop = false; this.openShop(); }
  }

  private openShop() {
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    this.shopNote = '';
    this.renderShop();
  }

  private closeShop() {
    this.shop?.destroy();
    this.shop = null;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
  }

  private shopKeys() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    (['ONE', 'TWO', 'THREE'] as const).forEach((name, i) => { if (JD(k[name])) this.buy(i); });
    if (JD(k.E) || JD(k.ESC)) this.closeShop();
  }

  private buy(i: number) {
    if (i >= this.stock.length) return;
    if (this.sold.has(i)) { this.shopNote = 'Already sold.'; this.renderShop(); return; }
    const id = this.stock[i];
    const item = R.ITEMS[id];
    if (this.coins < item.price) { this.shopNote = `Not enough coins (${item.price}c).`; this.renderShop(); return; }
    this.coins -= item.price;
    this.sold.add(i);
    this.shopNote = `Bought: ${item.name}.`;
    if (item.weapon) { this.owned.push(item.weapon); this.weapon = item.weapon; }
    else if (id === 'potion') this.hp = Math.min(this.maxHp(), this.hp + 2);
    else if (id === 'bigPotion') this.hp = this.maxHp();
    else if (id === 'whetstone') this.upgrades.damage += 0.2;
    else if (id === 'boots') this.upgrades.speed += 0.15;
    else if (id === 'mysteryRing') { const r = R.rollRing(this.rng); this.addRing(r); this.shopNote = `Bought: ${R.RINGS[r].name}!`; }
    this.renderShop();
  }

  private renderShop() {
    this.shop?.destroy();
    const w = 228;
    const h = 100;
    const x = (WIDTH - w) / 2;
    const y = PLAY.y + 30;
    const c = this.add.container(0, 0).setDepth(960);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);   // dim the fight
    bg.fillStyle(0x10202a).fillRect(x, y, w, h);
    bg.fillStyle(0x2d6fa3).fillRect(x, y, w, 1).fillRect(x, y + h - 1, w, 1).fillRect(x, y, 1, h).fillRect(x + w - 1, y, 1, h);
    c.add(bg);
    c.add(this.add.image(x + 14, y + 16, 'fisher'));
    c.add(this.add.text(x + 28, y + 6, "THE FISHERMAN'S CATCH", { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 28, y + 16, `"Three things today, friend." You have ${this.coins}c`, { ...FONT, color: '#9fd3ff' }));
    this.stock.forEach((id, i) => {
      const item = R.ITEMS[id];
      const sold = this.sold.has(i);
      const color = sold ? '#555555' : this.coins >= item.price ? '#ffffff' : '#ff8888';
      const line = `${i + 1}  ${item.name.padEnd(12)} ${sold ? 'SOLD' : `${item.price}c`.padStart(4)}  ${item.desc}`;
      c.add(this.add.text(x + 8, y + 34 + i * 13, line, { ...FONT, color }));
    });
    if (this.shopNote) c.add(this.add.text(x + 8, y + 74, this.shopNote, { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 8, y + h - 12, '1-3: buy    E / Esc: back to the fight', { ...FONT, color: '#888888' }));
    this.shop = c;
  }

  // ---- HUD and effects ---------------------------------------------------------------

  private drawHud() {
    const g = this.hud.clear();
    for (let i = 0; i < this.maxHp(); i++) this.heart(g, PLAY.x + WALL + 3 + i * 9, PLAY.y + 3, i < this.hp);

    const bw = 110;
    const bx = WIDTH / 2 - bw / 2;
    const by = PLAY.y + 4;
    g.fillStyle(0x000000).fillRect(bx - 1, by - 1, bw + 2, 6);
    g.fillStyle(0x333333).fillRect(bx, by, bw, 4);
    g.fillStyle(R.STAGES[this.stage].color).fillRect(bx, by, Math.round((bw * this.bossHp) / R.BOSS_MAX_HP), 4);
    g.fillStyle(0xffffff).fillRect(bx + Math.round(bw / 3), by - 1, 1, 6).fillRect(bx + Math.round((bw * 2) / 3), by - 1, 1, 6);

    R.RARITY_ORDER.forEach((r, i) => {
      const rx = PLAY.x + PLAY.width - 54 + i * 18;
      const ry = PLAY.y + PLAY.height - 10;
      const c = R.RINGS[r].color;
      g.fillStyle(c).fillRect(rx + 1, ry, 4, 1).fillRect(rx + 1, ry + 5, 4, 1).fillRect(rx, ry + 1, 1, 4).fillRect(rx + 5, ry + 1, 1, 4);
    });
    const counts = R.countRings(this.rings);
    R.RARITY_ORDER.forEach((r, i) => this.texts.rings[i].setText(`${counts[r]}`));

    this.texts.coins.setText(`${this.coins}c`);
    this.texts.weapon.setText(`${R.WEAPONS[this.weapon].name}  Q: switch`);
    this.texts.boss.setText(!this.bossDead ? `MOSSBACK  stage ${this.stage}/3` : this.doorOpen ? '<- the hidden door is west' : 'Take the key!');
    const here = this.visit > 0;
    const secs = Math.ceil((here ? R.msUntilRetailerLeaves(this.fightMs) : R.msUntilRetailer(this.fightMs)) / 1000);
    this.texts.retailer.setText(this.bossDead ? '' : here ? `Fisherman here ${secs}s` : `Fisherman in ${secs}s`);
  }

  private heart(g: Phaser.GameObjects.Graphics, x: number, y: number, full: boolean) {
    g.fillStyle(full ? 0xe03a4a : 0x442228);
    g.fillRect(x + 1, y, 2, 1).fillRect(x + 4, y, 2, 1).fillRect(x, y + 1, 7, 2).fillRect(x + 1, y + 3, 5, 1).fillRect(x + 2, y + 4, 3, 1).fillRect(x + 3, y + 5, 1, 1);
  }

  private drawArena() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x1f2a1f).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    for (let i = 0; i < 160; i++) {
      const x = PLAY.x + ((i * 53) % PLAY.width);
      const y = PLAY.y + ((i * 97 + (i % 7) * 13) % PLAY.height);
      g.fillStyle(i % 9 === 0 ? 0x3d4a35 : 0x2c3b28).fillRect(x, y, i % 9 === 0 ? 2 : 1, 1);
    }
    // the west wall (the treasury door hides in it)
    g.fillStyle(0x55555f).fillRect(PLAY.x, PLAY.y, WALL, PLAY.height);
    for (let y = 0; y < PLAY.height; y += 6) g.fillStyle(0x45454f).fillRect(PLAY.x, PLAY.y + y, WALL, 1);
    g.fillStyle(0x6a6a74).fillRect(PLAY.x + WALL - 1, PLAY.y, 1, PLAY.height);
    // the fisherman's pond, bottom centre
    const pw = 52;
    const px = FISHER_X - pw / 2;
    const py = PLAY.y + PLAY.height - 16;
    g.fillStyle(0x1e4f7a).fillRect(px, py, pw, 12);
    g.fillStyle(0x2d6fa3).fillRect(px + 2, py, pw - 4, 1).fillRect(px + 8, py + 5, 6, 1).fillRect(px + 30, py + 8, 8, 1);
    g.fillStyle(0x6b4a2b).fillRect(FISHER_X - 6, py - 2, 12, 3);    // dock
  }

  private banner(title: string, sub: string) { showBanner(this, title, sub); }

  private floatText(x: number, y: number, msg: string, color: string) { showFloat(this, x, y, msg, color); }

  private cleanupProjectiles() {
    const out = (o: Sprite) => o.x < PLAY.x - 2 || o.x > PLAY.x + PLAY.width + 2 || o.y < PLAY.y - 2 || o.y > PLAY.y + PLAY.height + 2;
    for (const b of [...this.bullets.getChildren()] as Sprite[]) if (out(b)) b.destroy();
    for (const a of [...this.arrows.getChildren()] as Sprite[]) if (out(a) || this.fightMs > (a.getData('dies') as number)) a.destroy();
  }

  /**
   * Lost the fight: no death screen. Mossback slams the hero, who bounces away across the arena
   * and out of sight, back to the village (where he bounces in and gets up). The rings picked up
   * so far are saved first: nothing after this would save them.
   */
  private thrownOut() {
    if (this.ended) return;
    this.ended = true;
    const rings = [...this.rings];
    updateSave((s) => ({ ...s, wallet: R.addRings(s.wallet, rings), lifetimeRings: R.addRings(s.lifetimeRings, rings) }));

    // freeze the fight
    (this.player.body as Body).setVelocity(0, 0).enable = false;
    (this.boss.body as Body).setVelocity(0, 0).enable = false;
    this.bullets.clear(true, true);
    this.arrows.clear(true, true);
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(1);
    this.fisherPrompt.setVisible(false);
    this.banner('MOSSBACK SMASHES YOU', '...all the way back to the village');

    const p = this.player;
    const dir = p.x <= this.boss.x ? -1 : 1;                 // away from him
    const clampX = (x: number) => Phaser.Math.Clamp(x, PLAY.x + WALL + 6, PLAY.x + PLAY.width - 6);
    // the slam: he squashes, springs, the ground shakes
    this.tweens.add({
      targets: this.boss, scaleY: 0.75, scaleX: 1.2, duration: 160, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => {
        this.cameras.main.shake(260, 0.025);
        bounce(this, p, [
          { x: clampX(p.x + dir * 45), y: p.y, h: 30, ms: 420 },
          { x: clampX(p.x + dir * 75), y: p.y, h: 16, ms: 300 },
        ], { spin: dir * Math.PI * 2, onLand: (x, y) => { dustPuff(this, x, y); this.cameras.main.shake(90, 0.01); } }, () => this.bounceOut());
      },
    });
  }

  /** The last bounce is a big one: up, toward the camera, out of sight. White flash, village. */
  private bounceOut() {
    const p = this.player;
    this.tweens.add({ targets: p, y: PLAY.y - 30, scale: 2.6, rotation: p.rotation - Math.PI * 3, duration: 650, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.boss, y: this.boss.y - 5, yoyo: true, repeat: 3, duration: 140 });   // he laughs
    this.time.delayedCall(450, () => {
      this.cameras.main.fadeOut(350, 255, 255, 255);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('village', { bouncedBack: true, kept: this.rings.length }));
    });
  }
}
