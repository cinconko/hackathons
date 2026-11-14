import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { mediaStatus, soundStatus } from '../media';
import { FONT } from '../ui';

// ?scene=media: the art checklist. Every sprite the game uses, with its size and whether it
// comes from a file (ART) or is still the placeholder drawn in code (DRAWN). The last page lists
// the music and sound effects. Hover a sprite for its full name and file path.
const COLS = 8;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;

export class MediaScene extends Phaser.Scene {
  private page = 0;
  private items: { key: string; w: number; h: number; art: boolean }[] = [];
  private view: Phaser.GameObjects.Container | null = null;
  private info!: Phaser.GameObjects.Text;

  constructor() { super('media'); }

  create() {
    // ?scene=media&show=cart_0,cartf_0 : inspect sprites big (whole-step scale, side by side)
    const show = new URLSearchParams(window.location.search).get('show');
    if (show) { this.inspect(show.split(',').filter((k) => this.textures.exists(k))); return; }
    this.page = 0;
    const keys = new Set([...mediaStatus.placeholders.keys(), ...mediaStatus.fromFiles]);
    this.items = [...keys].sort().map((key) => {
      const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
      return { key, w: src.width, h: src.height, art: mediaStatus.fromFiles.has(key) };
    });
    const art = this.items.filter((i) => i.art).length;
    const s = soundStatus(this.cache.audio);
    const sounds = [...s.music, ...s.sfx];
    this.add.text(PLAY.x + 4, PLAY.y + 3, `MEDIA CHECKLIST   art ${art}/${this.items.length}   sounds ${sounds.filter((x) => x.ok).length}/${sounds.length}`, { ...FONT, color: '#ffcc44' });
    this.info = this.add.text(PLAY.x + 4, PLAY.y + PLAY.height - 21, '', { ...FONT, color: '#cccccc' });
    this.add.text(PLAY.x + 4, PLAY.y + PLAY.height - 11, 'A/D page   Esc menu   files go in public/media (see its README)', { ...FONT, color: '#666666' });
    const kb = this.input.keyboard!;
    kb.on('keydown-A', () => this.turn(-1));
    kb.on('keydown-LEFT', () => this.turn(-1));
    kb.on('keydown-D', () => this.turn(1));
    kb.on('keydown-RIGHT', () => this.turn(1));
    kb.on('keydown-ESC', () => this.scene.start('menu'));
    console.table(this.items.filter((i) => !i.art).map((i) => ({ sprite: i.key, size: `${i.w}x${i.h}`, file: `public/media/sprites/${i.key}.png` })));
    drawFrame(this);
    this.render();
  }

  private inspect(keys: string[]) {
    const gap = 8;
    const sizes = keys.map((k) => this.textures.get(k).getSourceImage() as { width: number; height: number });
    const totalW = sizes.reduce((w, z) => w + z.width, 0) + gap * (keys.length - 1);
    const maxH = Math.max(1, ...sizes.map((z) => z.height));
    const scale = Math.max(1, Math.floor(Math.min((PLAY.width - 16) / Math.max(1, totalW), (PLAY.height - 40) / maxH)));
    let x = WIDTH / 2 - (totalW * scale) / 2;
    keys.forEach((k, i) => {
      const z = sizes[i];
      this.add.image(x + (z.width * scale) / 2, PLAY.y + 18 + (maxH * scale) / 2, k).setScale(scale);
      this.add.text(x + (z.width * scale) / 2, PLAY.y + 22 + maxH * scale + (i % 2) * 10, `${k} ${z.width}x${z.height}`, { ...FONT, color: '#dddddd' }).setOrigin(0.5, 0);   // staggered: no overlap
      x += (z.width + gap) * scale;
    });
    this.add.text(PLAY.x + 4, PLAY.y + 3, `INSPECT  x${scale}`, { ...FONT, color: '#ffcc44' });
    this.cameras.main.setBackgroundColor('#3f6a34');
    drawFrame(this);
  }

  private pages() { return Math.ceil(this.items.length / PER_PAGE) + 1; }   // + the sound page

  private turn(d: number) { this.page = (this.page + d + this.pages()) % this.pages(); this.render(); }

  private render() {
    this.view?.destroy();
    const c = this.add.container(0, 0);
    c.add(this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 3, `page ${this.page + 1}/${this.pages()}`, { ...FONT, color: '#888888' }).setOrigin(1, 0));
    if (this.page === this.pages() - 1) this.renderSounds(c);
    else this.renderSprites(c);
    this.view = c;
  }

  private renderSprites(c: Phaser.GameObjects.Container) {
    const cw = (PLAY.width - 8) / COLS;
    const ch = 40;
    this.items.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((it, i) => {
      const x = PLAY.x + 4 + (i % COLS) * cw;
      const y = PLAY.y + 15 + Math.floor(i / COLS) * ch;
      const g = this.add.graphics();
      g.fillStyle(0x1a1a24).fillRect(x + 1, y, cw - 2, ch - 3);
      g.fillStyle(it.art ? 0x3a8a3a : 0x5a5a64).fillRect(x + 1, y, cw - 2, 2);
      c.add(g);
      const img = this.add.image(x + cw / 2, y + 14, it.key);
      img.setScale(Math.min(2, 22 / Math.max(it.w, it.h, 1)));
      c.add(img);
      const name = it.key.length > 7 ? `${it.key.slice(0, 6)}~` : it.key;
      c.add(this.add.text(x + cw / 2, y + 26, name, { ...FONT, color: it.art ? '#8fe08f' : '#aaaaaa' }).setOrigin(0.5, 0));
      const zone = this.add.zone(x + cw / 2, y + ch / 2, cw - 2, ch - 3).setInteractive();
      zone.on('pointerover', () => this.info.setText(`${it.key}  ${it.w}x${it.h}  ${it.art ? 'ART from file' : `DRAWN: add public/media/sprites/${it.key}.png`}`));
      c.add(zone);
    });
  }

  private renderSounds(c: Phaser.GameObjects.Container) {
    const s = soundStatus(this.cache.audio);
    const col = (title: string, list: { key: string; ok: boolean }[], dir: string, x: number) => {
      c.add(this.add.text(x, PLAY.y + 16, `${title} (public/media/audio/${dir}/<name>.ogg)`, { ...FONT, color: '#ffcc44' }));
      list.forEach((it, i) => {
        const y = PLAY.y + 27 + (i % 12) * 10;
        const xx = x + Math.floor(i / 12) * 70;
        c.add(this.add.text(xx, y, `${it.ok ? '+' : '-'} ${it.key}`, { ...FONT, color: it.ok ? '#8fe08f' : '#777777' }));
      });
    };
    col('MUSIC', s.music, 'music', PLAY.x + 6);
    col('SOUND EFFECTS', s.sfx, 'sfx', WIDTH / 2 - 10);
    this.info.setText('+ = file found, - = silent for now');
  }
}
