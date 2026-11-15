import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { loadFonts, mediaStatus, queueMedia } from '../media';
import type { MediaManifest } from '../../tools/media-manifest';

const inlineManifest = () => (window as unknown as { __MEDIA__?: MediaManifest }).__MEDIA__;

export class PreloadScene extends Phaser.Scene {
  constructor() { super('preload'); }

  preload() {
    this.load.imageLoadType = 'HTMLImageElement';
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => console.warn(`[media] could not load ${file.src}: using the placeholder`));
    if (!inlineManifest()) this.load.json('media-manifest', 'media/manifest.json');
  }

  create() {
    const m = inlineManifest() ?? (this.cache.json.get('media-manifest') as MediaManifest | undefined);
    if (!m || typeof m !== 'object' || !m.sprites) { this.scene.start('boot'); return; }
    mediaStatus.manifest = m;
    loadFonts(m).then(() => this.loadFiles(m));
  }

  private loadFiles(m: MediaManifest) {
    if (queueMedia(this.load, m) === 0) { this.scene.start('boot'); return; }
    const label = this.add.text(WIDTH / 2, HEIGHT / 2, 'loading media', { fontFamily: 'monospace', fontSize: '8px', color: '#888888' }).setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => label.setText(`loading media ${Math.round(v * 100)}%`));
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string, type: string) => { if (type === 'image' || type === 'spritesheet') mediaStatus.fromFiles.add(key); });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('boot'));
    this.load.start();
  }
}
