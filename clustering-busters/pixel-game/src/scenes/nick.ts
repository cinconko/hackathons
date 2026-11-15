import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { cleanNick, NICK_MAX, NICK_MIN } from '../game/leaderboard';
import { loadNick, saveNick, typing } from '../leaderboard';
import { fadeToScene, FONT, title } from '../ui';

export interface NickData { next: string; nextData?: object }

export class NickScene extends Phaser.Scene {
  private value = '';
  private field!: Phaser.GameObjects.Text;
  private note!: Phaser.GameObjects.Text;

  constructor() { super('nick'); }

  create(data: NickData) {
    this.value = loadNick() ?? '';
    typing.on = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { typing.on = false; });

    this.add.text(WIDTH / 2, 40, 'WHO GOES TO MOSSBACK?', title(16, '#ffcc44')).setOrigin(0.5);
    this.add.text(WIDTH / 2, 60, 'Your winning times go on the leaderboard under this name.', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);
    const box = this.add.graphics();
    box.fillStyle(0x1a1424).fillRect(WIDTH / 2 - 70, 76, 140, 18);
    box.fillStyle(0xffcc44).fillRect(WIDTH / 2 - 70, 93, 140, 1);
    this.field = this.add.text(WIDTH / 2, 81, '', { ...FONT, color: '#ffffff' }).setOrigin(0.5, 0);
    this.note = this.add.text(WIDTH / 2, 102, `${NICK_MIN}-${NICK_MAX} letters or digits`, { ...FONT, color: '#666666' }).setOrigin(0.5, 0);
    this.add.text(WIDTH / 2, HEIGHT - 14, 'Enter: done', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);
    this.time.addEvent({ delay: 450, loop: true, callback: () => this.draw(true) });
    this.draw();

    let done = false;
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.repeat && e.key === 'Enter') return;
      if (e.key === 'Enter') {
        const nick = cleanNick(this.value);
        if (!nick) { this.warn(`${NICK_MIN}-${NICK_MAX} letters or digits, please`); return; }
        done = true;
        saveNick(nick);
        fadeToScene(this, data.next, data.nextData ?? {}, 400);
        return;
      }
      if (e.key === 'Backspace') this.value = [...this.value].slice(0, -1).join('');
      else if (e.key.length === 1 && [...this.value].length < NICK_MAX && /[\p{L}\p{N} _.-]/u.test(e.key)) this.value += e.key;
      else return;
      e.preventDefault();
      this.draw();
    };
    // window keydown, not Phaser's keyboard: Phaser replays keys after Shift ("Mira" became "MMMiMiMir").
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));

    drawFrame(this);
    this.cameras.main.fadeIn(300);
  }

  private caretOn = true;

  private draw(blink = false) {
    if (blink) this.caretOn = !this.caretOn;
    this.field.setText(`${this.value}${this.caretOn ? '_' : ' '}`);
  }

  private warn(msg: string) {
    this.note.setText(msg).setColor('#ff6a6a');
    this.cameras.main.shake(120, 0.004);
  }
}
