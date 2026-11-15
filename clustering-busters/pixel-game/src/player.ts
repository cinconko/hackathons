import Phaser from 'phaser';
import { PLAYER_SPEED, type ArmorId } from './game/rules';
import { heroFrame, WALK, WALK_MS, type HeroFrame } from './heroFrames';

export type Keys = Record<string, Phaser.Input.Keyboard.Key>;

export function addKeys(scene: Phaser.Scene): Keys {
  return scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,Q,E,ESC,ENTER,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Keys;
}

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

const ARMOR_LOOKS: Partial<Record<ArmorId, string>> = {
  leather: 'hero_leather', copper: 'hero_copper', bronze: 'hero_bronze', iron: 'hero_iron', steel: 'hero_steel', magnetite: 'hero_magnetite',
};

export interface HeroLook { down: string; up: string; side: string }
const PLAIN: HeroLook = { down: 'player', up: 'player_up', side: 'player_side' };

export function heroLook(scene: Phaser.Scene, armor: ArmorId | null): HeroLook {
  const key = armor ? ARMOR_LOOKS[armor] : undefined;
  if (key && scene.textures.exists(key)) return { down: key, up: key, side: key };
  return scene.textures.get('player').getSourceImage().width > 8 ? { down: 'player', up: 'player', side: 'player' } : PLAIN;
}

export const lookOf = (p: Phaser.GameObjects.Sprite): HeroLook => (p.getData('look') as HeroLook | undefined) ?? PLAIN;

export function dress(p: Phaser.Physics.Arcade.Sprite, look: HeroLook) {
  p.setData('look', look).setData('frame', null).setFlipX(false);
  setHeroBase(p, look.down);
  const body = p.body as Phaser.Physics.Arcade.Body | null;
  body?.setSize(8, 10, false).setOffset((p.width - 8) / 2, p.height - 10);
}

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

export function setHeroBase(p: Phaser.GameObjects.Sprite, key: string) {
  p.setData('base', key);
  p.setTexture(frameKey(p.scene, key, (p.getData('frame') as HeroFrame | null) ?? null));
}

export function animateHero(p: Phaser.GameObjects.Sprite, moving: boolean) {
  const now = p.scene.time.now;
  let frame: HeroFrame | null;
  if (moving) {
    if (!p.getData('walkSince')) p.setData('walkSince', now);
    frame = WALK[Math.floor((now - (p.getData('walkSince') as number)) / WALK_MS) % WALK.length];
  } else {
    p.setData('walkSince', 0);
    frame = null;
  }
  if (frame === ((p.getData('frame') as HeroFrame | null) ?? null)) return;
  p.setData('frame', frame);
  p.setTexture(frameKey(p.scene, (p.getData('base') as string | undefined) ?? p.texture.key, frame));
}
