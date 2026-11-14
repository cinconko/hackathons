import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/boot';
import { IntroScene } from './scenes/intro';
import { MenuScene } from './scenes/menu';
import { PlayScene } from './scenes/play';
import { ResultScene } from './scenes/result';
import { TreasuryScene } from './scenes/treasury';
import { VillageScene } from './scenes/village';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: undefined,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,                       // nearest-neighbour scaling + whole-pixel positions
  scale: {
    mode: Phaser.Scale.NONE,            // we size the canvas ourselves, in whole multiples (see fitCanvas)
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, MenuScene, IntroScene, VillageScene, PlayScene, TreasuryScene, ResultScene],
});

// Largest whole-number zoom that fits the window. Every game pixel becomes an exact
// square block: on a 1920 x 1080 screen that is 6 x 6 pixels per game pixel. Leftover
// space is black, never a blurry half pixel.
function fitCanvas() {
  const zoom = Math.max(1, Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT)));
  // setZoom (not CSS sizes): it also updates the pointer mapping, so the mouse lands on the
  // right game pixel. With CSS-only sizing, Scale.NONE never learns the canvas grew.
  game.scale.setZoom(zoom);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

// F toggles real fullscreen (browsers only allow it after a key press or click).
window.addEventListener('keydown', (e) => {
  if (e.key !== 'f' && e.key !== 'F') return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => { /* blocked: stay windowed */ });
});

// Debug handle for automated checks (scene name, etc.). Harmless in production.
(window as unknown as { game: Phaser.Game }).game = game;
