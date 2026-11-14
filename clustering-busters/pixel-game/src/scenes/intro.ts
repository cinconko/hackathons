import Phaser from 'phaser';
import { playMusic } from '../media';
import { HEIGHT, PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { updateSave } from '../save';
import { FONT } from '../ui';

// Opening cutscene: four shots with typed captions, inside cinematic letterbox bars.
// Enter / Space / click: finish the line, then next shot. Esc: skip.
// The hand-off to the game is deliberately loud: the bars slide away, a title card, then a
// fade to black and the village fades in (the village scene does the fade-in).

const BAR_TOP = 18;
const BAR_BOTTOM = 30;
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
      build: (s) => [...s.nightVillage(true)],
    },
    {
      caption: 'Then Mossback came. He carried the treasury off to his lair and hid it in a locked room.',
      build: (s) => {
        const items = s.nightVillage(false);
        const boss = s.add.image(WIDTH + 20, PLAY.y + 104, 'boss_3').setScale(2).setDepth(20);
        s.tweens.add({ targets: boss, x: WIDTH / 2 + 50, duration: 1200, ease: 'Quad.easeOut', onComplete: () => s.cameras.main.shake(400, 0.02) });
        s.tweens.add({ targets: boss, y: '-=4', yoyo: true, repeat: -1, duration: 220 });
        return [...items, boss];
      },
    },
    {
      caption: 'The only key hangs around his neck.',
      build: (s) => {
        const bg = s.add.rectangle(WIDTH / 2, HEIGHT / 2, PLAY.width, PLAY.height, 0x140c1c).setDepth(1);
        const boss = s.add.image(WIDTH / 2, PLAY.y + 74, 'boss_1').setScale(4).setDepth(20);
        s.tweens.add({ targets: boss, scale: 4.6, duration: 2600, ease: 'Sine.easeInOut' });
        const glint = s.add.image(WIDTH / 2 - 4, PLAY.y + 112, 'sparkle').setScale(2).setDepth(21).setAlpha(0);
        s.tweens.add({ targets: glint, alpha: 1, scale: 3, yoyo: true, repeat: -1, duration: 500, delay: 600 });
        return [bg, boss, glint];
      },
    },
    {
      caption: 'Nobody can walk into his lair. But the old catapult can throw you right in. Get the key. Bring the rings home.',
      build: (s) => {
        const g = s.add.graphics().setDepth(1);
        g.fillStyle(0x87c4ff).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
        g.fillStyle(0xbfe3ff).fillRect(PLAY.x, PLAY.y + 60, PLAY.width, 20);
        g.fillStyle(0x3f8a3a).fillRect(PLAY.x, PLAY.y + 100, PLAY.width, PLAY.height - 100);
        g.fillStyle(0x2f6b2f).fillRect(PLAY.x, PLAY.y + 100, PLAY.width, 3);
        g.fillStyle(0x5a6a4a).fillTriangle(WIDTH - 90, PLAY.y + 100, WIDTH - 40, PLAY.y + 40, WIDTH + 10, PLAY.y + 100); // the lair's mountain
        const base = s.add.image(WIDTH / 2 + 20, PLAY.y + 96, 'catapult_base').setScale(2).setDepth(10);
        const arm = s.add.image(WIDTH / 2 + 20, PLAY.y + 82, 'catapult_arm').setOrigin(0, 0.5).setScale(2).setRotation(Math.PI * 0.92).setDepth(11);
        const hero = s.add.image(WIDTH / 2 - 50, PLAY.y + 92, 'player').setScale(2).setDepth(12);
        s.tweens.add({ targets: hero, x: WIDTH / 2 - 22, duration: 1400, ease: 'Sine.easeOut' });
        return [g, base, arm, hero];
      },
    },
  ];

  /** Night village with the treasury glowing in the hill (or dark, after the raid). */
  nightVillage(treasuryFull: boolean): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x0e1430).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    g.fillStyle(0x1a2350).fillRect(PLAY.x, PLAY.y + 50, PLAY.width, 40);
    for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, i % 3 ? 0.5 : 1).fillRect(PLAY.x + ((i * 37) % PLAY.width), PLAY.y + 20 + ((i * 23) % 40), 1, 1);
    g.fillStyle(0xf2f2d0).fillCircle(PLAY.x + 40, PLAY.y + 34, 7);                                  // moon
    g.fillStyle(0x24402a).fillEllipse(WIDTH / 2 - 60, PLAY.y + 116, 170, 70);                      // the hill
    g.fillStyle(0x1c3322).fillRect(PLAY.x, PLAY.y + 110, PLAY.width, PLAY.height - 110);
    const items: Phaser.GameObjects.GameObject[] = [g];
    const door = this.add.rectangle(WIDTH / 2 - 60, PLAY.y + 98, 14, 14, treasuryFull ? 0xffcc44 : 0x111111).setDepth(2);
    items.push(door);
    if (treasuryFull) {
      for (let i = 0; i < 4; i++) {
        const sp = this.add.image(WIDTH / 2 - 66 + i * 4, PLAY.y + 94 + (i % 2) * 6, 'sparkle').setDepth(3);
        this.tweens.add({ targets: sp, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 + i * 90 });
        items.push(sp);
      }
    }
    for (const [x, flip] of [[WIDTH / 2 + 10, false], [WIDTH / 2 + 50, true], [WIDTH / 2 + 90, false]] as const) {
      items.push(this.add.image(x, PLAY.y + 100, 'house').setFlipX(flip).setDepth(4));
    }
    // night: a blue overlay instead of setTint (the Canvas renderer ignores tints)
    items.push(this.add.rectangle(WIDTH / 2 + 50, PLAY.y + 100, 130, 30, 0x0e1430, 0.55).setDepth(5));
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
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 6, 'RINGFALL', { fontFamily: 'monospace', fontSize: '24px', color: '#ffcc44' }).setOrigin(0.5).setDepth(951).setAlpha(0).setScale(0.6);
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
