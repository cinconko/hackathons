import Phaser from 'phaser';
import { PLAY, WIDTH } from './config';
import { isTalk, TUTORIAL_TEXT, tutorialNext, tutorialOver, tutorialStart, type TutorialEvent, type TutorialState } from './game/tutorial';
import { sfx } from './media';
import { banner, floatText, FONT } from './ui';

export interface TutorialHooks {
  player: Phaser.GameObjects.Sprite;
  dummy: { x: number; y: number };
  gate: { x: number; y: number };
  inYard: () => boolean;
  busy: () => boolean;
  onEnd: (finished: boolean) => void;
}

const WARN_MS = 800;
const BALL_SPEED = 75;
const BALL_RANGE = 60;
const DRILL_GAP_MS = 700;

export class Tutorial {
  private state: TutorialState = tutorialStart();
  private readonly box: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly frame: { x: number; y: number; w: number };
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly fx: Phaser.GameObjects.Graphics;
  private talk: Phaser.GameObjects.Container | null = null;
  private talkLine = 0;
  private ball: { img: Phaser.GameObjects.Image; x0: number; y0: number; ang: number; flyAt: number } | null = null;
  private nextBallAt = 0;
  private readonly offKeys: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly hooks: TutorialHooks) {
    const w = 260;
    const x = (WIDTH - w) / 2;
    const y = PLAY.y + 22;
    this.box = scene.add.container(0, 0).setDepth(970);
    const bg = scene.add.graphics();
    this.bg = bg;
    this.frame = { x, y, w };
    this.title = scene.add.text(x + 4, y + 3, '', { ...FONT, color: '#ffcc44' });
    this.text = scene.add.text(x + 4, y + 12, '', { ...FONT, color: '#ffffff', wordWrap: { width: w - 8 } });
    this.box.add([bg, this.title, this.text, scene.add.text(x + w - 4, y + 3, 'Esc: skip', { ...FONT, color: '#777777' }).setOrigin(1, 0)]);
    this.arrow = scene.add.graphics().setDepth(969);
    this.fx = scene.add.graphics().setDepth(968);
    const kb = scene.input.keyboard!;
    const onEnter = () => this.onEnter();
    const onEsc = () => { if (!this.hooks.busy()) this.event('skip'); };
    kb.on('keydown-ENTER', onEnter);
    kb.on('keydown-ESC', onEsc);
    this.offKeys = () => { kb.off('keydown-ENTER', onEnter); kb.off('keydown-ESC', onEsc); };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.show();
  }

  blocking(): boolean { return !tutorialOver(this.state) && isTalk(this.state); }

  get over(): boolean { return tutorialOver(this.state); }

  event(e: TutorialEvent) {
    if (this.over) return;
    const before = this.state;
    this.state = tutorialNext(this.state, e);
    if (this.state === before) return;
    if (e === 'hitDummy' || e === 'dodged') sfx(this.scene, 'ring', 0.4);
    if (this.state.step !== before.step) this.show();
    else this.setGoal();
  }

  update() {
    if (this.over) return;
    const now = this.scene.time.now;
    const step = this.state.step;
    if (step === 'walk' && this.hooks.inYard()) this.event('enterYard');
    const target = step === 'walk' ? this.hooks.gate : step === 'attack' ? this.hooks.dummy : null;
    this.arrow.clear();
    if (target) {
      const bob = Math.round(Math.sin(now / 150) * 2);
      const ax = target.x, ay = target.y - 18 + bob;
      this.arrow.fillStyle(0xffcc44).fillTriangle(ax - 4, ay, ax + 4, ay, ax, ay + 5).fillRect(ax - 1, ay - 5, 3, 5);
    }
    this.drill(now);
  }

  private drill(now: number) {
    this.fx.clear();
    if (this.state.step !== 'dodge') { this.ball?.img.destroy(); this.ball = null; return; }
    const p = this.hooks.player;
    const d = this.hooks.dummy;
    if (!this.ball) {
      if (now < this.nextBallAt) return;
      const ang = Phaser.Math.Angle.Between(d.x, d.y, p.x, p.y);
      this.ball = { img: this.scene.add.image(d.x, d.y, 'bullet').setDepth(12).setVisible(false), x0: d.x, y0: d.y, ang, flyAt: now + WARN_MS };
    }
    const b = this.ball;
    if (now < b.flyAt) {
      const pulse = 0.35 + 0.35 * Math.sin(now / 40);
      this.fx.lineStyle(1, 0xff3a3a, pulse).lineBetween(b.x0, b.y0, b.x0 + Math.cos(b.ang) * BALL_RANGE, b.y0 + Math.sin(b.ang) * BALL_RANGE);
      return;
    }
    const dist = (BALL_SPEED * (now - b.flyAt)) / 1000;
    const x = b.x0 + Math.cos(b.ang) * dist;
    const y = b.y0 + Math.sin(b.ang) * dist;
    b.img.setVisible(true).setPosition(Math.round(x), Math.round(y));
    if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < 6) {
      floatText(this.scene, p.x, p.y - 12, 'Ouch! Again.', '#ff8a8a');
      this.endBall(now);
    } else if (dist >= BALL_RANGE) {
      floatText(this.scene, p.x, p.y - 12, 'Dodged!', '#6fd13a');
      this.endBall(now);
      this.event('dodged');
    }
  }

  private endBall(now: number) {
    this.ball?.img.destroy();
    this.ball = null;
    this.nextBallAt = now + DRILL_GAP_MS;
  }

  private goalText(): string {
    const t = TUTORIAL_TEXT[this.state.step];
    const left = this.state.step === 'attack' ? ` (${this.state.count}/3)` : this.state.step === 'dodge' ? ` (${this.state.count}/3)` : '';
    return t.text + left;
  }

  private setGoal() {
    this.text.setText(this.goalText());
    const { x, y, w } = this.frame;
    const h = Math.max(22, Math.ceil(this.text.y + this.text.height - y) + 3);
    this.bg.clear().fillStyle(0x000000, 0.96).fillRect(x, y, w, h).fillStyle(0xffcc44).fillRect(x, y, w, 1);
  }

  private show() {
    const s = this.state;
    if (tutorialOver(s)) { this.finish(s.step === 'done'); return; }
    const t = TUTORIAL_TEXT[s.step];
    this.box.setVisible(!!t.text);
    this.title.setText(t.title);
    this.setGoal();
    this.nextBallAt = this.scene.time.now + 600;
    this.talk?.destroy();
    this.talk = null;
    if (t.talk) { this.talkLine = 0; this.sayLine(); }
  }

  private sayLine() {
    const lines = TUTORIAL_TEXT[this.state.step].talk ?? [];
    this.talk?.destroy();
    const w = PLAY.width - 8, h = 38, x = PLAY.x + 4, y = PLAY.y + PLAY.height - h - 4;
    const c = this.scene.add.container(0, 0).setDepth(971);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.96).fillRect(x, y, w, PLAY.y + PLAY.height - y).fillStyle(0xffcc44).fillRect(x, y, w, 1);
    const offer = this.state.step === 'offer' && this.talkLine === lines.length - 1;
    c.add([
      bg,
      this.scene.add.image(x + 14, y + h / 2, 'sergeant').setScale(2),
      this.scene.add.text(x + 30, y + 4, 'Sergeant Brann', { ...FONT, color: '#ffcc44' }),
      this.scene.add.text(x + 30, y + 14, lines[this.talkLine], { ...FONT, color: offer ? '#ffcc44' : '#ffffff', wordWrap: { width: w - 40 } }),
      this.scene.add.text(x + w - 4, y + h - 10, offer ? '' : 'Enter', { ...FONT, color: '#666666' }).setOrigin(1, 0),
    ]);
    this.talk = c;
  }

  private onEnter() {
    if (this.over || !isTalk(this.state)) return;
    const lines = TUTORIAL_TEXT[this.state.step].talk ?? [];
    if (this.talkLine < lines.length - 1) { this.talkLine++; this.sayLine(); return; }
    this.event('next');
  }

  private finish(finished: boolean) {
    this.hooks.onEnd(finished);
    if (finished) banner(this.scene, 'TRAINING DONE', 'Buy a weapon from the merchant, then the catapult.');
    else banner(this.scene, 'TRAINING SKIPPED', 'Sergeant Brann is by the yard if you want to practise.');
    this.destroy();
  }

  destroy() {
    this.offKeys();
    this.box.destroy();
    this.arrow.destroy();
    this.fx.destroy();
    this.talk?.destroy();
    this.talk = null;
    this.ball?.img.destroy();
    this.ball = null;
  }
}
