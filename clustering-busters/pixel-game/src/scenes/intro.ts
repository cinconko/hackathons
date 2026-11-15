import Phaser from 'phaser';
import { placeCatapult } from '../catapult';
import { updateSave } from '../save';
import { PLAY, WIDTH } from '../config';
import { sfx } from '../media';
import { INTRO_SCRIPT, SPEAKERS, type Speaker } from '../game/introScript';
import { CutsceneScene, DOOR, GROUND, type CutsceneEnd, type CutsceneLine, type Shot } from './cutscene';

// The opening, "The night the hill shook": the treasury under the hill, Mossback's raid, the key,
// the village sending you, Sergeant Brann stopping you at the catapult. Then the title card and
// the village, where Brann's training starts. The words are in src/game/introScript.ts; this file
// builds the pictures, one per shot, in the same order. Plays once; the menu has "C: story".

type Obj = Phaser.GameObjects.GameObject;
type Img = Phaser.GameObjects.Image;

export class IntroScene extends CutsceneScene {
  protected readonly music = 'intro' as const;
  /** Who is on screen in this shot, so their lines can make them hop. */
  cast: Partial<Record<Speaker, Img>> = {};

  constructor() { super('intro'); }

  protected readonly shots: Shot[] = INTRO_SCRIPT.map((lines, i) => ({
    lines: lines.map((l): CutsceneLine => ({ text: l.text, who: l.who, name: l.who && SPEAKERS[l.who].name, color: l.who && SPEAKERS[l.who].color })),
    build: (s) => { const intro = s as IntroScene; intro.cast = {}; return BUILDS[i](intro); },
  }));

  /** The speaker hops; when everyone says "No.", Tobi slumps. */
  protected onLine(l: CutsceneLine) {
    const hop = (p?: Img) => p && this.tweens.add({ targets: p, y: p.y - 4, yoyo: true, repeat: 1, duration: 110, ease: 'Quad.easeOut' });
    if (l.who === 'all') {
      hop(this.cast.mira); hop(this.cast.grandpa);
      const t = this.cast.tobi;
      if (t) this.tweens.add({ targets: t, angle: -12, y: t.y + 2, duration: 250, ease: 'Quad.easeOut' });
    } else if (l.who) hop(this.cast[l.who as Speaker]);
  }

