import Phaser from 'phaser';
import * as R from './game/rules';
import { lookOf, setHeroBase } from './player';
import { sfx } from './media';
import type { Keys } from './player';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
export interface Dir { x: number; y: number }
export interface Area { x: number; y: number; width: number; height: number }
export type ShotEffect = '' | 'freeze' | 'poison';

export interface CombatTarget {
  sprite: Sprite;
  alive(): boolean;
  hit(dmg: number): void;
  effect?(effect: Exclude<ShotEffect, ''>): void;
}

export interface CombatOptions {
  player: Sprite;
  target: CombatTarget;
  kit: R.Loadout;
  now: () => number;
  area: Area;
  damageMul?: () => number;
}

const SWING_MS = 140;
const HIT_R = 11;
export const SPELL_SPEED = 180;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

const GRIP: Partial<Record<string, number>> = { fists: 0.5, bow: 0.6 };

export function handOf(p: Phaser.GameObjects.Sprite, leftHand: boolean) {
  const w = p.frame.width;
  const h = p.frame.height;
  const hx = (Math.round(w * 0.8) + 0.5 - w / 2) * p.scaleX;
  const hy = (Math.round(h * 0.74) + 0.5 - h / 2) * p.scaleY;
  return { x: p.x + (leftHand ? -hx : hx), y: p.y + hy };
}

export class Combat {
  readonly shots: Phaser.Physics.Arcade.Group;
  wIndex: number;
  private facing: Dir = { x: 1, y: 0 };
  private aimMouse = false;
  private weaponReadyAt: Partial<Record<R.WeaponId, number>> = {};
  private specialReadyAt: Partial<Record<R.SpecialId, number>> = {};
  private swingUntil = 0;
  private swingKind: 'sweep' | 'jab' | 'recoil' = 'sweep';
  private swingAngle = 0;
  private readonly aimG: Phaser.GameObjects.Graphics;
  private readonly held: Phaser.GameObjects.Image;
  private readonly crosshair: Phaser.GameObjects.Image;
  private readonly onMove = () => { this.aimMouse = true; };

