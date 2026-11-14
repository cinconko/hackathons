import Phaser from 'phaser';
import { playMusic } from '../media';
import { HEIGHT, PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { updateSave } from '../save';
import { FONT, TITLE_FONT } from '../ui';

// Opening cutscene: four shots with typed captions, inside cinematic letterbox bars.
// Enter / Space / click: finish the line, then next shot. Esc: skip.
// The hand-off to the game is deliberately loud: the bars slide away, a title card, then a
// fade to black and the village fades in (the village scene does the fade-in).

const BAR_TOP = 18;
const BAR_BOTTOM = 30;
const GROUND = PLAY.y + 112;                        // where the fields start (game pixels)
const DOOR = { x: PLAY.x + 96, y: PLAY.y + 98 };    // the treasury door in the hill
const TYPE_MS = 28;

interface Shot { caption: string; build: (s: IntroScene) => Phaser.GameObjects.GameObject[] }

export class IntroScene extends Phaser.Scene {
  private shot = -1;
  private actors: Phaser.GameObjects.GameObject[] = [];
  private caption!: Phaser.GameObjects.Text;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private busy = false;
  private ending = false;
  private bars!: { top: Phaser.GameObjects.Rectangle; bottom: Phaser.GameObjects.Rectangle; hint: Phaser.GameObjects.Text };

  constructor() { super('intro'); }

  create() {
    this.shot = -1;
    this.actors = [];
    this.busy = false;
    this.ending = false;
    this.cameras.main.setBackgroundColor('#000000');

    const top = this.add.rectangle(PLAY.x, PLAY.y, PLAY.width, BAR_TOP, 0x000000).setOrigin(0).setDepth(900);
    const bottom = this.add.rectangle(PLAY.x, PLAY.y + PLAY.height - BAR_BOTTOM, PLAY.width, BAR_BOTTOM, 0x000000).setOrigin(0).setDepth(900);
    const hint = this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 5, 'Enter: next   Esc: skip', { ...FONT, color: '#555555' }).setOrigin(1, 0).setDepth(901);
    this.bars = { top, bottom, hint };
    this.caption = this.add.text(PLAY.x + 10, PLAY.y + PLAY.height - BAR_BOTTOM + 5, '', { ...FONT, color: '#eeeeee', wordWrap: { width: PLAY.width - 20 } }).setDepth(901);
    drawFrame(this);

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => this.advance());
    kb.on('keydown-SPACE', () => this.advance());
    kb.on('keydown-ESC', () => this.finish());
    this.input.on('pointerdown', () => this.advance());

    this.cameras.main.fadeIn(600);
    this.next();
    playMusic(this, 'intro');
  }

  private readonly shots: Shot[] = [
    {
      caption: 'Ringfall village kept every ring it ever found in a treasury under the hill.',
      build: (s) => s.nightVillage(true),
    },
    {
      caption: 'Then Mossback came. He carried the treasury off to his lair and hid it in a locked room.',
      build: (s) => {
        const items = s.nightVillage(false);
        // out of the broken door, the chest over his head, off to his lair
        const boss = s.add.image(DOOR.x, GROUND - 12, 'boss_3').setScale(1.5).setDepth(35);
        const chest = s.add.image(DOOR.x, GROUND - 46, 'chest').setScale(1.5).setDepth(36);
        s.cameras.main.shake(300, 0.012);
        s.tweens.add({ targets: [boss, chest], x: WIDTH + 40, duration: 3400, delay: 500, ease: 'Sine.easeIn' });
        s.tweens.add({ targets: boss, rotation: { from: -0.1, to: 0.1 }, yoyo: true, repeat: -1, duration: 200, ease: 'Sine.easeInOut' });   // waddling
        s.tweens.add({ targets: [boss, chest], y: '-=3', yoyo: true, repeat: -1, duration: 200 });
        return [...items, boss, chest];
      },
    },
    {
      caption: 'The only key hangs around his neck.',
      build: (s) => {
        // his lair: a dark brick wall, a cobbled floor, two torches
        const wall = s.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'path_brick').setOrigin(0).setDepth(1);
        const floor = s.add.tileSprite(PLAY.x, PLAY.y + 118, PLAY.width, PLAY.height - 118, 'path_cobble').setOrigin(0).setDepth(2);
        const dark = s.add.rectangle(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 0x07040c, 0.72).setOrigin(0).setDepth(20);
        const torches = [PLAY.x + 50, PLAY.x + PLAY.width - 50].flatMap((x) => s.torch(x, PLAY.y + 66));
        const boss = s.add.image(WIDTH / 2, PLAY.y + 74, 'boss_1').setScale(4).setDepth(30);
        s.tweens.add({ targets: boss, scale: 4.6, duration: 2600, ease: 'Sine.easeInOut' });
        const glint = s.add.image(WIDTH / 2 + 2, PLAY.y + 68, 'sparkle').setScale(2).setDepth(31).setAlpha(0);
        s.tweens.add({ targets: glint, alpha: 1, scale: 3, yoyo: true, repeat: -1, duration: 500, delay: 600 });
        return [wall, floor, dark, ...torches, boss, glint];
      },
    },
    {
      caption: 'No road leads into his lair. The old catapult can throw you in. Get the key, bring the rings home.',
      build: (s) => {
        const ground = GROUND - 14;
        const sky = s.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'sky').setOrigin(0).setDepth(0);
        const clouds = [[60, 30, 1], [190, 24, 0.8], [270, 44, 0.6]].map(([x, y, a]) => {
          const c = s.add.image(PLAY.x + x, PLAY.y + y, 'cloud').setAlpha(a).setDepth(1);
          s.tweens.add({ targets: c, x: c.x + 14, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });  // drifting
          return c;
        });
        // his mountain far away, with the dark mouth of the lair
        const m = s.add.graphics().setDepth(2);
        m.fillStyle(0x5a5068).fillTriangle(WIDTH - 110, ground, WIDTH - 50, PLAY.y + 44, WIDTH + 14, ground);
        m.fillStyle(0x6e6480).fillTriangle(WIDTH - 50, PLAY.y + 44, WIDTH - 62, PLAY.y + 62, WIDTH - 40, PLAY.y + 60);
        m.fillStyle(0x140c1c).fillEllipse(WIDTH - 54, ground - 26, 14, 12).fillRect(WIDTH - 61, ground - 26, 14, 6);   // the cave, above the trees
        m.fillStyle(0xd83a3a).fillRect(WIDTH - 57, ground - 25, 1, 1).fillRect(WIDTH - 52, ground - 25, 1, 1);           // something looking out
        const items = [sky, ...clouds, m, ...s.treeLine(ground, 3), ...s.grass(ground, 4)];
        items.push(s.add.tileSprite(PLAY.x, ground + 14, 190, 9, 'path_dirt').setOrigin(0).setDepth(5));    // the path to the catapult
        const base = s.add.image(WIDTH / 2 + 20, ground + 14, 'catapult_base').setScale(2).setDepth(10);
        const arm = s.add.image(WIDTH / 2 + 20, ground, 'catapult_arm').setOrigin(0, 0.5).setScale(2).setRotation(Math.PI * 0.92).setDepth(11);
        const hero = s.add.image(PLAY.x + 40, ground + 10, 'player').setScale(2).setDepth(12);
        s.tweens.add({ targets: hero, x: WIDTH / 2 - 22, duration: 1400, ease: 'Sine.easeOut' });
        items.push(base, arm, hero, ...s.props([
          ['tree_apple', 26, 142, 14], ['bush_big_berry', 108, 144, 14], ['bush_mid', 238, 146, 14], ['tree', 300, 140, 14],
        ]));
        return items;
      },
    },
  ];

  /** Images standing on the ground: [key, x, y of their feet, depth, flipped?]. */
  props(list: [string, number, number, number, boolean?][]): Phaser.GameObjects.Image[] {
    return list.map(([key, x, y, depth, flip]) => this.add.image(PLAY.x + x, y, key).setOrigin(0.5, 1).setFlipX(!!flip).setDepth(depth));
  }

  /** The team's grass from `top` down to the caption bar. */
  grass(top: number, depth: number): Phaser.GameObjects.TileSprite[] {
    return [this.add.tileSprite(PLAY.x, top, PLAY.width, PLAY.y + PLAY.height - top, 'grass').setOrigin(0).setDepth(depth)];
  }

  /** A row of trees along the horizon. */
  treeLine(feet: number, depth: number): Phaser.GameObjects.Image[] {
    const out: Phaser.GameObjects.Image[] = [];
    for (let x = 0; x < PLAY.width + 10; x += 15) out.push(this.add.image(PLAY.x + x, feet + (x % 2 ? 1 : 0), x % 45 ? 'tree' : 'tree_apple').setOrigin(0.5, 1).setScale(0.8).setDepth(depth));
    return out;
  }

  /** A soft round light: a few see-through rings, breathing. */
  glow(x: number, y: number, r: number, color: number, depth: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics({ x, y }).setDepth(depth);
    for (let i = 4; i >= 1; i--) g.fillStyle(color, 0.07).fillCircle(0, 0, (r * i) / 4);
    this.tweens.add({ targets: g, scale: 1.08, alpha: 0.8, yoyo: true, repeat: -1, duration: 260 + r * 6, ease: 'Sine.easeInOut' });
    return g;
  }

  /** A torch on the lair wall: the lantern, a flickering flame and its light. */
  torch(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const t = this.add.image(x, y, 'lantern').setScale(2).setDepth(25);
    return [t, this.glow(x, y - 6, 26, 0xffaa44, 24)];
  }

  /**
   * The village at night, built from the team's art: grass on the hill and the fields, a dirt path
   * to the treasury door in the hill (glowing gold while it is full), the village's houses, trees
   * and bushes, a campfire. Night is a dark sheet over everything (the Canvas renderer ignores
   * tints); the lights (moon, stars, fire, door, lantern) sit above it and shine.
   */
  nightVillage(treasuryFull: boolean): Phaser.GameObjects.GameObject[] {
    const items: Phaser.GameObjects.GameObject[] = [];
    const sky = this.add.graphics().setDepth(0);
    [0x0b1030, 0x121a42, 0x1a2350, 0x243060].forEach((c, i) => sky.fillStyle(c).fillRect(PLAY.x, PLAY.y + i * 24, PLAY.width, 24));
    const stars = this.add.graphics().setDepth(32);
    for (let i = 0; i < 40; i++) stars.fillStyle(0xffffff, i % 3 ? 0.5 : 1).fillRect(PLAY.x + ((i * 37) % PLAY.width), PLAY.y + 22 + ((i * 23) % 44), 1, 1);
    stars.fillStyle(0xf2f2d0).fillCircle(PLAY.x + 40, PLAY.y + 38, 7);                               // moon
    items.push(sky, stars, this.glow(PLAY.x + 40, PLAY.y + 38, 20, 0xf2f2d0, 31));
    items.push(...this.treeLine(GROUND - 22, 3));
    // the hill: the team's grass, cut to a round shape
    const hillShape = this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0xffffff).fillEllipse(DOOR.x, GROUND + 6, 180, 74);
    const hill = this.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'grass').setOrigin(0).setDepth(4).setMask(hillShape.createGeometryMask());
    items.push(hillShape, hill, ...this.grass(GROUND, 5));
    items.push(this.add.tileSprite(DOOR.x - 5, DOOR.y + 6, 10, GROUND - DOOR.y + 4, 'path_dirt').setOrigin(0).setDepth(6));   // from the door...
    items.push(this.add.tileSprite(DOOR.x - 5, GROUND + 2, PLAY.x + PLAY.width - DOOR.x + 5, 9, 'path_dirt').setOrigin(0).setDepth(6)); // ...through the village
    // the treasury door: a stone arch in the hill
    const door = this.add.graphics().setDepth(7);
    door.fillStyle(0x6a6a74).fillRect(DOOR.x - 10, DOOR.y - 8, 20, 16).fillCircle(DOOR.x, DOOR.y - 8, 10);
    door.fillStyle(treasuryFull ? 0xffcc44 : 0x0a0a0e).fillRect(DOOR.x - 6, DOOR.y - 6, 12, 14).fillCircle(DOOR.x, DOOR.y - 6, 6);
    items.push(door);
    if (treasuryFull) {
      const light = this.add.graphics().setDepth(33);                                                 // the gold shines through the night
      light.fillStyle(0xffcc44).fillRect(DOOR.x - 6, DOOR.y - 6, 12, 14).fillCircle(DOOR.x, DOOR.y - 6, 6);
      items.push(light, this.glow(DOOR.x, DOOR.y - 2, 26, 0xffcc44, 31));
      for (let i = 0; i < 4; i++) {
        const sp = this.add.image(DOOR.x - 6 + i * 4, DOOR.y - 4 + (i % 2) * 6, 'sparkle').setDepth(34);
        this.tweens.add({ targets: sp, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 + i * 90 });
        items.push(sp);
      }
    }
    // the village: its own houses, trees and bushes
    items.push(...this.props([
      ['hut', 172, GROUND + 4, 10], ['house', 206, GROUND + 4, 10], ['house_big', 246, GROUND + 6, 10], ['hut', 286, GROUND + 4, 10, true],
      ['tree_apple', 150, 142, 14], ['bush_big_berry', 128, 145, 14], ['bush_mid', 196, 146, 14], ['tree', 304, 142, 14],
    ]));
    const lantern = this.add.image(PLAY.x + 228, GROUND + 12, 'lantern').setOrigin(0.5, 1).setDepth(33);
    const fire = this.add.sprite(PLAY.x + 222, 142, 'campfire_stone_0').setOrigin(0.5, 1).setDepth(33).play('campfire_stone');
    items.push(lantern, this.glow(PLAY.x + 228, GROUND + 2, 12, 0xffdd88, 31), fire, this.glow(PLAY.x + 222, 134, 28, 0xff8a2a, 31));
    items.push(this.add.rectangle(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 0x0a1238, 0.55).setOrigin(0).setDepth(30));   // night
    return items;
  }

  private next() {
    if (this.ending) return;
    if (this.shot + 1 >= this.shots.length) { this.finish(); return; }
    this.busy = true;
    const show = () => {
      this.actors.forEach((a) => a.destroy());
      this.shot++;
      const s = this.shots[this.shot];
      this.actors = s.build(this);
      this.type(s.caption);
      this.cameras.main.fadeIn(300);
      this.busy = false;
    };
    if (this.shot < 0) show();
    else { this.cameras.main.fadeOut(300); this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, show); }
  }

  private type(text: string) {
    this.typing?.remove();
    this.fullText = text;
    this.caption.setText('');
    let i = 0;
    this.typing = this.time.addEvent({
      delay: TYPE_MS, repeat: text.length - 1,
      callback: () => { i++; this.caption.setText(text.slice(0, i)); if (i >= text.length) this.typing = null; },
    });
  }

  private advance() {
    if (this.busy || this.ending) return;
    if (this.typing) { this.typing.remove(); this.typing = null; this.caption.setText(this.fullText); return; }
    this.next();
  }

  /** The hand-off: bars slide out, title card, fade to black, village. */
  private finish() {
    if (this.ending) return;
    this.ending = true;
    this.typing?.remove();
    this.caption.setText('');
    this.bars.hint.setVisible(false);
    updateSave((s) => ({ ...s, seenIntro: true }));
    this.tweens.add({ targets: this.bars.top, y: PLAY.y - BAR_TOP, duration: 500, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.bars.bottom, y: PLAY.y + PLAY.height, duration: 500, ease: 'Quad.easeIn' });
    const card = this.add.rectangle(WIDTH / 2, HEIGHT / 2, PLAY.width, PLAY.height, 0x000000).setDepth(950).setAlpha(0);
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 8, 'RINGFALL', { fontFamily: TITLE_FONT, fontSize: '32px', color: '#ffcc44' }).setOrigin(0.5).setDepth(951).setAlpha(0).setScale(0.6);
    const sub = this.add.text(WIDTH / 2, HEIGHT / 2 + 14, 'Chapter 1: the village', { ...FONT, color: '#cccccc' }).setOrigin(0.5).setDepth(951).setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 500, delay: 300 });
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 600, delay: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 1000 });
    this.time.delayedCall(2600, () => {
      this.cameras.main.fadeOut(600);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('village', { fromIntro: true }));
    });
  }
}
