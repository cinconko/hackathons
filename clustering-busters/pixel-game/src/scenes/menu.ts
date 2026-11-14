import Phaser from 'phaser';
import { WIDTH, HEIGHT } from '../config';
import { drawFrame } from '../frame';
import { formatTime } from '../game/rules';
import { loadSave } from '../save';

const FONT = { fontFamily: 'monospace', fontSize: '8px', color: '#888888' };

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const save = loadSave();
    this.add.text(WIDTH / 2, 44, 'RINGFALL', { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 64, 'Beat Mossback in 3 stages. Collect his rings.', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);
    const prompt = this.add.text(WIDTH / 2, 88, 'Press Enter or click to start', { fontFamily: 'monospace', fontSize: '10px', color: '#ffcc44' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 108, 'WASD move   Space/click attack   Q or 1-4 weapon', FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, 118, 'E shop (the fisherman comes every 30s)   F fullscreen', FONT).setOrigin(0.5);

    const r = save.rings;
    this.add.text(WIDTH / 2, HEIGHT - 24, `Rings: ${r.classic} classic  ${r.rare} rare  ${r.superRare} super rare`, FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 14, `Wins: ${save.wins}   Best time: ${save.bestTimeMs ? formatTime(save.bestTimeMs) : '-'}`, FONT).setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

    const start = () => this.scene.start('play');
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);

    drawFrame(this);
  }
}
