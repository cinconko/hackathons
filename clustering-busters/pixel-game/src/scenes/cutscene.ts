import Phaser from 'phaser';
import { playMusic, type MusicKey } from '../media';
import { HEIGHT, PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { FONT, TITLE_FONT } from '../ui';

// A cutscene: shots with typed captions, inside cinematic letterbox bars, then a title card.
// Enter / Space / click: finish the line, then the next line, then the next shot. Esc: skip to the
// title card. A shot has one caption, or several lines; a line can have a speaker, shown as a
// name tag on top of the caption bar (the opening's dialogue).
// The opening (intro.ts) and the ending (outro.ts) are lists of shots on top of this; the scenery
// helpers below build their pictures from the team's art.

export const BAR_TOP = 18;
export const BAR_BOTTOM = 30;
export const GROUND = PLAY.y + 112;                        // where the fields start (game pixels)
export const DOOR = { x: PLAY.x + 96, y: PLAY.y + 98 };    // the treasury door in the hill
const TYPE_MS = 28;

/** One line of a shot. `who` is the subclass's own id for the speaker (onLine gets it back). */
export interface CutsceneLine { text: string; who?: string; name?: string; color?: string }

/**
 * One shot: its picture (build) and its words (one caption, or lines). Anything build starts later
 * (a timer's sprites) goes into the array it returned, so the next shot can clear it away.
 */
export interface Shot { caption?: string; lines?: CutsceneLine[]; build: (s: CutsceneScene) => Phaser.GameObjects.GameObject[] }

/** How a cutscene ends: the title card, and where the game goes next. */
export interface CutsceneEnd { title: string; size: 16 | 32; sub: string; lines?: string[]; next: string; data?: object }

export abstract class CutsceneScene extends Phaser.Scene {
  protected abstract readonly shots: Shot[];
  protected abstract readonly music: MusicKey;
  /** Called once when the shots are over (or skipped): save what needs saving, say where to go. */
  protected abstract end(): CutsceneEnd;

  private shot = -1;
  private line = 0;
  private nameTag!: Phaser.GameObjects.Text;
  private actors: Phaser.GameObjects.GameObject[] = [];
  private caption!: Phaser.GameObjects.Text;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private busy = false;
  private ending = false;
  private bars!: { top: Phaser.GameObjects.Rectangle; bottom: Phaser.GameObjects.Rectangle; hint: Phaser.GameObjects.Text };

  create() {
    this.shot = -1;
    this.line = 0;
    this.actors = [];
    this.busy = false;
    this.ending = false;
    this.cameras.main.setBackgroundColor('#000000');

    const top = this.add.rectangle(PLAY.x, PLAY.y, PLAY.width, BAR_TOP, 0x000000).setOrigin(0).setDepth(900);
    const bottom = this.add.rectangle(PLAY.x, PLAY.y + PLAY.height - BAR_BOTTOM, PLAY.width, BAR_BOTTOM, 0x000000).setOrigin(0).setDepth(900);
    const hint = this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 5, 'Enter: next   Esc: skip', { ...FONT, color: '#555555' }).setOrigin(1, 0).setDepth(901);
    this.bars = { top, bottom, hint };
    this.caption = this.add.text(PLAY.x + 10, PLAY.y + PLAY.height - BAR_BOTTOM + 5, '', { ...FONT, color: '#eeeeee', wordWrap: { width: PLAY.width - 20 } }).setDepth(901);
    this.nameTag = this.add.text(PLAY.x + 8, PLAY.y + PLAY.height - BAR_BOTTOM, '', { ...FONT, backgroundColor: '#000000', padding: { x: 3, y: 2 } })
      .setOrigin(0, 1).setDepth(901).setVisible(false);   // sits on top of the caption bar
    drawFrame(this);

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => this.advance());
    kb.on('keydown-SPACE', () => this.advance());
    kb.on('keydown-ESC', () => this.finish());
    this.input.on('pointerdown', () => this.advance());

    this.cameras.main.fadeIn(600);
    this.next();
    playMusic(this, this.music);
  }

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

  /** Called as each line starts: a subclass animates its speaker. */
  protected onLine(_line: CutsceneLine): void {}

  private linesOf(shot: number): CutsceneLine[] {
    const s = this.shots[shot];
    return s.lines ?? [{ text: s.caption ?? '' }];
  }

  private say() {
    const l = this.linesOf(this.shot)[this.line];
    this.nameTag.setVisible(!!l.name).setText(l.name ?? '').setColor(l.color ?? '#ffcc44');
    this.type(l.text);
    this.onLine(l);
  }

  private next() {
    if (this.ending) return;
    if (this.shot + 1 >= this.shots.length) { this.finish(); return; }
    this.busy = true;
    const show = () => {
      // a shot's timers and tweens end with it (a firework timer must not follow into the next shot)
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.actors.forEach((a) => a.destroy());
      this.shot++;
      const s = this.shots[this.shot];
      this.actors = s.build(this);
      this.line = 0;
      this.say();
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
    if (this.busy || this.ending || this.shot < 0) return;   // no shot on screen yet (or any more)
    if (this.typing) { this.typing.remove(); this.typing = null; this.caption.setText(this.fullText); return; }
    if (this.line + 1 < this.linesOf(this.shot).length) { this.line++; this.say(); return; }
    this.next();
  }

  /** The hand-off: bars slide out, the title card, a fade to black, the next scene. */
  private finish() {
    if (this.ending) return;
    this.ending = true;
    this.typing?.remove();
    this.caption.setText('');
    this.nameTag.setVisible(false);
    this.bars.hint.setVisible(false);
    const e = this.end();
    this.tweens.add({ targets: this.bars.top, y: PLAY.y - BAR_TOP, duration: 500, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.bars.bottom, y: PLAY.y + PLAY.height, duration: 500, ease: 'Quad.easeIn' });
    const card = this.add.rectangle(WIDTH / 2, HEIGHT / 2, PLAY.width, PLAY.height, 0x000000).setDepth(950).setAlpha(0);
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 8, e.title, { fontFamily: TITLE_FONT, fontSize: `${e.size}px`, color: '#ffcc44' }).setOrigin(0.5).setDepth(951).setAlpha(0).setScale(0.6);
    const sub = this.add.text(WIDTH / 2, HEIGHT / 2 + 14, e.sub, { ...FONT, color: '#cccccc' }).setOrigin(0.5).setDepth(951).setAlpha(0);
    const lines = (e.lines ?? []).map((l, i) => this.add.text(WIDTH / 2, HEIGHT / 2 + 28 + i * 10, l, { ...FONT, color: '#888888' }).setOrigin(0.5).setDepth(951).setAlpha(0));
    this.tweens.add({ targets: card, alpha: 1, duration: 500, delay: 300 });
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 600, delay: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 1000 });
    lines.forEach((l, i) => this.tweens.add({ targets: l, alpha: 1, duration: 400, delay: 1400 + i * 300 }));
    this.time.delayedCall(2600 + lines.length * 700, () => {
      this.cameras.main.fadeOut(600);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(e.next, e.data ?? {}));
    });
  }
}
