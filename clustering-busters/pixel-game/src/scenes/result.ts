import Phaser from 'phaser';
import { playMusic } from '../media';
import { HEIGHT, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { addRings, countRings, formatTime, RARITY_ORDER, RINGS, walletValue, type FightResult } from '../game/rules';
import { updateSave } from '../save';
import { fadeToScene, FONT, hex, TITLE_FONT } from '../ui';
import { submitWin } from '../leaderboard';

export class ResultScene extends Phaser.Scene {
  constructor() { super('result'); }

  create(data: FightResult) {
    const counts = countRings(data.found);
    let newBest = false;
    const save = updateSave((s) => {
      newBest = data.won && (s.bestTimeMs === 0 || data.timeMs < s.bestTimeMs);
      return {
        ...s,
        wallet: data.wallet,
        lifetimeRings: addRings(s.lifetimeRings, data.found),
        wins: s.wins + (data.won ? 1 : 0),
        bestTimeMs: newBest ? data.timeMs : s.bestTimeMs,
      };
    });
    const sent = data.won ? submitWin(data.timeMs) : null;
    if (data.won && save.wins === 1) {
      this.scene.start('outro', { timeMs: data.timeMs, newBest, found: data.found, worth: walletValue(save.wallet) });
      return;
    }

    this.add.text(WIDTH / 2, 36, data.won ? 'TREASURY RECOVERED' : 'DEFEATED', { fontFamily: TITLE_FONT, fontSize: '16px', color: data.won ? '#ffcc44' : '#e03a4a' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 54, data.won ? `Time ${formatTime(data.timeMs)}${newBest ? '   new best!' : ''}` : 'The catapult is waiting. Try again.', { ...FONT, color: '#cccccc' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 74, data.found.length ? 'Rings found this run' : 'No rings this time', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);
    RARITY_ORDER.forEach((r, i) => {
      const x = WIDTH / 2 - 60 + i * 50;
      this.add.image(x, 90, `ring_${r}`).setScale(2);
      this.add.text(x + 9, 86, `${counts[r]}`, { ...FONT, color: hex(RINGS[r].color) });
    });
    this.add.text(WIDTH / 2, 104, 'classic     rare     super rare', { ...FONT, color: '#666666' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 122, `Wallet now worth ${walletValue(save.wallet)} rings`, { ...FONT, color: '#ffcc44' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 14, 'Enter / click: back to the village', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);

    drawFrame(this);
    this.cameras.main.fadeIn(500);
    playMusic(this, 'victory');
    const place = this.add.text(WIDTH / 2, 136, '', { ...FONT, color: '#9fd3ff' }).setOrigin(0.5);
    void sent?.then((b) => { if (b?.rank && this.scene.isActive()) place.setText(`Leaderboard: #${b.rank} of ${b.total}`); });
    const back = () => (data.won
      ? fadeToScene(this, 'board', { timeMs: data.timeMs, after: 'village', fromRun: true })
      : fadeToScene(this, 'village', { fromRun: true }));
    this.time.delayedCall(500, () => {
      this.input.keyboard?.once('keydown-ENTER', back);
      this.input.once('pointerdown', back);
    });
  }
}
