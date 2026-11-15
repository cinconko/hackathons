// Hero movement shared by the village, the arena and the treasury.
import Phaser from 'phaser';
import { dustPuff } from './fx';
import { PLAYER_SPEED, type ArmorId } from './game/rules';
import { BREATH_MS, heroFrame, WALK, WALK_MS, type HeroFrame } from './heroFrames';

export type Keys = Record<string, Phaser.Input.Keyboard.Key>;

export function addKeys(scene: Phaser.Scene): Keys {
  return scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,Q,E,ESC,ENTER,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Keys;
}

/** WASD / arrows. Sets the velocity; returns the direction when moving, else null. */
export function steer(player: Phaser.Physics.Arcade.Sprite, keys: Keys, speedMul = 1): { x: number; y: number } | null {
  const vx = (keys.D.isDown || keys.RIGHT.isDown ? 1 : 0) - (keys.A.isDown || keys.LEFT.isDown ? 1 : 0);
  const vy = (keys.S.isDown || keys.DOWN.isDown ? 1 : 0) - (keys.W.isDown || keys.UP.isDown ? 1 : 0);
  const body = player.body as Phaser.Physics.Arcade.Body;
  if (vx === 0 && vy === 0) { body.setVelocity(0, 0); animateHero(player, false); return null; }
  const len = Math.hypot(vx, vy);
  const dir = { x: vx / len, y: vy / len };
  body.setVelocity(dir.x * PLAYER_SPEED * speedMul, dir.y * PLAYER_SPEED * speedMul);
  if (vx !== 0) player.setFlipX(vx < 0);
  animateHero(player, true);
  return dir;
}

export const near = (a: { x: number; y: number }, x: number, y: number, r: number) => Phaser.Math.Distance.Between(a.x, a.y, x, y) < r;

// ---- How the hero looks: some armor changes him ----

/** Armor with its own drawing: wearing it, the hero is that sprite (front view, used for every direction). */
const ARMOR_LOOKS: Partial<Record<ArmorId, string>> = {
  leather: 'hero_leather', copper: 'hero_copper', bronze: 'hero_bronze', iron: 'hero_iron', steel: 'hero_steel', magnetite: 'hero_magnetite',
};

export interface HeroLook { down: string; up: string; side: string }
const PLAIN: HeroLook = { down: 'player', up: 'player_up', side: 'player_side' };

export function heroLook(scene: Phaser.Scene, armor: ArmorId | null): HeroLook {
  const key = armor ? ARMOR_LOOKS[armor] : undefined;
  if (key && scene.textures.exists(key)) return { down: key, up: key, side: key };
  // the team's farmer (player.png) has one front view: it serves every direction, like the knights.
  // Only the old 8x10 placeholder has its own up and side frames.
  return scene.textures.get('player').getSourceImage().width > 8 ? { down: 'player', up: 'player', side: 'player' } : PLAIN;
}

/** The look the hero wears now (set by dress). */
export const lookOf = (p: Phaser.GameObjects.Sprite): HeroLook => (p.getData('look') as HeroLook | undefined) ?? PLAIN;

/**
 * Dresses the hero. His hitbox stays the plain hero's 8x10, at his feet: a bigger drawing
 * (the farmer is 10x18, the knights 13x18: the merchant's height) is not a bigger target and still fits through the gaps.
 */
export function dress(p: Phaser.Physics.Arcade.Sprite, look: HeroLook) {
  p.setData('look', look).setData('frame', null).setFlipX(false);
  setHeroBase(p, look.down);
  const body = p.body as Phaser.Physics.Arcade.Body | null;
  body?.setSize(8, 10, false).setOffset((p.width - 8) / 2, p.height - 10);
}

// ---- The hero moves: walking legs, an idle breath (frames made in src/heroFrames.ts) ----

/**
 * The texture for `frame` of drawing `key` (`<key>~left` etc.), made once from the drawing's pixels.
 * The old 8x10 placeholder (or anything missing) just shows the drawing itself.
 */
function frameKey(scene: Phaser.Scene, key: string, frame: HeroFrame | null): string {
  if (!frame || !scene.textures.exists(key)) return key;
  const out = `${key}~${frame}`;
  if (scene.textures.exists(out)) return out;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const { width: w, height: h } = src;
  if (w <= 8) return key;
  const tex = scene.textures.createCanvas(out, w, h);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  img.data.set(heroFrame(img.data, w, h, frame));
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return out;
}

/** Which drawing the hero shows (the look's front, back or side: dress, and Combat.face turning him). */
export function setHeroBase(p: Phaser.GameObjects.Sprite, key: string) {
  p.setData('base', key);
  p.setTexture(frameKey(p.scene, key, (p.getData('frame') as HeroFrame | null) ?? null));
}

/**
 * Every frame (steer calls it): walking, the legs step left, stand, right, stand, with a puff of
 * dust at each step; standing still, a slow breath. Every frame is the drawing's own size, so the
 * hitbox and everything placed by it stay put.
 */
export function animateHero(p: Phaser.GameObjects.Sprite, moving: boolean) {
  const now = p.scene.time.now;
  let frame: HeroFrame | null;
  if (moving) {
    if (!p.getData('walkSince')) p.setData('walkSince', now);
    frame = WALK[Math.floor((now - (p.getData('walkSince') as number)) / WALK_MS) % WALK.length];
  } else {
    p.setData('walkSince', 0);
    frame = now % BREATH_MS > BREATH_MS * 0.55 ? 'breathe' : null;
  }
  if (frame === ((p.getData('frame') as HeroFrame | null) ?? null)) return;
  p.setData('frame', frame);
  p.setTexture(frameKey(p.scene, (p.getData('base') as string | undefined) ?? p.texture.key, frame));
  if (moving && frame) dustPuff(p.scene, p.x + (frame === 'left' ? -2 : 2), p.y + p.displayHeight / 2 - 5, 1, 3);   // a footstep
}