  constructor(private readonly scene: Phaser.Scene, private readonly o: CombatOptions) {
    this.wIndex = o.kit.weapons.length > 1 ? 1 : 0;
    this.shots = scene.physics.add.group();
    scene.physics.add.overlap(o.target.sprite, this.shots, (_t, s) => this.shotHit(s as Sprite));
    this.aimG = scene.add.graphics().setDepth(8);
    this.held = scene.add.image(0, 0, 'held_fists').setDepth(11).setVisible(false);
    this.crosshair = scene.add.image(0, 0, 'crosshair').setDepth(990).setVisible(false);
    scene.input.on('pointermove', this.onMove);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('pointermove', this.onMove));
  }

  get kit() { return this.o.kit; }
  setKit(kit: R.Loadout) {
    const id = this.o.kit.weapons[this.wIndex];
    this.o.kit = kit;
    const i = kit.weapons.indexOf(id);
    this.wIndex = i >= 0 ? i : kit.weapons.length > 1 ? 1 : 0;
  }
  currentWeapon(): R.Weapon { return R.weapon(this.o.kit.weapons[this.wIndex]); }
  nextWeapon() { this.wIndex = (this.wIndex + 1) % this.o.kit.weapons.length; }
  readyFrac(): number {
    const w = this.currentWeapon();
    return Phaser.Math.Clamp(1 - ((this.weaponReadyAt[w.id] ?? 0) - this.o.now()) / w.cooldownMs, 0, 1);
  }
  specialLeft(id: R.SpecialId): number { return Math.max(0, (this.specialReadyAt[id] ?? 0) - this.o.now()); }
  usedSpecial(id: R.SpecialId) { this.specialReadyAt[id] = this.o.now() + (R.item(id).cooldownMs ?? 0); }
  private damageMul() { return this.o.damageMul?.() ?? 1; }
  hitDamage(base: number) { return R.hitDamage(base, this.damageMul()); }

  face(walkDir: Dir | null) {
    if (walkDir) this.facing = walkDir;
    const a = this.aimDir();
    const p = this.o.player;
    const look = lookOf(p);
    if (Math.abs(a.y) > Math.abs(a.x) * 1.2) { setHeroBase(p, a.y < 0 ? look.up : look.down); p.setFlipX(false); }
    else { setHeroBase(p, look.side); p.setFlipX(a.x < 0); }
  }

  aimDir(): Dir {
    if (!this.aimMouse) return this.facing;
    const p = this.scene.input.activePointer;
    const dx = p.worldX - this.o.player.x;
    const dy = p.worldY - this.o.player.y;
    const len = Math.hypot(dx, dy);
    return len < 1 ? this.facing : { x: dx / len, y: dy / len };
  }

  keys(k: Keys) {
    const JD = Phaser.Input.Keyboard.JustDown;
    const ptr = this.scene.input.activePointer;
    const held = k.SPACE.isDown || k.J.isDown || (ptr.isDown && ptr.leftButtonDown());
    if (ptr.isDown) this.aimMouse = true;
    if (JD(k.SPACE) || JD(k.J) || (held && this.o.now() >= (this.weaponReadyAt[this.currentWeapon().id] ?? 0))) this.attack(this.aimDir());
    if (JD(k.Q)) this.nextWeapon();
  }

  drawAim(show: boolean) {
    const g = this.aimG.clear();
    this.held.setVisible(show);
    this.crosshair.setVisible(show);
    if (!show) return;
    const p = this.o.player;
    const d = this.aimDir();
    const a = Math.atan2(d.y, d.x);
    const w = this.currentWeapon();
    const now = this.o.now();
    const ready = now >= (this.weaponReadyAt[w.id] ?? 0);
    const t = this.o.target.sprite;
    const alive = this.o.target.alive();
    let hits: boolean;

    if (w.kind === 'melee') {
      const reach = w.reach * 0.6;
      hits = alive && Phaser.Math.Distance.Between(p.x + d.x * reach, p.y + d.y * reach, t.x, t.y) < HIT_R + reach;
      g.fillStyle(hits ? 0xff5a5a : 0xffffff, ready ? 0.22 : 0.08);
      g.slice(p.x, p.y, w.reach + 3, a - 0.75, a + 0.75, false).fillPath();
    } else {
      const along = (t.x - p.x) * d.x + (t.y - p.y) * d.y;
      const off = Math.abs((t.x - p.x) * d.y - (t.y - p.y) * d.x);
      hits = alive && along > 0 && off < HIT_R;
      g.fillStyle(hits ? 0xff5a5a : 0xffffff, ready ? 0.7 : 0.25);
      for (let i = 1; i <= 12; i++) g.fillRect(Math.round(p.x + d.x * (6 + i * 6)), Math.round(p.y + d.y * (6 + i * 6)), 1, 1);
    }

    let rot = a;
    let push = 0;
    const left = this.swingUntil - now;
    if (left > 0) {
      const k = 1 - left / SWING_MS;
      if (this.swingKind === 'sweep') rot = this.swingAngle - 0.9 + 1.8 * easeOut(k);
      else if (this.swingKind === 'jab') push = 7 * Math.sin(Math.PI * k);
      else push = -3 * (1 - k);
    }
    const hand = handOf(p, Math.cos(a) < 0);
    const up = Math.abs(d.y) > Math.abs(d.x) * 1.2 && d.y < 0;
    this.held.setTexture(`held_${w.id}`).setOrigin(GRIP[w.id] ?? 1.5 / this.held.frame.width, 0.5)
      .setPosition(hand.x + Math.cos(a) * push, hand.y + Math.sin(a) * push)
      .setRotation(rot).setFlipY(Math.cos(rot) < 0).setDepth(up ? p.depth - 1 : p.depth + 1);

    const A = this.o.area;
    const ptr = this.scene.input.activePointer;
    const cx = this.aimMouse ? ptr.worldX : p.x + d.x * 24;
    const cy = this.aimMouse ? ptr.worldY : p.y + d.y * 24;
    this.crosshair.setTexture(hits ? 'crosshair_hot' : 'crosshair')
      .setPosition(Math.round(Phaser.Math.Clamp(cx, A.x, A.x + A.width)), Math.round(Phaser.Math.Clamp(cy, A.y, A.y + A.height)))
      .setAlpha(ready ? 1 : 0.45);
  }

  attack(dir: Dir) {
    const w = this.currentWeapon();
    const now = this.o.now();
    if (now < (this.weaponReadyAt[w.id] ?? 0)) return;
    this.weaponReadyAt[w.id] = now + w.cooldownMs;
    const dmg = this.hitDamage(w.damage);
    this.swingAngle = Math.atan2(dir.y, dir.x);
    this.swingUntil = now + SWING_MS;
    if (w.kind === 'melee') {
      this.swingKind = w.id === 'fists' ? 'jab' : 'sweep';
      sfx(this.scene, 'swing', 0.4);
      this.melee(dir, w, dmg);
    } else {
      this.swingKind = 'recoil';
      sfx(this.scene, 'shoot', 0.5);
      this.projectile(`proj_${w.id}`, dir, w.speed, dmg);
    }
  }

  private melee(dir: Dir, w: R.Weapon, dmg: number) {
    const reach = w.reach * 0.6;
    const p = this.o.player;
    const cx = p.x + dir.x * reach;
    const cy = p.y + dir.y * reach;
    const fx = this.scene.add.image(cx, cy, w.id === 'fists' ? 'punch' : 'slash').setRotation(Math.atan2(dir.y, dir.x)).setDepth(p.depth + 1).setScale(Math.max(0.7, w.reach / 16));
    this.scene.tweens.add({ targets: fx, alpha: 0, duration: 160, onComplete: () => fx.destroy() });
    const t = this.o.target;
    if (t.alive() && Phaser.Math.Distance.Between(cx, cy, t.sprite.x, t.sprite.y) < HIT_R + reach) t.hit(dmg);
  }

  projectile(texture: string, dir: Dir, speed: number, dmg: number, effect: ShotEffect = '') {
    const p = this.o.player;
    const s = this.shots.create(p.x, p.y, texture) as Sprite;
    s.setRotation(Math.atan2(dir.y, dir.x)).setDepth(p.depth + 1).setData('dmg', dmg).setData('effect', effect).setData('dies', this.o.now() + 2000);
    (s.body as Body).setVelocity(dir.x * speed, dir.y * speed);
    this.flash(`${texture}_cast`, p.x + dir.x * 7, p.y + dir.y * 7, 1, 180, p.depth + 2, dir.x < 0);
  }

  private flash(key: string, x: number, y: number, grow: number, ms: number, depth: number, flipX = false) {
    if (!this.scene.textures.exists(key)) return;
    const fx = this.scene.add.image(Math.round(x), Math.round(y), key).setDepth(depth).setFlipX(flipX);
    this.scene.tweens.add({ targets: fx, alpha: 0, scale: grow, duration: ms, ease: 'Quad.easeOut', onComplete: () => fx.destroy() });
  }

  private shotHit(s: Sprite) {
    if (!s.active) return;
    const dmg = s.getData('dmg') as number;
    const effect = s.getData('effect') as ShotEffect;
    this.flash(`${s.texture.key}_hit`, s.x, s.y, 1.4, 280, s.depth + 1);
    s.destroy();
    const t = this.o.target;
    if (!t.alive()) return;
    t.hit(dmg);
    if (effect) t.effect?.(effect);
  }

  throwBomb(d: Dir, damage: number) {
    const S = R.SPECIAL;
    const A = this.o.area;
    const p = this.o.player;
    const tx = Phaser.Math.Clamp(p.x + d.x * S.bombThrow, A.x + 4, A.x + A.width - 4);
    const ty = Phaser.Math.Clamp(p.y + d.y * S.bombThrow, A.y + 4, A.y + A.height - 4);
    const sc = this.scene;
    const bomb = sc.add.image(p.x, p.y, 'bomb').setDepth(p.depth + 1);
    sc.tweens.add({ targets: bomb, x: tx, y: ty, duration: 350, ease: 'Quad.easeOut' });
    sc.tweens.add({ targets: bomb, alpha: 0.3, yoyo: true, repeat: -1, duration: 150, delay: 350 });
    const marker = sc.add.circle(tx, ty, S.bombRadius).setStrokeStyle(1, 0xff5a5a, 0.6).setDepth(7);
    sc.time.delayedCall(S.bombFuseMs, () => {
      bomb.destroy();
      marker.destroy();
      const blast = sc.add.image(tx, ty, 'blast').setDepth(p.depth + 1).setScale(0.4);
      sc.tweens.add({ targets: blast, scale: 1.3, alpha: 0, duration: 320, onComplete: () => blast.destroy() });
      sc.cameras.main.shake(180, 0.015);
      const t = this.o.target;
      if (t.alive() && Phaser.Math.Distance.Between(tx, ty, t.sprite.x, t.sprite.y) < S.bombRadius + 10) t.hit(this.hitDamage(damage));
    });
  }

  ring(x: number, y: number, r: number, color: number) {
    const c = this.scene.add.circle(x, y, 4).setStrokeStyle(1, color, 0.9).setDepth(12);
    this.scene.tweens.add({ targets: c, radius: r, alpha: 0, duration: 300, onComplete: () => c.destroy() });
  }

  cleanup() {
    const A = this.o.area;
    const now = this.o.now();
    for (const s of [...this.shots.getChildren()] as Sprite[]) {
      const out = s.x < A.x - 2 || s.x > A.x + A.width + 2 || s.y < A.y - 2 || s.y > A.y + A.height + 2;
      if (out || now > (s.getData('dies') as number)) s.destroy();
    }
  }

  clearShots() { this.shots.clear(true, true); }
}