  /** Three clouds drifting across a day sky. */
  clouds(): Img[] {
    return [[60, 30, 1], [190, 24, 0.8], [270, 44, 0.6]].map(([x, y, a]) => {
      const c = this.add.image(PLAY.x + x, PLAY.y + y, 'cloud').setAlpha(a).setDepth(1);
      this.tweens.add({ targets: c, x: c.x + 14, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return c;
    });
  }

  protected end(): CutsceneEnd {
    updateSave((s) => ({ ...s, seenIntro: true }));
    return { title: 'RINGFALL', size: 32, sub: 'Chapter 1: the village', next: 'village', data: { fromIntro: true } };
  }
}

/** One picture per shot of INTRO_SCRIPT. */
const BUILDS: ((s: IntroScene) => Obj[])[] = [
  // 1 night: the treasury glows; Tobi tiptoes up the path to peek in
  (s) => {
    const items = s.nightVillage(true);
    const kid = s.add.image(PLAY.x + 160, GROUND + 4, 'kid').setOrigin(0.5, 1).setFlipX(true).setDepth(12);
    s.tweens.add({ targets: kid, x: DOOR.x + 16, duration: 2600, ease: 'Sine.easeOut' });
    s.tweens.add({ targets: kid, y: '-=1', yoyo: true, repeat: 12, duration: 100 });
    s.cast = { tobi: kid };
    return [...items, kid];
  },

  // 2 the hill shakes: the light goes out, the village runs, Tobi dives behind the berry bush
  (s) => {
    const items = s.nightVillage(false);
    const rumble = () => { s.cameras.main.shake(450, 0.014); sfx(s, 'stage'); };
    rumble();
    s.time.delayedCall(1100, rumble);
    for (const [key, x, delay] of [['villager_a', 200, 0], ['villager_b', 250, 150], ['villager_a', 175, 300]] as const) {
      const v = s.add.image(PLAY.x + x, GROUND + 8, key).setOrigin(0.5, 1).setDepth(12);
      s.tweens.add({ targets: v, x: WIDTH + 20, duration: 1500, delay: 300 + delay, ease: 'Quad.easeIn' });
      s.tweens.add({ targets: v, y: '-=2', yoyo: true, repeat: -1, duration: 90 });
      items.push(v);
    }
    const kid = s.add.image(DOOR.x + 16, GROUND + 4, 'kid').setOrigin(0.5, 1).setDepth(13);   // the bush is at depth 14
    s.tweens.add({ targets: kid, x: PLAY.x + 128, y: GROUND + 10, duration: 500, delay: 250, ease: 'Quad.easeOut', onComplete: () => kid.setVisible(false) });
    items.push(kid);
    return items;
  },

  // 3 the theft: out of the broken door, the chest over his head, rings spilling behind him
  (s) => {
    const items = s.nightVillage(false);
    const boss = s.add.image(DOOR.x, GROUND - 12, 'boss_3').setScale(1.5).setDepth(35);
    const chest = s.add.image(DOOR.x, GROUND - 46, 'chest').setScale(1.5).setDepth(36);
    s.cameras.main.shake(300, 0.012);
    sfx(s, 'door');
    s.tweens.add({ targets: [boss, chest], x: WIDTH + 40, duration: 3400, delay: 500, ease: 'Sine.easeIn' });
    s.tweens.add({ targets: boss, rotation: { from: -0.1, to: 0.1 }, yoyo: true, repeat: -1, duration: 200, ease: 'Sine.easeInOut' });   // waddling
    s.tweens.add({ targets: [boss, chest], y: '-=3', yoyo: true, repeat: -1, duration: 200 });
    items.push(boss, chest);
    let dropped = 0;
    s.time.addEvent({
      delay: 400, repeat: 8, callback: () => {   // a ring falls out wherever the chest is now
        if (chest.x < DOOR.x + 30 || chest.x > PLAY.x + PLAY.width - 10 || dropped >= 4) return;
        const r = s.add.image(chest.x, chest.y + 8, 'ring_classic').setDepth(34);
        s.tweens.add({ targets: r, y: GROUND + 6 + (dropped % 2) * 3, duration: 500, ease: 'Bounce.easeOut' });
        sfx(s, 'ring', 0.3);
        dropped++;
        items.push(r);   // the same array the shot returned, so the next shot clears it
      },
    });
    return items;
  },

  // 4 the lair: he grows to fill the screen, the key glints, then a growl
  (s) => {
    const wall = s.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'path_brick').setOrigin(0).setDepth(1);
    const floor = s.add.tileSprite(PLAY.x, PLAY.y + 118, PLAY.width, PLAY.height - 118, 'path_cobble').setOrigin(0).setDepth(2);
    const dark = s.add.rectangle(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 0x07040c, 0.72).setOrigin(0).setDepth(20);
    const torches = [PLAY.x + 50, PLAY.x + PLAY.width - 50].flatMap((x) => s.torch(x, PLAY.y + 66));
    const boss = s.add.image(WIDTH / 2, PLAY.y + 74, 'boss_1').setScale(4).setDepth(30);
    s.tweens.add({ targets: boss, scale: 4.6, duration: 2600, ease: 'Sine.easeInOut' });
    const glint = s.add.image(WIDTH / 2 + 2, PLAY.y + 68, 'sparkle').setScale(2).setDepth(31).setAlpha(0);
    s.tweens.add({ targets: glint, alpha: 1, scale: 3, yoyo: true, repeat: -1, duration: 500, delay: 600 });
    s.time.delayedCall(2700, () => { s.cameras.main.shake(350, 0.008); sfx(s, 'stage'); });
    return [wall, floor, dark, ...torches, boss, glint];
  },

  // 5 the square, next morning: Mira, Grandpa, you and Tobi
  (s) => {
    const ground = GROUND - 14;
    const items: Obj[] = [s.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'sky').setOrigin(0).setDepth(0)];
    items.push(...s.clouds(), ...s.treeLine(ground, 3), ...s.grass(ground, 4));
    items.push(s.add.tileSprite(PLAY.x, ground + 18, PLAY.width, 9, 'path_dirt').setOrigin(0).setDepth(5));
    items.push(...s.props([
      ['hut', 30, ground + 10, 8], ['house', 70, ground + 10, 8], ['house_big', 250, ground + 12, 8], ['hut', 292, ground + 10, 8, true],
      ['tree_apple', 140, ground + 8, 7], ['bush_big_berry', 220, ground + 14, 9],
    ]));
    const feet = ground + 28;
    const stand = (key: string, x: number, flip = false) => s.add.image(PLAY.x + x, feet, key).setOrigin(0.5, 1).setScale(2).setFlipX(flip).setDepth(20);
    const mira = stand('elder', 110), grandpa = stand('grandpa', 136), hero = stand('player', 168), tobi = stand('kid', 196, true);
    for (const p of [mira, grandpa]) s.tweens.add({ targets: p, scaleY: 2.06, yoyo: true, repeat: -1, duration: 900 + p.x });   // breathing
    s.cast = { mira, grandpa, tobi };
    items.push(mira, grandpa, hero, tobi);
    return items;
  },

