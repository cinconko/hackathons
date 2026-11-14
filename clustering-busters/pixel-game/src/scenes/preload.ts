import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { mediaStatus, queueMedia } from '../media';
import type { MediaManifest } from '../../tools/media-manifest';

// First scene: reads media/manifest.json (made by the Vite plugin from public/media) and loads
// every file in it. A missing manifest or a broken file is fine: the boot scene draws a
// placeholder for any sprite that did not load.
export class PreloadScene extends Phaser.Scene {
  constructor() { super('preload'); }

  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => console.warn(`[media] could not load ${file.src}: using the placeholder`));
    this.load.json('media-manifest', 'media/manifest.json');
  }

  create() {
    const m = this.cache.json.get('media-manifest') as MediaManifest | undefined;
    if (!m || typeof m !== 'object' || !m.sprites) { this.scene.start('boot'); return; }
    mediaStatus.manifest = m;
    if (queueMedia(this.load, m) === 0) { this.scene.start('boot'); return; }
    const label = this.add.text(WIDTH / 2, HEIGHT / 2, 'loading media', { fontFamily: 'monospace', fontSize: '8px', color: '#888888' }).setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => label.setText(`loading media ${Math.round(v * 100)}%`));
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string, type: string) => { if (type === 'image' || type === 'spritesheet') mediaStatus.fromFiles.add(key); });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('boot'));
    this.load.start();
  }
}
