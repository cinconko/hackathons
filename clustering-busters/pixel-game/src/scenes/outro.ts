import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { formatTime } from '../game/rules';
import { CutsceneScene, GROUND, type CutsceneEnd, type Shot } from './cutscene';

// The ending, after your first recovered treasury: Mossback beaten in his lair, the rings carried
// home, the feast under fireworks, and a last look at his mountain. Then THE END, your time, and
// back to the village (the game goes on). Skippable like the opening (Esc).
export interface OutroData { timeMs?: number }

const FIREWORK_COLORS = [0xffcc44, 0xff5fa0, 0x6ad0ff, 0x8aff6a, 0xffffff];

export class OutroScene extends CutsceneScene {
  protected readonly music = 'victory' as const;
  private timeMs = 0;

  constructor() { super('outro'); }

  init(data: OutroData) { this.timeMs = data.timeMs ?? 0; }

  protected readonly shots: Shot[] = [
    {
      caption: 'Mossback lay still. The key was ours, and the locked room stood open.',
      build: (s) => {
        const o = s as OutroScene;
        // his lair, as in the opening: brick wall, cobbled floor, torches
        const wall = o.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'path_brick').setOrigin(0).setDepth(1);
        const floor = o.add.tileSprite(PLAY.x, PLAY.y + 112, PLAY.width, PLAY.height - 112, 'path_cobble').setOrigin(0).setDepth(2);
        const dark = o.add.rectangle(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 0x07040c, 0.66).setOrigin(0).setDepth(20);
        const torches = [PLAY.x + 40, PLAY.x + PLAY.width - 40].flatMap((x) => o.torch(x, PLAY.y + 60));
        // the open door of the treasury room, gold light spilling out
        const door = o.add.graphics().setDepth(21);
        door.fillStyle(0x3a3a44).fillRect(WIDTH / 2 - 16, PLAY.y + 66, 32, 46).fillStyle(0xffcc44).fillRect(WIDTH / 2 - 12, PLAY.y + 72, 24, 40);
        const doorGlow = o.glow(WIDTH / 2, PLAY.y + 96, 30, 0xffcc44, 22);
        // Mossback on his back, stars circling his head
        const boss = o.add.image(WIDTH / 2 + 74, PLAY.y + 122, 'boss_nokey').setScale(1.6).setRotation(-Math.PI / 2).setDepth(24);
        const stars = [0, 1, 2].map(() => o.add.image(0, 0, 'sparkle').setDepth(25));
        const spin = { a: 0 };
        o.tweens.add({
          targets: spin, a: Math.PI * 2, duration: 1600, repeat: -1,
          onUpdate: () => stars.forEach((st, i) => {
            const a = spin.a + (i * Math.PI * 2) / 3;
            st.setPosition(boss.x - 30 + Math.cos(a) * 9, boss.y - 18 + Math.sin(a) * 3);
          }),
        });
        // the hero, the key held high
        const hero = o.add.image(WIDTH / 2 - 54, PLAY.y + 116, 'player').setScale(2).setDepth(24);
        const key = o.add.image(hero.x + 4, hero.y - 22, 'key').setScale(2).setDepth(25);
        o.tweens.add({ targets: key, y: key.y - 3, yoyo: true, repeat: -1, duration: 400 });
        const glint = o.add.image(key.x - 6, key.y - 3, 'sparkle').setDepth(26);
        o.tweens.add({ targets: glint, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 });
        return [wall, floor, dark, ...torches, door, doorGlow, boss, ...stars, hero, key, glint];
      },
    },
    {
      caption: 'Chest by chest, we carried every ring back home.',
      build: (s) => {
        const o = s as OutroScene;
        const ground = GROUND - 14;
        const sky = o.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'sky').setOrigin(0).setDepth(0);
        const clouds = [[50, 30, 1], [170, 22, 0.8], [260, 40, 0.6]].map(([x, y, a]) => {
          const c = o.add.image(PLAY.x + x, PLAY.y + y, 'cloud').setAlpha(a).setDepth(1);
          o.tweens.add({ targets: c, x: c.x - 14, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          return c;
        });
        // his mountain behind us, on the left now: we are walking away from it
        const m = o.add.graphics().setDepth(2);
        m.fillStyle(0x5a5068).fillTriangle(PLAY.x - 20, ground, PLAY.x + 40, PLAY.y + 50, PLAY.x + 104, ground);
        m.fillStyle(0x140c1c).fillEllipse(PLAY.x + 42, ground - 24, 12, 10);
        const items: Phaser.GameObjects.GameObject[] = [sky, ...clouds, m, ...o.treeLine(ground, 3), ...o.grass(ground, 4)];   // all removed with the shot
        items.push(o.add.tileSprite(PLAY.x, ground + 14, PLAY.width, 9, 'path_dirt').setOrigin(0).setDepth(5));
        // the hero, a chest over his head, rings glinting behind him
        const hero = o.add.image(PLAY.x + 10, ground + 14, 'player').setScale(2).setDepth(12);
        const chest = o.add.image(hero.x, hero.y - 22, 'chest').setScale(1.5).setDepth(13);
        o.tweens.add({ targets: [hero, chest], x: `+=${PLAY.width - 40}`, duration: 5200, ease: 'Linear' });
        o.tweens.add({ targets: [hero, chest], y: '-=2', yoyo: true, repeat: -1, duration: 180 });
        o.time.addEvent({
          delay: 260, repeat: 18, callback: () => {
            const sp = o.add.image(chest.x - 6 + Math.random() * 12, chest.y + 4, 'sparkle').setDepth(14);
            items.push(sp);                                    // removed with the shot even if it is skipped mid-fade
            o.tweens.add({ targets: sp, y: sp.y + 10, alpha: 0, duration: 700, onComplete: () => sp.destroy() });
          },
        });
        items.push(hero, chest, ...o.props([['tree_apple', 30, 146, 14], ['bush_big_berry', 150, 146, 14], ['tree', 290, 144, 14]]));
        return items;
      },
    },
    {
      caption: 'The treasury under the hill shone again, and Ringfall had a feast.',
      build: (s) => {
        const o = s as OutroScene;
        const items = o.nightVillage(true);
        // everyone around the campfire, jumping for joy (above the night, lit by the fire)
        const folk: [string, number][] = [['villager_a', 184], ['kid', 196], ['player', 208], ['grandpa', 240], ['villager_b', 252], ['elder', 264]];
        folk.forEach(([key, x], i) => {
          const f = o.add.image(PLAY.x + x, 140, key).setOrigin(0.5, 1).setDepth(33).setFlipX(x > 222);
          o.tweens.add({ targets: f, y: f.y - 5, yoyo: true, repeat: -1, duration: 220 + (i % 3) * 40, delay: i * 90, ease: 'Quad.easeOut' });
          items.push(f);
        });
        // fireworks over the village
        o.time.addEvent({ delay: 450, loop: true, callback: () => items.push(o.firework()) });
        return items;
      },
    },
    {
      caption: 'And Mossback? Some say he is still out there, counting the rings he lost.',
      build: (s) => {
        const o = s as OutroScene;
        const sky = o.add.graphics().setDepth(0);
        [0x2a1840, 0x4a2450, 0x8a3a50, 0xd8704a].forEach((c, i) => sky.fillStyle(c).fillRect(PLAY.x, PLAY.y + i * 28, PLAY.width, 28));   // dusk
        const m = o.add.graphics().setDepth(2);
        m.fillStyle(0x1a1224).fillTriangle(WIDTH / 2 - 110, GROUND, WIDTH / 2, PLAY.y + 36, WIDTH / 2 + 110, GROUND);
        m.fillStyle(0x07040c).fillEllipse(WIDTH / 2, GROUND - 26, 22, 18).fillRect(WIDTH / 2 - 11, GROUND - 26, 22, 8);
        m.fillStyle(0x0e0a14).fillRect(PLAY.x, GROUND, PLAY.width, PLAY.y + PLAY.height - GROUND);
        // two red eyes, opening and blinking
        const eyes = o.add.graphics().setDepth(3).setAlpha(0);
        eyes.fillStyle(0xff2a2a).fillRect(WIDTH / 2 - 5, GROUND - 26, 2, 1).fillRect(WIDTH / 2 + 3, GROUND - 26, 2, 1);
        o.tweens.add({ targets: eyes, alpha: 1, duration: 900, delay: 1400 });
        o.tweens.add({ targets: eyes, scaleY: 0, yoyo: true, repeat: -1, duration: 80, repeatDelay: 1800, delay: 2600 });
        const trees = o.treeLine(GROUND + 2, 4);
        const shade = o.add.rectangle(PLAY.x, GROUND - 24, PLAY.width, 40, 0x0e0a14, 0.75).setOrigin(0).setDepth(5);   // the trees in shadow
        return [sky, m, eyes, ...trees, shade];
      },
    },
  ];

  /** One firework: a burst of sparks that spread, fall a little and fade. */
  firework(): Phaser.GameObjects.Graphics {
    const x = PLAY.x + 30 + Math.random() * (PLAY.width - 60);
    const y = PLAY.y + 26 + Math.random() * 40;
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const g = this.add.graphics({ x, y }).setDepth(34);
    const t = { r: 0 };
    this.tweens.add({
      targets: t, r: 16, duration: 900, ease: 'Quad.easeOut',
      onUpdate: () => {
        g.clear();
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI * 2) / 12;
          g.fillStyle(color, 1 - t.r / 18).fillRect(Math.round(Math.cos(a) * t.r), Math.round(Math.sin(a) * t.r + t.r * t.r * 0.02), 1, 1);
        }
      },
      onComplete: () => g.destroy(),
    });
    return g;
  }

  protected end(): CutsceneEnd {
    return {
      title: 'THE END', size: 32,
      sub: this.timeMs ? `Treasury recovered in ${formatTime(this.timeMs)}` : 'Treasury recovered',
      lines: ['Thanks for playing Ringfall.', 'The village is yours: keep it growing.'],
      next: 'village', data: { fromRun: true },
    };
  }
}
