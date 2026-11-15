import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { bounce, dustPuff } from '../fx';
import * as R from '../game/rules';
import { Combat, SPELL_SPEED } from '../combat';
import { addKeys, dress, heroLook, near, steer, type Keys } from '../player';
import { handHud, hasWeapon } from '../hand';
import { hideHandArt, showHandArt } from '../handArt';
import { playMusic, sfx } from '../media';
import { loadSave, updateSave } from '../save';
import { banner as showBanner, clearBanner, fadeToScene, floatText as showFloat, FONT, walletHud } from '../ui';
import { BOOK_H, BOOK_PAGE, clothPatch, crisp, priceTag, shopBook, wareArt } from '../shopArt';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
export interface PlayData { startMs?: number; stage?: number; openShop?: boolean; bossDead?: boolean; landing?: boolean; lose?: boolean }

const FISHER_X = WIDTH / 2;
const PLANK = 0x7a5530;
const NET_SHADE = 0.25;
const FISHER_Y = PLAY.y + PLAY.height - 26;
const WALL = 8;
const DOOR = { x: PLAY.x + WALL / 2 + 2, y: PLAY.y + PLAY.height / 2 };
const SPECIAL_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'] as const;

const asSprite = (o: unknown) => o as Sprite;

interface Telegraph { kind: 'aimed' | 'dash' | 'ring'; angle: number; fireAt: number; from: number }
interface BossKick { kind: 'smash' | 'throw' | 'slam' | 'flick'; angle: number; at: number; ms: number }
const RING_BALLS = 10;
const SPIRAL_ARMS = 4;
const SPIRAL_TURN = 0.35;
const SPIRAL_WARN_MS = 400;
const DASH_SPEED = 150;
const DASH_MS = 350;
const MELEE_REACH = 30;

export class PlayScene extends Phaser.Scene {
  private rng: R.Rng = Math.random;
  private player!: Sprite;
  private boss!: Sprite;
  private fisher!: Phaser.GameObjects.Image;
  private fisherPrompt!: Phaser.GameObjects.Text;
  private bullets!: Phaser.Physics.Arcade.Group;
  private combat!: Combat;
  private pickups!: Phaser.Physics.Arcade.Group;
  private hud!: Phaser.GameObjects.Graphics;
  private tgG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private door!: Phaser.GameObjects.Image;
  private keyIcon!: Phaser.GameObjects.Image;
  private specialIcons: Phaser.GameObjects.Image[] = [];
  private cdG!: Phaser.GameObjects.Graphics;
  private cdTexts: Phaser.GameObjects.Text[] = [];
  private texts!: { hp: Phaser.GameObjects.Text; boss: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text; retailer: Phaser.GameObjects.Text };
  private hand!: ReturnType<typeof handHud>;
  private walletUi!: ReturnType<typeof walletHud>;
  private keys!: Keys;

  private kit!: R.Loadout;
  private fightMs = 0;
  private hp = R.PLAYER_HP;
  private wallet: R.Wallet = R.emptyWallet();
  private rings: R.Rarity[] = [];
  private buffs = { damage: 0, speed: 0 };
  private immuneNoteAt = 0;
  private invulnUntil = 0;
  private shieldUntil = 0;
  private bossHp = R.BOSS_MAX_HP;
  private stage: R.Stage = 1;
  private bossInvulnUntil = 0;
  private nextShotAt = 0;
  private nextDashAt = 0;
  private dashUntil = 0;
  private knockUntil = 0;
  private spiralAngle = 0;
  private telegraph: Telegraph | null = null;
  private bossView!: Phaser.GameObjects.Image;
  private heldBall!: Phaser.GameObjects.Image;
  private finale: { kind: R.FinaleMove; phase: 'charge' | 'rise' | 'hunt' | 'lock' | 'fall'; at: number; dealt: number; x: number; y: number } | null = null;
  private finaleCount = 0;
  private nextFinaleAt = Infinity;
  private giant: { img: Phaser.GameObjects.Image; x0: number; y0: number; ang: number; start: number; flightMs: number; tx: number; ty: number } | null = null;
  private rain: { x: number; y: number; at: number }[] = [];
  private dark!: Phaser.GameObjects.Rectangle;
  private bossHands = 'a';
  private bossFlashing = false;
  private bossKick: BossKick | null = null;
  private bossMotion = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
  private dashAngle = 0;
  private slowUntil = 0;
  private paralyzedUntil = 0;
  private poisonUntil = 0;
  private poisonNextTick = 0;
  private suckUntil = 0;
  private suckNextTick = 0;
  private bossDead = false;
  private ended = false;
  private landed = true;
  private hasKey = false;
  private doorOpen = false;
  private visit = 0;
  private stock: R.SupplyId[] = [];
  private sold = new Set<number>();
  private shop: Phaser.GameObjects.Container | null = null;
  private shopNote = '';
  private shopSel = 0;
  private shopBookShown = -1;
  private shopDeal = false;
  private shopPop = -1;
  private fightTweens: Phaser.Tweens.Tween[] = [];
  private bobber: Phaser.GameObjects.GameObject[] = [];
  private devOpenShop = false;
  private hitStopUntil = 0;
  private inHitStop = false;
  private drinkNote = '';
  private villageLvl = 1;

  constructor() { super('play'); }

  create(data: PlayData = {}) {
    const save = loadSave();
    const startStage = (data.stage === 2 || data.stage === 3 ? data.stage : 1) as R.Stage;
    const drink = save.drink ? R.DRINKS[save.drink] : null;
    if (drink) updateSave((s) => ({ ...s, drink: null }));
    const base = R.loadout(save.inventory);
    this.kit = { ...base, maxHp: base.maxHp + (drink?.hp ?? 0) };
    this.drinkNote = drink ? `${drink.name}: ${drink.desc}` : '';
    this.villageLvl = R.villageLevel(save.spent);
    this.fightMs = Math.max(0, data.startMs ?? 0);
    this.hp = this.kit.maxHp;
    this.wallet = { ...save.wallet };
    this.rings = [];
    this.buffs = { damage: drink?.damage ?? 0, speed: drink?.speed ?? 0 };
    this.immuneNoteAt = 0;
    this.invulnUntil = 0;
    this.shieldUntil = 0;
    this.stage = startStage;
    this.bossHp = R.stageStartHp(startStage);
    this.bossInvulnUntil = 0;
    this.nextShotAt = this.fightMs + 1500;
    this.nextDashAt = this.fightMs + R.STAGES[startStage].dashEveryMs;
    this.dashUntil = 0;
    this.knockUntil = 0;
    this.spiralAngle = 0;
    this.telegraph = null;
    this.bossKick = null;
    this.finale = null;
    this.finaleCount = 0;
    this.nextFinaleAt = startStage === 3 ? this.fightMs + R.FINALE.firstAfterMs : Infinity;
    this.giant = null;
    this.rain = [];
    this.bossHands = 'a';
    this.bossFlashing = false;
    this.bossMotion = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
    this.dashAngle = 0;
    this.slowUntil = this.paralyzedUntil = this.poisonUntil = this.poisonNextTick = this.suckUntil = this.suckNextTick = 0;
    this.bossDead = false;
    this.ended = false;
    this.landed = true;
    this.hasKey = false;
    this.doorOpen = false;
    this.visit = 0;
    this.stock = [];
    this.sold = new Set();
    this.shop = null;
    this.shopNote = '';
    this.shopSel = 0;
    this.shopBookShown = -1;
    this.bobber = [];
    this.devOpenShop = !!data.openShop;
    this.hitStopUntil = 0;
    this.inHitStop = false;

    this.physics.world.setBounds(PLAY.x + WALL, PLAY.y, PLAY.width - WALL, PLAY.height);
    this.drawArena();
    this.door = this.add.image(DOOR.x, DOOR.y, 'door').setDepth(4).setVisible(false);
    this.fisher = this.add.image(FISHER_X, FISHER_Y, 'fisher').setDepth(5).setVisible(false);
    this.fisherPrompt = this.add.text(FISHER_X, FISHER_Y - 16, 'E: shop', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(950).setVisible(false);

    this.player = this.physics.add.sprite(PLAY.x + 70, PLAY.y + PLAY.height / 2, 'player').setCollideWorldBounds(true).setDepth(10);
    dress(this.player, heroLook(this, save.inventory.armor));
    this.boss = this.physics.add.sprite(PLAY.x + PLAY.width - 50, PLAY.y + PLAY.height / 2, `boss_${startStage}`).setCollideWorldBounds(true).setDepth(9);
    const bw = this.boss.width, bh = this.boss.height, r = Math.min(11, Math.floor(Math.min(bw, bh) / 2) - 1);
    (this.boss.body as Body).setCircle(r, bw / 2 - r, bh / 2 - r);
    this.boss.setVisible(false);
    this.bossView = this.add.image(this.boss.x, this.boss.y, `boss_${startStage}`).setDepth(9);
    this.heldBall = this.add.image(0, 0, 'bullet').setDepth(10).setVisible(false);
    this.dark = this.add.rectangle(PLAY.x + PLAY.width / 2, PLAY.y + PLAY.height / 2, PLAY.width, PLAY.height, 0x240008).setDepth(6).setAlpha(0);

    this.bullets = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.physics.add.overlap(this.player, this.bullets, (_p, b) => { asSprite(b).destroy(); this.hurtPlayer(R.BULLET_DMG); });
    this.physics.add.overlap(this.player, this.boss, () => { if (this.hurtPlayer(R.CONTACT_DMG)) this.kickBoss('smash', this.angleToPlayer(), 240); });
    this.physics.add.overlap(this.player, this.pickups, (_p, item) => this.collect(asSprite(item)));

    this.combat = new Combat(this, {
      player: this.player,
      kit: this.kit,
      now: () => this.fightMs,
      area: { x: PLAY.x + WALL, y: PLAY.y, width: PLAY.width - WALL, height: PLAY.height },
      damageMul: () => this.damageMul(),
      target: {
        sprite: this.boss,
        alive: () => !this.bossDead,
        hit: (dmg) => this.damageBoss(dmg),
        effect: (e) => {
          if (e === 'freeze') { this.slowUntil = this.fightMs + R.SPECIAL.freezeSlowMs; this.floatText(this.boss.x, this.boss.y - 22, 'SLOWED', '#9fe8ff'); }
          else { this.poisonUntil = this.fightMs + R.SPECIAL.poisonMs; this.poisonNextTick = this.fightMs + 1000; this.floatText(this.boss.x, this.boss.y - 22, 'POISONED', '#6fd13a'); }
        },
      },
    });
    this.keys = addKeys(this);
    this.input.setDefaultCursor('none');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.setDefaultCursor('default'); hideHandArt(); });

