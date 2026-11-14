import Phaser from 'phaser';
import { playMusic } from '../media';
import { HEIGHT, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { formatTime, walletValue } from '../game/rules';
import { loadSave } from '../save';
import { fadeToScene, title } from '../ui';

const FONT = { fontFamily: 'silkscreen, monospace', fontSize: '8px', color: '#888888' };

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const save = loadSave();
    this.add.text(WIDTH / 2, 42, 'RINGFALL', title(32)).setOrigin(0.5);
    this.add.text(WIDTH - 8, 7, 'Fonts: Alagard by Hewett Tsoi, Silkscreen', { ...FONT, color: '#555555' }).setOrigin(1, 0);   // the authors ask for credit
    this.add.text(WIDTH / 2, 64, 'Mossback stole the treasury. Go get the rings back.', { ...FONT, color: '#aaaaaa' }).setOrigin(0.5);
    const prompt = this.add.text(WIDTH / 2, 88, save.seenIntro ? 'Enter: to the village' : 'Press Enter or click to start', { fontFamily: 'silkscreen, monospace', fontSize: '8px', color: '#ffcc44' }).setOrigin(0.5);
    if (save.seenIntro) this.add.text(WIDTH / 2, 100, 'C: watch the story again', FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, 112, 'WASD move   mouse aim   click/Space attack', FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, 122, 'Q switch weapon   1-8 specials   E use   F fullscreen', FONT).setOrigin(0.5);

    this.add.text(WIDTH / 2, HEIGHT - 24, `Wallet: ${walletValue(save.wallet)} rings   Brought home: ${walletValue(save.lifetimeRings)}`, FONT).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 14, `Treasuries recovered: ${save.wins}   Best time: ${save.bestTimeMs ? formatTime(save.bestTimeMs) : '-'}`, FONT).setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

    let gone = false;
    const go = (scene: string) => { if (gone) return; gone = true; fadeToScene(this, scene, {}, 500); };
    const start = () => go(save.seenIntro ? 'village' : 'intro');
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-C', () => go('intro'));
    this.input.once('pointerdown', start);

    drawFrame(this);
    playMusic(this, 'menu');
  }
}
