// Your weapons, shared by the arena (Mossback) and the village training yard (the dummy).
//
//   aim       mouse once it moves, else the way you walk; crosshair (red = an attack now would
//             hit the target), the weapon in hand points at it, its reach is drawn on the ground
//   attack    click / Space / J, hold to keep attacking; each weapon has its own cooldown
//   Q         next weapon in the kit
//   specials  the scene decides what each one does; Combat gives it the cooldowns, projectiles,
//             the bomb and the shock ring
//
// Every timer runs on the scene's clock (`now`), so the arena can stop it for the shop and hit-stop.
import Phaser from 'phaser';
import * as R from './game/rules';
import { sfx } from './media';
import type { Keys } from './player';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
export interface Dir { x: number; y: number }
export interface Area { x: number; y: number; width: number; height: number }
export type ShotEffect = '' | 'freeze' | 'poison';

/** What your attacks hit. */
export interface CombatTarget {
  sprite: Sprite;
  alive(): boolean;
  /** A hit landed (melee, a shot, the bomb). */
  hit(dmg: number): void;
  /** A spell shot landed with an effect (after `hit`). */
  effect?(effect: Exclude<ShotEffect, ''>): void;
}

export interface CombatOptions {
  player: Sprite;
  target: CombatTarget;
  kit: R.Loadout;
  now: () => number;                 // the scene's fight clock, in ms
  area: Area;                        // shots die outside it; bombs and the crosshair stay inside
  damageMul?: () => number;          // buffs (the bar's mead, the whetstone)
}

