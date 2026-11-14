import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { installCrispText } from './crispText';
import { placeHandArt } from './handArt';
import { loadSave, resetSave, updateSave } from './save';
import { BootScene } from './scenes/boot';
import { MediaScene } from './scenes/media';
import { PreloadScene } from './scenes/preload';
import { IntroScene } from './scenes/intro';
import { MenuScene } from './scenes/menu';
import { PlayScene } from './scenes/play';
import { ResultScene } from './scenes/result';
import { TreasuryScene } from './scenes/treasury';
import { VillageScene } from './scenes/village';

installCrispText();                     // every text snapped to whole pixels (no grey fog when scaled up)

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
  // Real-time speed at any frame rate. Phaser's delta smoothing reported 16.7 ms frames on a
  // 30 fps machine, so the whole game (movement, bullets, cooldowns, timers) ran at half speed.
  // min 20 fps = one frame never counts for more than 50 ms (no tunnelling through walls).
  fps: { smoothStep: false, min: 20 },
  scene: [PreloadScene, BootScene, MenuScene, IntroScene, VillageScene, PlayScene, TreasuryScene, ResultScene, MediaScene],
});

// Largest whole-number zoom that fits the window. Every game pixel becomes an exact
// square block: on a 1920 x 1080 screen that is 6 x 6 pixels per game pixel. Leftover
// space is black, never a blurry half pixel.
function fitCanvas() {
  const zoom = Math.max(1, Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT)));
  // setZoom (not CSS sizes): it also updates the pointer mapping, so the mouse lands on the
  // right game pixel. With CSS-only sizing, Scale.NONE never learns the canvas grew.
  game.scale.setZoom(zoom);
  requestAnimationFrame(placeHandArt);   // the weapon picture lives in the black space beside the canvas
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

// M mutes all sound (remembered).
game.sound.mute = loadSave().muted;
window.addEventListener('keydown', (e) => {
  if (e.key !== 'm' && e.key !== 'M') return;
  game.sound.mute = !game.sound.mute;
  updateSave((s) => ({ ...s, muted: game.sound.mute }));
});

// R (local dev only, never in the deployed build): erase the save and start over as a new player.
// Only the mute setting stays. A reload drops every running scene, so nothing old lingers.
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if ((e.key !== 'r' && e.key !== 'R') || e.repeat || e.metaKey || e.ctrlKey) return;   // Cmd+R stays a normal reload
    resetSave();
    window.location.reload();
  });
}

// F toggles real fullscreen (browsers only allow it after a key press or click).
window.addEventListener('keydown', (e) => {
  if (e.key !== 'f' && e.key !== 'F') return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => { /* blocked: stay windowed */ });
});

// Debug handle for automated checks (scene name, etc.). Harmless in production.
(window as unknown as { game: Phaser.Game }).game = game;
