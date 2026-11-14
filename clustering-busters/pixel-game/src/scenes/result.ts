import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { addRings, countRings, formatTime, RARITY_ORDER, RINGS, walletValue, type FightResult } from '../game/rules';
import { updateSave } from '../save';
import { fadeToScene, FONT, hex } from '../ui';

// After the treasury: what you found this run. The wallet arrives already counted (the arena
// and the treasury keep it up to date); this screen saves it. Continue -> back to the village.
// (Losing does not come here: Mossback bounces you straight home.)
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

    this.add.text(WIDTH / 2, 36, data.won ? 'TREASURY RECOVERED' : 'DEFEATED', { fontFamily: 'monospace', fontSize: '18px', color: data.won ? '#ffcc44' : '#e03a4a' }).setOrigin(0.5);
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
    const back = () => fadeToScene(this, 'village');
    this.time.delayedCall(500, () => {   // a short pause so a held attack key does not skip this screen
      this.input.keyboard?.once('keydown-ENTER', back);
      this.input.once('pointerdown', back);
    });
  }
}