const SWING_MS = 140;
const HIT_R = 11;                     // how far from the target's centre a hit still counts
export const SPELL_SPEED = 180;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

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
    this.wIndex = o.kit.weapons.length > 1 ? 1 : 0;      // your melee weapon if you have one
    this.shots = scene.physics.add.group();
    scene.physics.add.overlap(o.target.sprite, this.shots, (_t, s) => this.shotHit(s as Sprite));
    this.aimG = scene.add.graphics().setDepth(8);
    this.held = scene.add.image(0, 0, 'held_fists').setDepth(11).setVisible(false);
    this.crosshair = scene.add.image(0, 0, 'crosshair').setDepth(990).setVisible(false);
    scene.input.on('pointermove', this.onMove);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('pointermove', this.onMove));
  }

  get kit() { return this.o.kit; }
  /** New gear (equipped at the merchant): keep the weapon in hand if it is still there. */
  setKit(kit: R.Loadout) {
    const id = this.o.kit.weapons[this.wIndex];
    this.o.kit = kit;
    const i = kit.weapons.indexOf(id);
    this.wIndex = i >= 0 ? i : kit.weapons.length > 1 ? 1 : 0;
  }
  currentWeapon(): R.Weapon { return R.weapon(this.o.kit.weapons[this.wIndex]); }
  nextWeapon() { this.wIndex = (this.wIndex + 1) % this.o.kit.weapons.length; }
  /** 0..1: how far the weapon in hand has recharged (for the hand HUD). */
  readyFrac(): number {
    const w = this.currentWeapon();
    return Phaser.Math.Clamp(1 - ((this.weaponReadyAt[w.id] ?? 0) - this.o.now()) / w.cooldownMs, 0, 1);
  }
  /** Ms until this special can be cast again (0 = ready). */
  specialLeft(id: R.SpecialId): number { return Math.max(0, (this.specialReadyAt[id] ?? 0) - this.o.now()); }
  /** Starts a special's cooldown. */
  usedSpecial(id: R.SpecialId) { this.specialReadyAt[id] = this.o.now() + (R.item(id).cooldownMs ?? 0); }
  private damageMul() { return this.o.damageMul?.() ?? 1; }
  hitDamage(base: number) { return R.hitDamage(base, this.damageMul()); }

  /** Remember the walking direction (keyboard aim) and turn the hero toward the aim. */
  face(walkDir: Dir | null) {
    if (walkDir) this.facing = walkDir;
    const a = this.aimDir();
    const p = this.o.player;
    if (Math.abs(a.y) > Math.abs(a.x) * 1.2) p.setTexture(a.y < 0 ? 'player_up' : 'player').setFlipX(false);
    else p.setTexture('player_side').setFlipX(a.x < 0);
  }

  /** Where the hero aims: at the cursor once the mouse is used, else the way he walks. */
  aimDir(): Dir {
    if (!this.aimMouse) return this.facing;
    const p = this.scene.input.activePointer;
    const dx = p.worldX - this.o.player.x;
    const dy = p.worldY - this.o.player.y;
    const len = Math.hypot(dx, dy);
    return len < 1 ? this.facing : { x: dx / len, y: dy / len };
  }

  /** Space / J / the mouse button (press or hold), Q. Specials stay with the scene. */
  keys(k: Keys) {
    const JD = Phaser.Input.Keyboard.JustDown;
    const ptr = this.scene.input.activePointer;
    const held = k.SPACE.isDown || k.J.isDown || (ptr.isDown && ptr.leftButtonDown());
    if (ptr.isDown) this.aimMouse = true;
    if (JD(k.SPACE) || JD(k.J) || (held && this.o.now() >= (this.weaponReadyAt[this.currentWeapon().id] ?? 0))) this.attack(this.aimDir());
    if (JD(k.Q)) this.nextWeapon();
  }

  /**
   * Every frame: the weapon in hand points at the aim (sweeps / jabs / recoils when used), its
   * reach is drawn on the ground, the crosshair turns red when an attack now would hit.
   * Dim = still recharging. show = false hides it all (weapon away).
   */
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
    let dist = 6;
    const left = this.swingUntil - now;
    if (left > 0) {
      const k = 1 - left / SWING_MS;
      if (this.swingKind === 'sweep') rot = this.swingAngle - 0.9 + 1.8 * easeOut(k);
      else if (this.swingKind === 'jab') dist = 6 + 7 * Math.sin(Math.PI * k);
      else dist = 6 - 3 * (1 - k);
    }
    const up = Math.abs(d.y) > Math.abs(d.x) * 1.2 && d.y < 0;
    this.held.setTexture(`held_${w.id}`).setPosition(p.x + Math.cos(rot) * dist, p.y + Math.sin(rot) * dist + 1)
      .setRotation(rot).setFlipY(Math.cos(rot) < 0).setDepth(up ? p.depth - 1 : p.depth + 1);   // behind him when aiming up

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

  /** Your projectiles: weapon shots and spells. `effect` is what a spell does on hit. */
  projectile(texture: string, dir: Dir, speed: number, dmg: number, effect: ShotEffect = '') {
    const p = this.o.player;
    const s = this.shots.create(p.x, p.y, texture) as Sprite;
    s.setRotation(Math.atan2(dir.y, dir.x)).setDepth(p.depth + 1).setData('dmg', dmg).setData('effect', effect).setData('dies', this.o.now() + 2000);
    (s.body as Body).setVelocity(dir.x * speed, dir.y * speed);
  }

  private shotHit(s: Sprite) {
    if (!s.active) return;
    const dmg = s.getData('dmg') as number;
    const effect = s.getData('effect') as ShotEffect;
    s.destroy();
    const t = this.o.target;
    if (!t.alive()) return;
    t.hit(dmg);
    if (effect) t.effect?.(effect);
  }

  /** The bomb special: thrown toward the aim, blinks for its fuse, then a big blast. */
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

  /** A shock ring that grows and fades (the push special). */
  ring(x: number, y: number, r: number, color: number) {
    const c = this.scene.add.circle(x, y, 4).setStrokeStyle(1, color, 0.9).setDepth(12);
    this.scene.tweens.add({ targets: c, radius: r, alpha: 0, duration: 300, onComplete: () => c.destroy() });
  }

  /** Shots that left the area or flew too long. */
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
