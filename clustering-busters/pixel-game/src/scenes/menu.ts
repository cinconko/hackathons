import Phaser from 'phaser';
import { playMusic } from '../media';
import { HEIGHT, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { formatTime, startingWallet, walletValue } from '../game/rules';
import { loadSave, resetSave } from '../save';
import { fadeToScene, title } from '../ui';
import { loadNick } from '../leaderboard';

const FONT = { fontFamily: 'silkscreen, monospace', fontSize: '8px', color: '#888888' };

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const save = loadSave();
    this.add.text(WIDTH / 2, 42, 'RINGFALL', title(32)).setOrigin(0.5);
    this.add.text(WIDTH - 8, 7, 'Fonts: Alagard by Hewett Tsoi, Silkscreen', { ...FONT, color: '#555555' }).setOrigin(1, 0);   // the authors ask for credit
    this.add.text(WIDTH / 2, 64, 'Mossback stole the treasury. Go get the rings back.', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);
    const prompt = this.add.text(WIDTH / 2, 88, save.seenIntro ? 'Enter: to the village' : 'Press Enter or click to start', { fontFamily: 'silkscreen, monospace', fontSize: '8px', color: '#ffcc44' }).setOrigin(0.5);
    if (save.seenIntro) this.add.text(WIDTH / 2, 100, save.wins ? 'C: the story again   V: the ending' : 'C: watch the story again', FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, 112, 'WASD move   mouse aim   click/Space attack', FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, 122, 'Q switch weapon   1-8 specials   E use   F fullscreen', FONT).setOrigin(0.5);
    const nick = loadNick();
    this.add.text(WIDTH / 2, 136, `${nick ? `Playing as ${nick}   N: change name` : 'N: choose your name'}   L: leaderboard`, { ...FONT, color: '#9fd3ff' }).setOrigin(0.5);

    this.add.text(WIDTH / 2, HEIGHT - 24, `Wallet: ${walletValue(save.wallet)} rings   Brought home: ${walletValue(save.lifetimeRings)}`, FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 14, `Treasuries recovered: ${save.wins}   Best time: ${save.bestTimeMs ? formatTime(save.bestTimeMs) : '-'}`, FONT).setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

    let gone = false;
    const go = (scene: string, d: object = {}) => { if (gone) return; gone = true; fadeToScene(this, scene, d, 500); };
    // no name yet: ask for it first (the leaderboard needs one), then start
    const first = save.seenIntro ? 'village' : 'intro';
    const start = () => (loadNick() ? go(first) : go('nick', { next: first }));
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-C', () => go('intro'));
    this.input.keyboard?.once('keydown-N', () => go('nick', { next: 'menu' }));
    this.input.keyboard?.once('keydown-L', () => go('board'));
    if (save.wins) this.input.keyboard?.once('keydown-V', () => go('outro'));
    this.input.once('pointerdown', start);

    // R: start over as a new player (everything but the mute setting and your name). Shown only when
    // there is progress to lose, and it asks twice: one stray key must not wipe a whole game.
    const fresh = startingWallet();
    const hasProgress = save.seenIntro || save.wins > 0 || save.spent > 0 || save.inventory.owned.length > 0
      || walletValue(save.wallet) !== walletValue(fresh) || walletValue(save.lifetimeRings) > 0;
    if (hasProgress) {
      const ASK = 'R: new game (erases your progress)';
      const reset = this.add.text(WIDTH / 2, 147, ASK, { ...FONT, color: '#c86a6a' }).setOrigin(0.5);
      let armed: Phaser.Time.TimerEvent | null = null;
      let lastPress = -1;
      const disarm = () => { armed?.remove(); armed = null; reset.setText(ASK).setColor('#c86a6a'); };
      this.input.keyboard?.on('keydown-R', (e: KeyboardEvent) => {
        if (gone || e.repeat || e.metaKey || e.ctrlKey) return;   // Cmd+R stays a normal reload
        // The page puts the game to sleep while its screen is scrolled away; asleep, Phaser never
        // clears its key queue and replays old presses with every new key. Only a fresh press counts.
        if (!this.game.loop.running || e.timeStamp <= lastPress) return;
        lastPress = e.timeStamp;
        if (!armed) {
          reset.setText('Press R again to erase everything   Esc: keep it').setColor('#ff5555');
          armed = this.time.delayedCall(4000, disarm);
          return;
        }
        gone = true;
        resetSave();
        window.location.reload();   // a reload drops every running scene, so nothing old lingers
      });
      this.input.keyboard?.on('keydown-ESC', disarm);
    }

    drawFrame(this);
    playMusic(this, 'menu');
  }
}
