import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config';
import { drawFrame } from '../frame';
import { countRings, formatTime, RARITY_ORDER, RINGS, type FightResult } from '../game/rules';
import { loadSave, writeSave } from '../save';

const FONT = { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' };

export class GameOverScene extends Phaser.Scene {
  constructor() { super('gameover'); }

  create(data: FightResult) {
    const save = loadSave();
    const counts = countRings(data.rings);
    const newBest = data.won && (save.bestTimeMs === 0 || data.timeMs < save.bestTimeMs);
    writeSave({
      ...save,
      wins: save.wins + (data.won ? 1 : 0),
      bestTimeMs: newBest ? data.timeMs : save.bestTimeMs,
      rings: { classic: save.rings.classic + counts.classic, rare: save.rings.rare + counts.rare, superRare: save.rings.superRare + counts.superRare },
    });

    this.add.text(WIDTH / 2, 40, data.won ? 'VICTORY' : 'DEFEATED', { fontFamily: 'monospace', fontSize: '20px', color: data.won ? '#ffcc44' : '#e03a4a' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 60, `Time ${formatTime(data.timeMs)}${newBest ? '   new best!' : ''}`, { ...FONT, color: '#cccccc' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 82, data.rings.length ? 'Rings this fight' : 'No rings this fight', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);
    RARITY_ORDER.forEach((r, i) => {
      const x = WIDTH / 2 - 60 + i * 50;
      this.add.image(x, 98, `ring_${r}`).setScale(2);
      this.add.text(x + 9, 94, `${counts[r]}`, { ...FONT, color: `#${RINGS[r].color.toString(16).padStart(6, '0')}` });
    });
    this.add.text(WIDTH / 2, 112, 'classic     rare     super rare', { ...FONT, color: '#666666' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 14, 'Enter / click to continue', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);

    const back = () => this.scene.start('menu');
    this.time.delayedCall(400, () => {   // a short pause so a held attack key does not skip this screen
      this.input.keyboard?.once('keydown-ENTER', back);
      this.input.once('pointerdown', back);
    });

    drawFrame(this);
  }
}