    this.tgG = this.add.graphics().setDepth(7);
    this.fxG = this.add.graphics().setDepth(12);

    this.hud = this.add.graphics().setDepth(940);
    this.texts = {
      hp: this.add.text(PLAY.x + WALL + 66, PLAY.y + 2, '', FONT).setDepth(950),
      boss: this.add.text(WIDTH / 2 - 50, PLAY.y + 10, '', { ...FONT, color: '#dddddd' }).setDepth(950),
      status: this.add.text(WIDTH / 2 - 50, PLAY.y + 18, '', { ...FONT, color: '#b8e0a0' }).setDepth(950),
      retailer: this.add.text(PLAY.x + PLAY.width - 3, PLAY.y + 2, '', { ...FONT, color: '#9fd3ff' }).setOrigin(1, 0).setDepth(950),
    };
    this.keyIcon = this.add.image(PLAY.x + WALL + 112, PLAY.y + 5, 'key').setDepth(950).setVisible(false);
    this.specialIcons = this.kit.specials.map((id, i) => {
      const x = PLAY.x + WALL + 7 + i * 12;
      this.add.text(x, PLAY.y + 21, String(i + 1), { ...FONT, color: '#888888' }).setOrigin(0.5, 0).setDepth(950);
      return this.add.image(x, PLAY.y + 16, `icon_${id}`).setDepth(945);
    });
    this.cdG = this.add.graphics().setDepth(946);
    this.cdTexts = this.specialIcons.map((icon) => this.add.text(icon.x, icon.y - 4, '', { ...FONT, color: '#ffffff' }).setOrigin(0.5, 0).setDepth(947));
    this.hand = handHud(this, PLAY.x + WALL + 3, PLAY.y + PLAY.height - 19);
    if (hasWeapon(this.kit.weapons)) this.hand.show();
    this.walletUi = walletHud(this, PLAY.x + PLAY.width - 128, PLAY.y + PLAY.height - 9);
    this.walletUi.update(this.wallet);
    const luckPct = Math.round((R.ringLuck(this.villageLvl) - 1) * 100);
    if (luckPct) this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + PLAY.height - 19, `village bonus +${luckPct}% rings`, { ...FONT, color: '#c8e8b8' }).setOrigin(1, 0).setDepth(950);

    drawFrame(this);
    playMusic(this, 'arena');
    if (data.bossDead) { this.bossHp = 0; this.killBoss(); }
    if (data.lose) this.time.delayedCall(400, () => { this.hp = 0; this.thrownOut(); });
    if (data.landing) this.land();
    else if (startStage === 1 && !data.bossDead) this.banner('MOSSBACK', 'Stage 1 of 3');
  }

  private land() {
    this.landed = false;
    this.cameras.main.fadeIn(350, 255, 255, 255);
    const { x, y } = this.player;
    this.player.setVisible(false);
    const shadow = this.add.image(x, y + 5, 'shadow').setDepth(9).setScale(0.2);
    this.tweens.add({ targets: shadow, scale: 1.4, duration: 700, ease: 'Quad.easeIn' });
    const faller = this.add.image(x, y - 140, this.player.texture.key).setDepth(12).setScale(2.5);
    this.tweens.add({
      targets: faller, y, scale: 1, duration: 700, ease: 'Quad.easeIn',
      onComplete: () => {
        faller.destroy();
        shadow.destroy();
        this.player.setVisible(true);
        this.cameras.main.shake(260, 0.02);
        sfx(this, 'land');
        dustPuff(this, x, y, 8, 16);
        this.landed = true;
        this.nextShotAt = this.fightMs + 1500;
        const luck = Math.round((R.ringLuck(this.villageLvl) - 1) * 100);
        const notes = [this.drinkNote, luck ? `village bonus +${luck}% rings` : ''].filter(Boolean).join(', ');
        this.banner('MOSSBACK', notes ? `${notes}. Get the key!` : 'Get the key around his neck');
      },
    });
  }

  update(_t: number, delta: number) {
    this.combat.drawAim(this.landed && !this.ended && !this.shop);
    if (this.ended) { this.endHitStop(); this.drawFx(); return; }
    if (this.shop) { this.shopKeys(); return; }
    if (!this.landed) { this.drawHud(); return; }
    if (this.hitStopping()) return;
    this.fightMs += delta;
    this.movePlayer();
    this.actionKeys();
    if (!this.bossDead) { this.updateBoss(); this.animateBoss(delta); this.updateFinaleWorld(); }
    if (!this.bossDead) this.updateEffects();
    this.updateRetailer();
    this.cleanupProjectiles();
    if (this.bossDead) {
      this.pickups.getChildren().forEach((c) => { if ((c as Sprite).getData('kind') !== 'key') this.physics.moveToObject(c, this.player, 150); });
      if (this.hasKey && this.doorOpen && near(this.player, DOOR.x + 6, DOOR.y, 12)) this.enterTreasury();
    }
    this.drawFx();
    this.drawHud();
  }

  private hitStop(ms: number) {
    if (this.shop || this.ended) return;
    this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + ms);
    if (this.inHitStop) return;
    this.inHitStop = true;
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
  }

  private hitStopping(): boolean {
    if (performance.now() < this.hitStopUntil) return true;
    this.endHitStop();
    return false;
  }

  private endHitStop() {
    if (!this.inHitStop) return;
    this.inHitStop = false;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
  }

  private damageMul() { return 1 + this.buffs.damage; }

  private movePlayer() {
    this.combat.face(steer(this.player, this.keys, 1 + this.buffs.speed));
  }

  private actionKeys() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    this.combat.keys(k);
    this.kit.specials.forEach((id, i) => { if (JD(k[SPECIAL_KEYS[i]])) this.cast(id); });
    if (JD(k.E) && this.nearFisher()) this.openShop();
  }

  private cast(id: R.SpecialId) {
    const it = R.item(id);
    if (this.combat.specialLeft(id) > 0) { this.floatText(this.player.x, this.player.y - 12, `${it.name} not ready`, '#888888'); return; }
    const c = this.combat;
    const d = c.aimDir();
    const p = this.player;
    const boss = this.boss;
    const S = R.SPECIAL;
    let used = true;
    sfx(this, 'spell', 0.5);
    switch (id) {
      case 'fireball': c.projectile('proj_fireball', d, SPELL_SPEED, c.hitDamage(it.damage ?? 0)); break;
      case 'freeze': c.projectile('proj_freeze', d, SPELL_SPEED, c.hitDamage(it.damage ?? 0), 'freeze'); break;
      case 'poison': c.projectile('proj_poison', d, SPELL_SPEED - 20, c.hitDamage(it.damage ?? 0), 'poison'); break;
      case 'paralysis':
        if (this.bossDead) { used = false; break; }
        this.paralyzedUntil = this.fightMs + S.paralysisMs;
        this.telegraph = null;
        this.bullets.clear(true, true);
        this.floatText(boss.x, boss.y - 22, 'PARALYSED', '#ffee44');
        break;
      case 'push': {
        c.ring(p.x, p.y, S.pushRadius, 0xffffff);
        if (this.bossDead || !near(p, boss.x, boss.y, S.pushRadius)) { this.floatText(p.x, p.y - 12, 'too far', '#888888'); break; }
        this.damageBoss(c.hitDamage(it.damage ?? 0));
        const ang = Phaser.Math.Angle.Between(p.x, p.y, boss.x, boss.y);
        const ms = 220;
        (boss.body as Body).setVelocity(Math.cos(ang) * S.pushDistance * (1000 / ms), Math.sin(ang) * S.pushDistance * (1000 / ms));
        this.knockUntil = this.fightMs + ms;
        this.telegraph = null;
        break;
      }
      case 'healthSuck':
        if (this.bossDead) { used = false; break; }
        this.suckUntil = this.fightMs + S.suckMs;
        this.suckNextTick = this.fightMs + 500;
        break;
      case 'bomb': c.throwBomb(d, it.damage ?? 0); break;
      case 'shield':
        this.shieldUntil = this.fightMs + S.shieldMs;
        this.floatText(p.x, p.y - 12, 'SHIELD', '#6aa8ff');
        break;
    }
    if (used) c.usedSpecial(id);
  }

  private updateEffects() {
    const S = R.SPECIAL;
    while (this.fightMs < this.poisonUntil && this.fightMs >= this.poisonNextTick) {
      this.poisonNextTick += 1000;
      this.damageBoss(S.poisonTickDmg, { hitStop: false, drops: false, color: '#6fd13a' });
    }
    while (this.fightMs < this.suckUntil && this.fightMs >= this.suckNextTick && !this.bossDead) {
      this.suckNextTick += 500;
      this.damageBoss(S.suckPerSec / 2, { hitStop: false, drops: false, color: '#e03a4a' });
      this.hp = Math.min(this.kit.maxHp, this.hp + S.suckPerSec / 2);
    }
  }

  private hurtPlayer(raw: number): boolean {
    if (this.ended || this.bossDead || this.fightMs < this.invulnUntil) return false;
    const shielded = this.fightMs < this.shieldUntil;
    const dmg = R.damageTaken(raw, this.kit.armor, shielded);
    if (shielded) {
      this.invulnUntil = this.fightMs + 300;
      this.floatText(this.player.x, this.player.y - 12, 'BLOCKED', '#6aa8ff');
      sfx(this, 'block');
      return true;
    }
    this.hp = Math.max(0, this.hp - dmg);
    sfx(this, 'hurt');
    this.invulnUntil = this.fightMs + R.INVULN_MS;
    this.cameras.main.shake(100, 0.008);
    this.floatText(this.player.x, this.player.y - 12, `-${dmg}`, '#ff6a6a');
    this.tweens.add({ targets: this.player, alpha: 0.2, yoyo: true, repeat: 4, duration: 90, onComplete: () => this.player.setAlpha(1) });
    if (this.hp <= 0) this.thrownOut();
    return true;
  }

  private applyBossTexture() { this.bossView.setTexture(this.bossTexture()); }

  private bossTexture() {
    const k = `boss_${this.stage}_${this.bossHands}`;
    return this.textures.exists(k) ? k : `boss_${this.stage}`;
  }

  private animateHands(near: boolean) {
    const now = this.fightMs;
    const t = this.telegraph;
    const kick = this.bossKick?.kind;
    const moving = (this.boss.body as Body).velocity.length() > 4;
    const hands = t?.kind === 'ring' || this.finale?.kind === 'giantBall' || kick === 'smash' || kick === 'throw' || kick === 'slam' || kick === 'flick' ? 'spread'
      : t?.kind === 'aimed' || t?.kind === 'dash' || now < this.dashUntil || near ? 'grab'
      : ['a', 'b', 'a', 'c'][Math.floor(now / (moving ? 150 : 280)) % 4];
    if (hands === this.bossHands) return;
    this.bossHands = hands;
    if (!this.bossFlashing && !this.bossDead) this.applyBossTexture();
  }

  private angleToPlayer() { return Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y); }

  private kickBoss(kind: BossKick['kind'], angle: number, ms: number) { this.bossKick = { kind, angle, at: this.fightMs, ms }; }

  private static readonly FIST = { left: { x: -14, y: -8 }, right: { x: 13, y: -8 } };
  private static readonly OVERHEAD = { x: 0, y: -17 };

  private onBoss(local: { x: number; y: number }) {
    const v = this.bossView;
    const c = Math.cos(v.rotation), sn = Math.sin(v.rotation);
    const lx = local.x * v.scaleX, ly = local.y * v.scaleY;
    return { x: v.x + lx * c - ly * sn, y: v.y + lx * sn + ly * c };
  }

  private throwHand(angle: number) {
    return this.onBoss(Math.cos(angle) < 0 ? PlayScene.FIST.left : PlayScene.FIST.right);
  }

  private animateBoss(delta: number) {
    const now = this.fightMs;
    if (this.finale?.kind === 'slamRain') { this.heldBall.setVisible(false); return; }
    const t = this.telegraph;
    const body = this.boss.body as Body;
    const side = (angle: number) => (Math.cos(angle) < 0 ? -1 : 1);
    const goal = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
    const near = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, this.player.x, this.player.y) < MELEE_REACH;
    const wound = t ? Phaser.Math.Clamp((now - t.from) / Math.max(1, t.fireAt - t.from), 0, 1) : 0;
    let ball: { at: { x: number; y: number }; scale: number } | null = null;
    const fin = this.finale;
    if (fin?.kind === 'giantBall') {
      const w = Phaser.Math.Clamp((now - fin.at) / R.FINALE.ball.chargeMs, 0, 1);
      Object.assign(goal, { sx: 1 - 0.05 * w, sy: 1 + 0.15 * w, dy: -4 * w, rot: 0.05 * w * Math.sin(now / 25) });
      const scale = 1 + 4 * w;
      ball = { at: { x: PlayScene.OVERHEAD.x, y: PlayScene.OVERHEAD.y - 2 * scale }, scale };
    } else if (t?.kind === 'ring') {
      Object.assign(goal, { sx: 1 - 0.04 * wound, sy: 1 + 0.12 * wound, dy: -3 * wound });
      const scale = 1 + 1.2 * wound;
      ball = { at: { x: PlayScene.OVERHEAD.x, y: PlayScene.OVERHEAD.y - 2 * scale }, scale };
    } else if (t?.kind === 'aimed') {
      const s = side(t.angle);
      Object.assign(goal, { rot: -0.22 * s * wound, dx: -3 * s * wound, dy: -1, sy: 1.04 });
      ball = { at: s < 0 ? PlayScene.FIST.left : PlayScene.FIST.right, scale: 1 + 0.5 * wound };
    } else if (t?.kind === 'dash') {
      Object.assign(goal, { rot: -0.12 * side(t.angle), sx: 1.12, sy: 0.88, dy: 2 });
    } else if (now < this.dashUntil) {
      Object.assign(goal, { rot: 0.28 * side(this.dashAngle), sx: 0.92, sy: 1.08 });
    } else if (near) {
      const s = side(this.angleToPlayer());
      Object.assign(goal, { rot: -0.2 * s, dx: -2 * s, dy: -2, sx: 1.06, sy: 1.1 });
    } else if (body.velocity.length() > 4) {
      const phase = now * (0.009 + 0.003 * this.stage);
      Object.assign(goal, { rot: 0.1 * Math.sin(phase), dy: -2 * Math.abs(Math.sin(phase)) });
    } else {
      goal.dy = -Math.round((Math.sin(now / 420) + 1) / 2);
    }
    const m = this.bossMotion;
    const ease = Math.min(1, delta / 70);
    for (const k of ['dx', 'dy', 'rot', 'sx', 'sy'] as const) m[k] += (goal[k] - m[k]) * ease;

    let { dx, dy, rot, sx, sy } = m;
    const kick = this.bossKick;
    if (kick) {
      const p = (now - kick.at) / kick.ms;
      if (p >= 1) this.bossKick = null;
      else {
        const arc = Math.sin(p * Math.PI);
        const cx = Math.cos(kick.angle), cy = Math.sin(kick.angle);
        if (kick.kind === 'smash') {
          dx += cx * 8 * arc; dy += cy * 8 * arc; rot = 0.3 * side(kick.angle) * arc; sx += 0.2 * arc; sy -= 0.18 * arc;
        } else if (kick.kind === 'throw') {
          dx += cx * 6 * arc; dy += cy * 3 * arc; rot = 0.3 * side(kick.angle) * arc; sx += 0.08 * arc;
        } else if (kick.kind === 'slam') {
          sx += 0.22 * arc; sy -= 0.2 * arc; dy += 3 * arc;
        } else {
          rot += 0.16 * side(kick.angle) * arc; dx += cx * 3 * arc;
        }
      }
    }
    this.bossView.setPosition(Math.round(this.boss.x + dx), Math.round(this.boss.y + dy)).setRotation(rot).setScale(sx, sy);
    this.heldBall.setVisible(!!ball);
    if (ball) { const at = this.onBoss(ball.at); this.heldBall.setPosition(Math.round(at.x), Math.round(at.y)).setScale(ball.scale); }
    this.animateHands(near);
  }

  private startFinale() {
    const now = this.fightMs;
    const kind = R.finaleMove(this.finaleCount++);
    this.nextFinaleAt = now + R.FINALE.everyMs;
    const body = this.boss.body as Body;
    body.setVelocity(0, 0);
    this.finale = { kind, phase: kind === 'giantBall' ? 'charge' : 'rise', at: now, dealt: 0, x: this.boss.x, y: this.boss.y };
    if (kind === 'giantBall') {
      this.tweens.add({ targets: this.dark, alpha: 0.6, duration: 300 });
      this.floatText(this.boss.x, this.boss.y - 34, 'STOP HIM!', '#ffcc44');
      sfx(this, 'stage', 0.6);
    } else {
      body.enable = false;
      this.tweens.add({ targets: this.bossView, y: this.bossView.y - 150, scaleX: 1.3, scaleY: 1.3, rotation: 0, duration: R.FINALE.slam.riseMs, ease: 'Quad.easeIn' });
      this.floatText(this.boss.x, this.boss.y - 24, 'LOOK OUT!', '#ff6a6a');
      sfx(this, 'launch', 0.7);
    }
  }

  private runFinale(body: Body) {
    const f = this.finale!;
    const now = this.fightMs;
    if (f.kind === 'giantBall') {
      body.setVelocity(0, 0);
      if (R.staggers(f.dealt) || now < this.paralyzedUntil || now < this.knockUntil) this.staggerBoss();
      else if (now >= f.at + R.FINALE.ball.chargeMs) this.throwGiant();
      return;
    }
    const S = R.FINALE.slam;
    if (f.phase === 'rise' && now >= f.at + S.riseMs) Object.assign(f, { phase: 'hunt', at: now });
    else if (f.phase === 'hunt') {
      f.x += (this.player.x - f.x) * 0.1;
      f.y += (this.player.y - f.y) * 0.1;
      if (now >= f.at + S.huntMs) Object.assign(f, { phase: 'lock', at: now });
    } else if (f.phase === 'lock' && now >= f.at + S.lockMs) {
      Object.assign(f, { phase: 'fall', at: now });
      body.reset(f.x, f.y);
      this.tweens.killTweensOf(this.bossView);
      this.bossView.setPosition(f.x, f.y - 150);
      this.tweens.add({ targets: this.bossView, y: f.y, scaleX: 1, scaleY: 1, duration: S.fallMs, ease: 'Quad.easeIn' });
    } else if (f.phase === 'fall' && now >= f.at + S.fallMs) this.slamDown();
  }

  private slamDown() {
    const f = this.finale!;
    const S = R.FINALE.slam;
    const now = this.fightMs;
    this.finale = null;
    (this.boss.body as Body).enable = true;
    this.bossView.setPosition(f.x, f.y).setScale(1);
    this.cameras.main.shake(260, 0.02);
    sfx(this, 'land');
    dustPuff(this, f.x, f.y + 12, 10, 20);
    this.shockwave(f.x, f.y, S.radius, 0xff6a3a);
    if (Phaser.Math.Distance.Between(f.x, f.y, this.player.x, this.player.y) < S.radius) this.hurtPlayer(S.dmg);
    const area = { x: PLAY.x + WALL, y: PLAY.y, width: PLAY.width - WALL, height: PLAY.height };
    R.rainSpots(this.rng, area, Math.floor(S.rainMs / S.rainEveryMs), S.dropGap)
      .forEach((p, i) => this.rain.push({ x: p.x, y: p.y, at: now + S.rainWarnMs + i * S.rainEveryMs }));
    this.nextShotAt = now + 1200;
    this.nextDashAt = now + 2500;
  }

  private staggerBoss() {
    const F = R.FINALE.ball;
    this.finale = null;
    this.heldBall.setVisible(false);
    this.tweens.add({ targets: this.dark, alpha: 0, duration: 300 });
    this.paralyzedUntil = Math.max(this.paralyzedUntil, this.fightMs + F.stunMs);
    this.shockwave(this.boss.x, this.boss.y - 12, 22, 0xff4f7a);
    this.cameras.main.shake(220, 0.015);
    this.floatText(this.boss.x, this.boss.y - 34, 'STAGGERED!', '#ffee44');
    this.kickBoss('slam', 0, 320);
    this.damageBoss(F.staggerHit, { color: '#ffee44' });
  }

  private giantPath() {
    const F = R.FINALE.ball;
    const from = this.onBoss(PlayScene.OVERHEAD);
    const ang = Phaser.Math.Angle.Between(from.x, from.y, this.player.x, this.player.y);
    const dist = Math.min(Phaser.Math.Distance.Between(from.x, from.y, this.player.x, this.player.y), (F.speed * F.maxFlightMs) / 1000);
    return { from, ang, tx: from.x + Math.cos(ang) * dist, ty: from.y + Math.sin(ang) * dist, flightMs: (dist / F.speed) * 1000 };
  }

  private throwGiant() {
    this.finale = null;
    this.heldBall.setVisible(false);
    this.tweens.add({ targets: this.dark, alpha: 0, duration: 400 });
    const { from, ang, tx, ty, flightMs } = this.giantPath();
    this.giant = { img: this.add.image(from.x, from.y, 'bullet').setScale(5).setDepth(11), x0: from.x, y0: from.y, ang, start: this.fightMs, flightMs, tx, ty };
    this.kickBoss('throw', ang, 260);
    sfx(this, 'spell', 0.7);
  }

  private burstGiant(x: number, y: number) {
    const F = R.FINALE.ball;
    this.giant?.img.destroy();
    this.giant = null;
    for (let i = 0; i < F.burst; i++) {
      const a = (i / F.burst) * Math.PI * 2;
      this.bullet(x + Math.cos(a) * 9, y + Math.sin(a) * 9, a, F.burstSpeed);
    }
    this.shockwave(x, y, 14, 0xff4f7a);
    this.cameras.main.shake(150, 0.01);
    sfx(this, 'hit');
  }

  private updateFinaleWorld() {
    const now = this.fightMs;
    const g = this.giant;
    if (g) {
      const t = now - g.start;
      const x = g.x0 + (Math.cos(g.ang) * R.FINALE.ball.speed * t) / 1000;
      const y = g.y0 + (Math.sin(g.ang) * R.FINALE.ball.speed * t) / 1000;
      g.img.setPosition(Math.round(x), Math.round(y));
      const hit = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 12;
      if (hit) this.hurtPlayer(R.FINALE.ball.hitDmg);
      if (hit || t >= g.flightMs) this.burstGiant(x, y);
    }
    const S = R.FINALE.slam;
    this.rain = this.rain.filter((d) => {
      if (now < d.at) return true;
      this.shockwave(d.x, d.y, S.dropRadius + 2, 0xff4f7a);
      if (Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y) < S.dropRadius + 3) this.hurtPlayer(R.BULLET_DMG);
      return false;
    });
  }

  private endFinale() {
    if (this.finale?.kind === 'slamRain') {
      this.tweens.killTweensOf(this.bossView);
      this.bossView.setPosition(this.boss.x, this.boss.y).setScale(1);
    }
    this.finale = null;
    this.giant?.img.destroy();
    this.giant = null;
    this.rain = [];
    this.dark.setAlpha(0);
  }

  private shockwave(x: number, y: number, radius: number, color: number) {
    const c = this.add.circle(x, y, 4).setStrokeStyle(2, color, 0.9).setDepth(12);
    this.tweens.add({ targets: c, scale: radius / 4, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
  }

  private updateBoss() {
    const now = this.fightMs;
    const st = R.STAGES[this.stage];
    const body = this.boss.body as Body;
    if (this.finale) { this.runFinale(body); return; }
    if (now < this.knockUntil) return;
    if (now < this.paralyzedUntil) { body.setVelocity(0, 0); return; }
    const slow = now < this.slowUntil ? R.SPECIAL.freezeFactor : 1;

    if (this.telegraph) {
      body.setVelocity(0, 0);
      if (now < this.telegraph.fireAt) return;
      const t = this.telegraph;
      this.telegraph = null;
      if (t.kind === 'aimed') {
        const hand = this.throwHand(t.angle);
        for (const off of [-0.25, 0, 0.25]) this.bullet(hand.x, hand.y, t.angle + off, st.ballSpeed);
        this.kickBoss('throw', t.angle, 220);
      } else if (t.kind === 'ring') {
        for (let i = 0; i < RING_BALLS; i++) this.bullet(this.boss.x, this.boss.y, (i / RING_BALLS) * Math.PI * 2, st.ballSpeed);
        this.kickBoss('slam', 0, 240);
        this.cameras.main.shake(80, 0.006);
      }
      else { body.setVelocity(Math.cos(t.angle) * DASH_SPEED, Math.sin(t.angle) * DASH_SPEED); this.dashUntil = now + DASH_MS; this.dashAngle = t.angle; }
      return;
    }
    if (now < this.dashUntil) return;
    if (this.stage === 3 && now >= this.nextFinaleAt && now >= this.bossInvulnUntil) { this.startFinale(); return; }

    if (st.dashEveryMs > 0 && now >= this.nextDashAt) {
      this.nextDashAt = now + st.dashEveryMs;
      this.telegraph = { kind: 'dash', angle: Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y), fireAt: now + R.TELEGRAPH_MS, from: now };
      return;
    }
    this.physics.moveToObject(this.boss, this.player, st.speed * slow);
    if (now >= this.nextShotAt && now >= this.bossInvulnUntil) {
      this.nextShotAt = now + st.shotEveryMs / slow;
      const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
      if (st.pattern === 'aimed') this.telegraph = { kind: 'aimed', angle, fireAt: now + R.TELEGRAPH_MS, from: now };
      else if (st.pattern === 'ring') this.telegraph = { kind: 'ring', angle, fireAt: now + 350, from: now };
      else {
        for (let i = 0; i < SPIRAL_ARMS; i++) this.bullet(this.boss.x, this.boss.y, this.spiralAngle + (i * Math.PI * 2) / SPIRAL_ARMS, st.ballSpeed);
        this.kickBoss('flick', this.spiralAngle, 140);
        this.spiralAngle += SPIRAL_TURN;
      }
    }
  }

  private bullet(x: number, y: number, angle: number, speed: number) {
    const b = asSprite(this.bullets.create(x, y, 'bullet'));
    b.setDepth(8);
    (b.body as Body).setCircle(2).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  private damageBoss(dmg: number, opts: { hitStop?: boolean; drops?: boolean; color?: string } = {}) {
    if (this.bossDead) return;
    if (this.fightMs < this.bossInvulnUntil || this.finale?.kind === 'slamRain') {
      if (this.fightMs >= this.immuneNoteAt) { this.floatText(this.boss.x, this.boss.y - 14, 'immune', '#888888'); this.immuneNoteAt = this.fightMs + 300; }
      return;
    }
    const { hitStop = true, drops = true, color = '#ffffff' } = opts;
    if (this.finale?.kind === 'giantBall') this.finale.dealt += dmg;
    this.bossHp = Math.max(0, this.bossHp - dmg);
    this.floatText(this.boss.x, this.boss.y - 14, `-${dmg}`, color);
    if (hitStop) {
      sfx(this, 'hit');
      this.bossView.setTexture('boss_flash');
      this.bossFlashing = true;
      this.time.delayedCall(60, () => { this.bossFlashing = false; if (this.boss.active && !this.bossDead) this.applyBossTexture(); });
      this.hitStop(dmg >= 60 ? 110 : dmg >= 20 ? 70 : 40);
    }
    const loose = drops ? R.hitDrop(this.rng, this.villageLvl) : null;
    if (loose) this.spawnRing(this.boss.x, this.boss.y, loose);
    if (this.bossHp <= 0) { this.killBoss(); return; }
    const next = R.bossStage(this.bossHp);
    for (let s = this.stage + 1; s <= next; s++) this.enterStage(s as R.Stage);
  }

  private enterStage(next: R.Stage) {
    this.stage = next;
    this.applyBossTexture();
    this.telegraph = null;
    this.bossInvulnUntil = this.fightMs + 1200;
    this.nextShotAt = this.fightMs + 1500;
    this.nextDashAt = this.fightMs + R.STAGES[next].dashEveryMs;
    if (next === 3) this.nextFinaleAt = this.fightMs + R.FINALE.firstAfterMs;
    this.bullets.clear(true, true);
    this.drop(R.stageDrop(this.rng, this.villageLvl));
    this.cameras.main.shake(200, 0.015);
    this.tweens.add({ targets: this.bossView, alpha: 0.3, yoyo: true, repeat: 5, duration: 100, onComplete: () => this.bossView.setAlpha(1) });
    sfx(this, 'stage');
    this.banner(`STAGE ${next}`, R.STAGES[next].name);
  }

  private killBoss() {
    this.bossDead = true;
    this.telegraph = null;
    this.endFinale();
    this.heldBall.setVisible(false);
    this.bullets.clear(true, true);
    this.drop(R.deathDrop(this.rng, this.villageLvl));
    (this.boss.body as Body).setVelocity(0, 0).enable = false;
    this.cameras.main.shake(300, 0.02);
    this.bossView.setRotation(0).setTexture('boss_nokey');
    this.tweens.add({ targets: this.bossView, alpha: 0, scale: 1.6, duration: 900 });
    const key = asSprite(this.pickups.create(this.boss.x, this.boss.y + 8, 'key'));
    key.setData('kind', 'key').setDepth(7).setCollideWorldBounds(true);
    this.tweens.add({ targets: key, y: key.y - 3, yoyo: true, repeat: -1, duration: 350 });
    sfx(this, 'victory');
    this.banner('MOSSBACK FALLS', 'The key fell from his neck. Take it!');
  }

  private drop(d: R.Drop) {
    for (const r of d.rings) this.spawnRing(this.boss.x, this.boss.y, r);
  }

  private spawnRing(x: number, y: number, rarity: R.Rarity) {
    const r = asSprite(this.pickups.create(x, y, `ring_${rarity}`));
    r.setData('kind', 'ring').setData('rarity', rarity).setDepth(7).setCollideWorldBounds(true);
    const a = this.rng() * Math.PI * 2;
    const s = 40 + this.rng() * 40;
    (r.body as Body).setVelocity(Math.cos(a) * s, Math.sin(a) * s).setDrag(90, 90);
    this.tweens.add({ targets: r, scale: 1.3, yoyo: true, repeat: -1, duration: 400 });
  }

  private collect(item: Sprite) {
    if (!item.active) return;
    if (item.getData('kind') === 'key') this.takeKey();
    else this.addRing(item.getData('rarity') as R.Rarity);
    item.destroy();
  }

  private addRing(rarity: R.Rarity) {
    sfx(this, 'ring', 0.4);
    this.rings.push(rarity);
    this.wallet = R.addRings(this.wallet, [rarity]);
    this.walletUi.update(this.wallet);
    const info = R.RINGS[rarity];
    this.floatText(this.player.x, this.player.y - 12, info.name, `#${info.color.toString(16).padStart(6, '0')}`);
  }

  private takeKey() {
    this.hasKey = true;
    this.keyIcon.setVisible(true);
    this.time.delayedCall(700, () => this.revealDoor());
  }

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
    sfx(this, 'door');
    this.banner('A HIDDEN DOOR!', 'West wall. The treasury is behind it.');
  }

  private enterTreasury() {
    if (this.ended) return;
    this.ended = true;
    (this.player.body as Body).setVelocity(0, 0);
    for (const c of this.pickups.getChildren() as Sprite[]) if (c.getData('kind') === 'ring') this.addRing(c.getData('rarity') as R.Rarity);
    fadeToScene(this, 'treasury', { found: [...this.rings], wallet: this.wallet, timeMs: Math.round(this.fightMs) }, 500);
  }

  private nearFisher(): boolean {
    return this.visit > 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, FISHER_X, FISHER_Y) < 24;
  }

  private updateRetailer() {
    const v = this.bossDead ? 0 : R.retailerVisit(this.fightMs);
    if (v !== this.visit) {
      this.visit = v;
      if (v > 0) {
        this.stock = R.rollStock(this.rng);
        this.sold = new Set();
        this.fisher.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: [this.fisher, ...this.bobber], alpha: 1, duration: 300 });
        this.banner('THE FISHERMAN IS HERE', 'Go to the pond, press E');
      } else {
        this.tweens.add({ targets: [this.fisher, ...this.bobber], alpha: 0, duration: 300, onComplete: () => this.fisher.setVisible(false) });
      }
    }
    this.fisherPrompt.setVisible(this.nearFisher());
    if (this.devOpenShop && this.visit > 0) { this.devOpenShop = false; this.openShop(); }
  }

  private openShop() {
    this.physics.pause();
    // Pause the fight's tweens one by one: tweens.pauseAll() also freezes the shop's tweens and the book never opens.
    this.fightTweens = this.tweens.getTweens();
    for (const t of this.fightTweens) t.pause();
    this.time.paused = true;
    this.shopNote = '';
    this.shopSel = 0;
    this.shopBookShown = -1;
    this.shopDeal = true;
    this.input.setDefaultCursor('default');
    clearBanner(this);
    this.renderShop();
  }

  private closeShop() {
    this.shop?.destroy();
    this.shop = null;
    this.input.setDefaultCursor('none');
    this.physics.resume();
    for (const t of this.tweens.getTweens()) if (!this.fightTweens.includes(t)) t.remove();
    for (const t of this.fightTweens) t.resume();
    this.fightTweens = [];
    this.time.paused = false;
  }

  private shopKeys() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    (['ONE', 'TWO', 'THREE'] as const).forEach((name, i) => { if (JD(k[name])) this.buy(i); });
    const n = this.stock.length;
    if (n && (JD(k.A) || JD(k.LEFT))) { this.shopSel = (this.shopSel + n - 1) % n; this.renderShop(); }
    if (n && (JD(k.D) || JD(k.RIGHT))) { this.shopSel = (this.shopSel + 1) % n; this.renderShop(); }
    if (JD(k.ENTER) || JD(k.SPACE)) this.buy(this.shopSel);
    if (JD(k.E) || JD(k.ESC)) this.closeShop();
  }

  private buy(i: number) {
    if (i >= this.stock.length) return;
    if (this.sold.has(i)) { this.shopNote = 'Already sold.'; this.renderShop(); return; }
    const id = this.stock[i];
    const s = R.SUPPLIES[id];
    const paid = R.pay(this.wallet, s.price);
    if (!paid) { this.shopNote = `Not enough rings (${s.price}).`; this.renderShop(); return; }
    this.wallet = paid;
    this.walletUi.update(this.wallet);
    this.sold.add(i);
    this.shopSel = i;
    this.shopPop = i;
    this.shopNote = `Bought: ${s.name}.`;
    sfx(this, 'buy');
    if (id === 'potion') this.hp = Math.min(this.kit.maxHp, this.hp + 30);
    else if (id === 'bigPotion') this.hp = this.kit.maxHp;
    else if (id === 'whetstone') this.buffs.damage += 0.2;
    else if (id === 'boots') this.buffs.speed += 0.15;
    this.renderShop();
  }

  private renderShop() {
    this.shop?.destroy();
    const w = 240;
    const h = 150;
    const x = (WIDTH - w) / 2;
    const y = PLAY.y + (PLAY.height - h) / 2;
    const c = this.add.container(0, 0).setDepth(960);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    for (let i = 0, py = y + 22; py < y + h - 14; i++, py += 8) {
      bg.fillStyle(i % 2 ? 0x6b4a2b : 0x7a5530).fillRect(x, py, w, 8);
      bg.fillStyle(0x4a3018).fillRect(x, py + 7, w, 1);
      for (let nx = x + 10 + (i % 2) * 30; nx < x + w; nx += 60) bg.fillStyle(0x3a2a1a).fillRect(nx, py + 3, 1, 1);
    }
    const net = { x: x + 10, y: y + 90, w: w - 20, h: 42 };
    bg.fillStyle(0x000000, NET_SHADE).fillRect(net.x, net.y, net.w, net.h);
    bg.lineStyle(1, 0xd8c8a0, 0.4);
    for (let k = -net.h; k < net.w; k += 8) {
      const x1 = net.x + Math.max(0, k);
      const x2 = net.x + Math.min(net.w, k + net.h);
      bg.lineBetween(x1, net.y + (x1 - net.x - k), x2, net.y + (x2 - net.x - k));
      bg.lineBetween(x1, net.y + net.h - (x1 - net.x - k), x2, net.y + net.h - (x2 - net.x - k));
    }
    bg.lineStyle(1, 0xc8a86a, 0.9).strokeRect(net.x, net.y, net.w, net.h);
    bg.fillStyle(0x10202a).fillRect(x, y, w, 22).fillRect(x, y + h - 14, w, 14);
    bg.fillStyle(0x2d6fa3).fillRect(x, y, w, 1).fillRect(x, y + h - 1, w, 1).fillRect(x, y, 1, h).fillRect(x + w - 1, y, 1, h);
    c.add(bg);
    c.add(this.add.image(x + 11, y + 11, 'fisher'));
    c.add(this.add.text(x + 22, y + 4, "THE FISHERMAN'S CATCH", { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 22, y + 13, this.shopNote || '"Fresh from the pond. Rings only."', { ...FONT, color: this.shopNote ? '#ffcc44' : '#9fd3ff' }));
    const money = R.walletValue(this.wallet);
    c.add(this.add.text(x + w - 6, y + 4, `${money} rings`, { ...FONT, color: '#ffcc44' }).setOrigin(1, 0));
    const n = this.stock.length;
    const slot = 70;
    const spots = this.stock.map((_, i) => ({ x: Math.round(x + w / 2 + (i - (n - 1) / 2) * slot), y: y + 102 + (i % 2 ? 3 : -3) }));
    this.stock.forEach((id, i) => {
      const sup = R.SUPPLIES[id];
      const sold = this.sold.has(i);
      const picked = i === this.shopSel;
      const { x: ix, y: iy } = spots[i];
      const ware = this.add.container(ix, iy);
      const probe = crisp(this.add.image(0, 0, `supply_${id}`), 28);
      const zoom = probe.scaleX;
      probe.destroy();
      const ic = this.add.image(0, 0, wareArt(this, `supply_${id}`)).setScale(zoom);
      ware.add(clothPatch(this, PLANK, (ic.displayWidth >> 1) + 3, (ic.displayHeight >> 1) + 2, NET_SHADE));
      ware.add(this.add.graphics().fillStyle(0x000000, 0.3).fillEllipse(0, ic.displayHeight / 2 - 1, ic.displayWidth * 0.8, 4));
      if (sold) ic.setAlpha(0.35);
      ware.add(ic);
      if (picked && !this.shopDeal) {
        ic.y = -3;
        this.tweens.add({ targets: ic, y: -5, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.easeInOut' });
        ware.add(this.add.image(10, -12, 'sparkle'));
      }
      ware.add(priceTag(this, 21, { price: sup.price, canPay: money >= sup.price, sold, picked, tilt: i % 2 ? 0.06 : -0.06 }));
      ware.add(this.add.text(-24, 16, `${i + 1}`, { ...FONT, color: '#ffcc44' }));
      c.add(ware);
      c.add(this.shopClick(this.add.zone(ix, iy + 6, 48, 48), () => this.buy(i), () => this.shopPick(i)));
      if (this.shopDeal) {
        ware.setY(iy - 36).setAlpha(0);
        this.tweens.add({ targets: ware, y: iy, alpha: 1, duration: 420, delay: i * 110, ease: 'Bounce.easeOut' });
      }
      if (i === this.shopPop) {
        this.tweens.add({ targets: ware, scale: 1.18, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
        for (let k = 0; k < 6; k++) {
          const sp = this.add.image(ix + Phaser.Math.Between(-14, 14), iy + Phaser.Math.Between(-14, 14), 'sparkle');
          c.add(sp);
          this.tweens.add({ targets: sp, y: sp.y - 10, alpha: 0, duration: 600, delay: k * 60 });
        }
      }
    });
    const pick = this.stock[this.shopSel];
    if (pick) {
      const sup = R.SUPPLIES[pick];
      const lasting = pick === 'whetstone' || pick === 'boots';
      const spine = Phaser.Math.Clamp(spots[this.shopSel].x, x + BOOK_PAGE + 8, x + w - BOOK_PAGE - 8);
      c.add(shopBook(this, spine, y + 24 + BOOK_H / 2, {
        name: sup.name, kind: lasting ? 'GEAR' : 'POTION', kindColor: lasting ? '#2d6fa3' : '#b02020', pic: `supply_${pick}`,
        stats: `${sup.desc}\n\n${lasting ? 'for the rest of this fight' : 'drink it at once'}`,
      }, this.shopBookShown !== this.shopSel || this.shopDeal, this.shopDeal ? n * 110 + 300 : 0));
      this.shopBookShown = this.shopSel;
    }
    this.shopDeal = false;
    this.shopPop = -1;
    const back = this.add.text(x + 6, y + h - 11, 'Click or 1-3: buy   E: back', { ...FONT, color: '#888888' });
    c.add(this.shopClick(back, () => this.closeShop()));
    this.shop = c;
  }

  private shopPick(i: number) {
    if (this.shopSel === i) return;
    this.shopSel = i;
    this.renderShop();
  }

  private shopClick<T extends Phaser.GameObjects.GameObject>(obj: T, click: () => void, hover?: () => void): T {
    const later = (fn: () => void) => this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => { if (this.shop) fn(); });
    obj.setInteractive({ useHandCursor: true });
    obj.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.leftButtonDown()) later(click); });
    if (hover) obj.on('pointerover', () => later(hover));
    return obj;
  }

  private drawFx() {
    const t = this.tgG.clear();
    const f = this.fxG.clear();
    const b = this.boss;
    const p = this.player;
    const now = this.fightMs;
    const pulse = 0.35 + 0.35 * Math.sin(now / 40);
    const ray = (x: number, y: number, angle: number, from: number, to: number, alpha: number, width = 1) =>
      t.lineStyle(width, 0xff3a3a, alpha).lineBetween(x + Math.cos(angle) * from, y + Math.sin(angle) * from, x + Math.cos(angle) * to, y + Math.sin(angle) * to);
    if (this.telegraph && !this.bossDead) {
      const tg = this.telegraph;
      const wound = Phaser.Math.Clamp((now - tg.from) / Math.max(1, tg.fireAt - tg.from), 0, 1);
      if (tg.kind === 'ring') {
        const r = 14 + 8 * wound;
        t.lineStyle(1, 0xff3a3a, 0.4 + pulse).strokeCircle(b.x, b.y, r);
        for (let i = 0; i < RING_BALLS; i++) ray(b.x, b.y, (i / RING_BALLS) * Math.PI * 2, r, r + 10 + 30 * wound, 0.3 + pulse);
      } else if (tg.kind === 'aimed') {
        const o = this.throwHand(tg.angle);
        for (const off of [-0.25, 0, 0.25]) ray(o.x, o.y, tg.angle + off, 0, 150, pulse);
      } else {
        const dist = (DASH_SPEED * DASH_MS) / 1000;
        const r = (this.boss.body as Body).radius;
        ray(b.x, b.y, tg.angle, 0, dist, pulse, 3);
        t.lineStyle(1, 0xff3a3a, pulse).strokeCircle(b.x + Math.cos(tg.angle) * dist, b.y + Math.sin(tg.angle) * dist, r);
      }
    } else if (!this.bossDead && !this.finale && R.STAGES[this.stage].pattern === 'spiral'
      && now >= this.bossInvulnUntil && now >= this.paralyzedUntil && now >= this.knockUntil && now >= this.dashUntil) {
      const left = this.nextShotAt - now;
      if (left <= SPIRAL_WARN_MS) {
        const k = 1 - Math.max(0, left) / SPIRAL_WARN_MS;
        for (let i = 0; i < SPIRAL_ARMS; i++) ray(b.x, b.y, this.spiralAngle + (i * Math.PI * 2) / SPIRAL_ARMS, 14, 14 + 26 * k, 0.15 + 0.6 * k);
      }
    }
    const fin = this.finale;
    const burstMark = (x: number, y: number) => {
      t.lineStyle(1, 0xff3a3a, 0.4 + pulse).strokeCircle(x, y, 9);
      for (let i = 0; i < R.FINALE.ball.burst; i++) ray(x, y, (i / R.FINALE.ball.burst) * Math.PI * 2, 10, 20, 0.25 + pulse);
    };
    if (fin?.kind === 'giantBall' && !this.bossDead) {
      const g = this.giantPath();
      t.lineStyle(2, 0xff3a3a, pulse).lineBetween(g.from.x, g.from.y, g.tx, g.ty);
      burstMark(g.tx, g.ty);
      const k = Math.min(1, fin.dealt / R.FINALE.ball.staggerDmg);
      const left = Math.max(0, 1 - (now - fin.at) / R.FINALE.ball.chargeMs);
      f.fillStyle(0x000000, 0.75).fillRect(b.x - 17, b.y + 20, 34, 6);
      f.fillStyle(0xffcc44).fillRect(b.x - 16, b.y + 21, Math.round(32 * k), 3);
      f.fillStyle(0xff3a3a).fillRect(b.x - 16, b.y + 24, Math.round(32 * left), 1);
    }
    if (this.giant) burstMark(this.giant.tx, this.giant.ty);
    if (fin?.kind === 'slamRain') {
      const S = R.FINALE.slam;
      f.fillStyle(0x000000, 0.4).fillEllipse(fin.x, fin.y + 10, 26, 9);
      const k = fin.phase === 'lock' ? (now - fin.at) / S.lockMs : fin.phase === 'fall' ? 1 : 0;
      t.lineStyle(1, 0xff3a3a, fin.phase === 'hunt' || fin.phase === 'rise' ? 0.3 : 0.5 + pulse).strokeCircle(fin.x, fin.y, S.radius);
      if (k > 0) t.fillStyle(0xff3a3a, 0.25 * k).fillCircle(fin.x, fin.y, S.radius);
    }
    for (const d of this.rain) {
      const left = d.at - now;
      if (left > R.FINALE.slam.rainWarnMs) continue;
      t.lineStyle(1, 0xff3a3a, 0.4 + pulse).lineBetween(d.x - 3, d.y - 3, d.x + 3, d.y + 3).lineBetween(d.x - 3, d.y + 3, d.x + 3, d.y - 3);
      if (left < 260) f.fillStyle(0xff4f7a).fillCircle(d.x, d.y - (40 * left) / 260, 2);
    }
    if (this.bossDead) return;
    if (now < this.slowUntil) f.fillStyle(0x9fe8ff, 0.25).fillCircle(b.x, b.y, 12);
    if (now < this.poisonUntil) for (let i = 0; i < 3; i++) f.fillStyle(0x6fd13a, 0.8).fillRect(b.x - 8 + i * 7, b.y - 14 - ((now / 8 + i * 9) % 10), 2, 2);
    if (now < this.paralyzedUntil) for (let i = 0; i < 4; i++) {
      const a = now / 150 + i * (Math.PI / 2);
      f.fillStyle(0xffee44).fillRect(b.x + Math.cos(a) * 13, b.y - 4 + Math.sin(a) * 4, 2, 2);
    }
    if (now < this.suckUntil) for (let i = 0; i < 10; i++) {
      const k = ((now / 400 + i / 10) % 1);
      f.fillStyle(0xe03a4a, 0.9).fillRect(b.x + (p.x - b.x) * k, b.y + (p.y - b.y) * k, 2, 2);
    }
    if (now < this.shieldUntil) f.lineStyle(1, 0x6aa8ff, 0.6 + 0.3 * Math.sin(now / 80)).strokeCircle(p.x, p.y, 9);
  }

  private drawHud() {
    const g = this.hud.clear();
    const hx = PLAY.x + WALL + 3;
    const hy = PLAY.y + 3;
    g.fillStyle(this.fightMs < this.shieldUntil ? 0x6aa8ff : 0x000000).fillRect(hx - 1, hy - 1, 62, 7);
    g.fillStyle(0x442228).fillRect(hx, hy, 60, 5);
    g.fillStyle(0xe03a4a).fillRect(hx, hy, Math.round((60 * this.hp) / this.kit.maxHp), 5);
    this.texts.hp.setText(`${Math.ceil(this.hp)}`);
    this.cdG.clear();
    this.specialIcons.forEach((icon, i) => {
      const id = this.kit.specials[i];
      const left = this.combat.specialLeft(id);
      if (left > 0) {
        const frac = left / (R.item(id).cooldownMs ?? 1);
        this.cdG.fillStyle(0x000000, 0.7).fillRect(icon.x - 4, icon.y - 4, 9, Math.ceil(9 * frac));
        this.cdTexts[i].setText(String(Math.ceil(left / 1000))).setVisible(true);
        icon.setAlpha(0.6);
      } else {
        this.cdTexts[i].setVisible(false);
        icon.setAlpha(1);
      }
    });
    const bw = 110;
    const bx = WIDTH / 2 - bw / 2;
    const by = PLAY.y + 4;
    g.fillStyle(0x000000).fillRect(bx - 1, by - 1, bw + 2, 6);
    g.fillStyle(0x333333).fillRect(bx, by, bw, 4);
    g.fillStyle(R.STAGES[this.stage].color).fillRect(bx, by, Math.round((bw * this.bossHp) / R.BOSS_MAX_HP), 4);
    g.fillStyle(0xffffff).fillRect(bx + Math.round(bw / 3), by - 1, 1, 6).fillRect(bx + Math.round((bw * 2) / 3), by - 1, 1, 6);

    const now = this.fightMs;
    const status = [now < this.slowUntil ? 'slow' : '', now < this.poisonUntil ? `poison ${Math.ceil((this.poisonUntil - now) / 1000)}s` : '', now < this.paralyzedUntil ? 'stunned' : '']
      .filter(Boolean).join(' ');
    this.texts.boss.setText(!this.bossDead ? `MOSSBACK ${this.stage}/3` : this.doorOpen ? '<- the hidden door is west' : 'Take the key!');
    this.texts.status.setText(this.bossDead ? '' : status);
    if (this.hand.visible) {
      const readyFrac = this.combat.readyFrac();
      this.hand.update(this.kit.weapons, this.combat.wIndex, readyFrac);
      showHandArt(this, this.kit.weapons[this.combat.wIndex], readyFrac);
    }
    const here = this.visit > 0;
    const secs = Math.ceil((here ? R.msUntilRetailerLeaves(this.fightMs) : R.msUntilRetailer(this.fightMs)) / 1000);
    this.texts.retailer.setText(this.bossDead ? '' : here ? `Fisher here ${secs}s` : `Fisher in ${secs}s`);
  }

  private drawArena() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x1f2a1f).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    for (let i = 0; i < 160; i++) {
      const x = PLAY.x + ((i * 53) % PLAY.width);
      const y = PLAY.y + ((i * 97 + (i % 7) * 13) % PLAY.height);
      g.fillStyle(i % 9 === 0 ? 0x3d4a35 : 0x2c3b28).fillRect(x, y, i % 9 === 0 ? 2 : 1, 1);
    }
    g.fillStyle(0x55555f).fillRect(PLAY.x, PLAY.y, WALL, PLAY.height);
    for (let y = 0; y < PLAY.height; y += 6) g.fillStyle(0x45454f).fillRect(PLAY.x, PLAY.y + y, WALL, 1);
    g.fillStyle(0x6a6a74).fillRect(PLAY.x + WALL - 1, PLAY.y, 1, PLAY.height);
    this.drawPond();
  }

  private drawPond() {
    const cx = FISHER_X;
    const cy = PLAY.y + PLAY.height - 6;
    const pw = 56;
    const ph = 22;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x1a2418).fillEllipse(cx, cy, pw + 8, ph + 6);
    g.fillStyle(0x2a3a2a).fillEllipse(cx, cy, pw + 4, ph + 3);
    const shape = () => this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0xffffff).fillEllipse(cx, cy, pw, ph).createGeometryMask();
    const water = this.add.tileSprite(cx - pw / 2, cy - ph / 2, pw, ph, 'water').setOrigin(0).setDepth(0).setTilePosition(0, 10);
    water.setMask(shape());
    this.tweens.add({ targets: water, tilePositionX: 37, duration: 9000, repeat: -1 });
    const shade = this.add.graphics().setDepth(0);
    shade.fillStyle(0x0a1a2a, 0.35).fillEllipse(cx, cy, pw, ph);
    shade.lineStyle(1, 0x9fd3ff, 0.35).strokeEllipse(cx, cy, pw - 2, ph - 2);
    for (const [dx, dy, sz] of [[-26, -6, 3], [-19, -10, 2], [21, -9, 3], [27, -4, 2], [-10, -12, 2]] as const) {
      g.fillStyle(0x5a5a64).fillRect(cx + dx, cy + dy, sz + 1, sz);
      g.fillStyle(0x7a7a84).fillRect(cx + dx, cy + dy, sz, 1);
    }
    for (const [dx, hgt] of [[-31, 9], [-29, 12], [-33, 7], [23, 10], [25, 13]] as const) {
      g.fillStyle(0x4a7a3a).fillRect(cx + dx, cy - 4 - hgt, 1, hgt);
      if (hgt > 9) g.fillStyle(0x6b4a2b).fillRect(cx + dx, cy - 4 - hgt, 1, 3);
    }
    for (const [dx, dy, delay] of [[-14, 2, 0], [10, 4, 1300], [-2, -2, 2600]] as const) {
      const r = this.add.ellipse(cx + dx, cy + dy, 6, 2).setStrokeStyle(1, 0xcfe8ff, 0.7).setFillStyle(0, 0).setDepth(0);
      r.setMask(shape());
      this.tweens.add({ targets: r, scaleX: 3, scaleY: 3, alpha: 0, duration: 1800, delay, repeat: -1, repeatDelay: 2200 });
    }
    const d = this.add.graphics().setDepth(1);
    d.fillStyle(0x3a2a1a).fillRect(cx - 9, cy - 14, 18, 8);
    for (let i = 0; i < 3; i++) d.fillStyle(i % 2 ? 0x6b4a2b : 0x7a5530).fillRect(cx - 8 + i * 6, cy - 14, 5, 7);
    d.fillStyle(0x2a1a0a).fillRect(cx - 8, cy - 7, 2, 3).fillRect(cx + 6, cy - 7, 2, 3);
    const tip = { x: FISHER_X + 6, y: FISHER_Y - 8 };
    const float = { x: cx + 16, y: cy - 2 };
    const mid = { x: (tip.x + float.x) / 2 + 2, y: tip.y + 3 };
    const line = this.add.graphics().setDepth(6).setAlpha(0);
    line.lineStyle(1, 0xdddddd, 0.5).lineBetween(tip.x, tip.y, mid.x, mid.y).lineBetween(mid.x, mid.y, float.x, float.y);
    const bob = this.add.graphics({ x: float.x, y: float.y }).setDepth(6).setAlpha(0);
    bob.fillStyle(0xd83a3a).fillRect(-1, -2, 2, 2).fillStyle(0xffffff).fillRect(-1, 0, 2, 1);
    this.tweens.add({ targets: bob, y: float.y + 1, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    this.bobber = [line, bob];
  }

  private banner(title: string, sub: string) { showBanner(this, title, sub); }

  private floatText(x: number, y: number, msg: string, color: string) { showFloat(this, x, y, msg, color); }

  private cleanupProjectiles() {
    const out = (o: Sprite) => o.x < PLAY.x - 2 || o.x > PLAY.x + PLAY.width + 2 || o.y < PLAY.y - 2 || o.y > PLAY.y + PLAY.height + 2;
    for (const b of [...this.bullets.getChildren()] as Sprite[]) if (out(b)) b.destroy();
    this.combat.cleanup();
  }

  private thrownOut() {
    if (this.ended) return;
    this.ended = true;
    this.heldBall.setVisible(false);
    this.endFinale();
    const found = [...this.rings];
    updateSave((s) => ({ ...s, wallet: this.wallet, lifetimeRings: R.addRings(s.lifetimeRings, found) }));

    (this.player.body as Body).setVelocity(0, 0).enable = false;
    (this.boss.body as Body).setVelocity(0, 0).enable = false;
    this.telegraph = null;
    this.bullets.clear(true, true);
    this.combat.clearShots();
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(1);
    this.fisherPrompt.setVisible(false);
    this.banner('MOSSBACK SMASHES YOU', '...all the way back to the village');

    const p = this.player;
    const dir = p.x <= this.boss.x ? -1 : 1;
    const clampX = (x: number) => Phaser.Math.Clamp(x, PLAY.x + WALL + 6, PLAY.x + PLAY.width - 6);
    this.tweens.add({
      targets: this.bossView, scaleY: 0.75, scaleX: 1.2, rotation: 0, duration: 160, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => {
        this.cameras.main.shake(260, 0.025);
        bounce(this, p, [
          { x: clampX(p.x + dir * 45), y: p.y, h: 30, ms: 420 },
          { x: clampX(p.x + dir * 75), y: p.y, h: 16, ms: 300 },
        ], { spin: dir * Math.PI * 2, onLand: (x, y) => { sfx(this, 'bounce'); dustPuff(this, x, y); this.cameras.main.shake(90, 0.01); } }, () => this.bounceOut());
      },
    });
  }

  private bounceOut() {
    const p = this.player;
    this.tweens.add({ targets: p, y: PLAY.y - 30, scale: 2.6, rotation: p.rotation - Math.PI * 3, duration: 650, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.bossView, y: this.bossView.y - 5, yoyo: true, repeat: 3, duration: 140 });
    this.time.delayedCall(450, () => {
      this.cameras.main.fadeOut(350, 255, 255, 255);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('village', { bouncedBack: true, kept: this.rings.length }));
    });
  }
}
