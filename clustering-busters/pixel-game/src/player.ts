// Hero movement shared by the village, the arena and the treasury.
import Phaser from 'phaser';
import { PLAYER_SPEED } from './game/rules';

export type Keys = Record<string, Phaser.Input.Keyboard.Key>;

export function addKeys(scene: Phaser.Scene): Keys {
  return scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,Q,E,ESC,ENTER,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Keys;
}

/** WASD / arrows. Sets the velocity; returns the direction when moving, else null. */
export function steer(player: Phaser.Physics.Arcade.Sprite, keys: Keys, speedMul = 1): { x: number; y: number } | null {
  const vx = (keys.D.isDown || keys.RIGHT.isDown ? 1 : 0) - (keys.A.isDown || keys.LEFT.isDown ? 1 : 0);
  const vy = (keys.S.isDown || keys.DOWN.isDown ? 1 : 0) - (keys.W.isDown || keys.UP.isDown ? 1 : 0);
  const body = player.body as Phaser.Physics.Arcade.Body;
  if (vx === 0 && vy === 0) { body.setVelocity(0, 0); return null; }
  const len = Math.hypot(vx, vy);
  const dir = { x: vx / len, y: vy / len };
  body.setVelocity(dir.x * PLAYER_SPEED * speedMul, dir.y * PLAYER_SPEED * speedMul);
  if (vx !== 0) player.setFlipX(vx < 0);
  return dir;
}

export const near = (a: { x: number; y: number }, x: number, y: number, r: number) => Phaser.Math.Distance.Between(a.x, a.y, x, y) < r;