  // 6 the catapult: you walk up to it, the arm creaks; Brann catches up with you
  (s) => {
    const ground = GROUND - 14;
    const sky = s.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'sky').setOrigin(0).setDepth(0);
    // his mountain far away, with the dark mouth of the lair
    const m = s.add.graphics().setDepth(2);
    m.fillStyle(0x5a5068).fillTriangle(WIDTH - 110, ground, WIDTH - 50, PLAY.y + 44, WIDTH + 14, ground);
    m.fillStyle(0x6e6480).fillTriangle(WIDTH - 50, PLAY.y + 44, WIDTH - 62, PLAY.y + 62, WIDTH - 40, PLAY.y + 60);
    m.fillStyle(0x140c1c).fillEllipse(WIDTH - 54, ground - 26, 14, 12).fillRect(WIDTH - 61, ground - 26, 14, 6);   // the cave, above the trees
    m.fillStyle(0xd83a3a).fillRect(WIDTH - 57, ground - 25, 1, 1).fillRect(WIDTH - 52, ground - 25, 1, 1);           // something looking out
    const items: Obj[] = [sky, ...s.clouds(), m, ...s.treeLine(ground, 3), ...s.grass(ground, 4)];
    items.push(s.add.tileSprite(PLAY.x, ground + 14, 190, 9, 'path_dirt').setOrigin(0).setDepth(5));    // the path to the catapult
    const cat = placeCatapult(s, WIDTH / 2 + 40, ground - 10, Math.PI * 0.92, 2, 10);   // its wheels on the path
    const { arm } = cat;
    const hero = s.add.image(PLAY.x + 40, ground + 10, 'player').setScale(2).setDepth(12);
    s.tweens.add({ targets: hero, x: WIDTH / 2 - 22, duration: 1400, ease: 'Sine.easeOut' });
    s.tweens.add({ targets: arm, rotation: Math.PI * 0.88, duration: 300, delay: 1500, yoyo: true, ease: 'Sine.easeInOut' });   // creak
    const brann = s.add.image(PLAY.x - 16, ground + 10, 'sergeant').setScale(2).setDepth(13);
    s.tweens.add({ targets: brann, x: WIDTH / 2 - 44, duration: 1100, delay: 700, ease: 'Sine.easeOut' });
    s.cast = { brann };
    items.push(cat.base, cat.rope, cat.winch, arm, cat.pin, hero, brann, ...s.props([
      ['tree_apple', 26, 142, 14], ['bush_big_berry', 108, 144, 14], ['bush_mid', 238, 146, 14], ['tree', 300, 140, 14],
    ]));
    return items;
  },
];
