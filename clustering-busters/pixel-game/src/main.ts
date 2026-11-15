import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { installCrispText } from './crispText';
import { placeHandArt } from './handArt';
import { loadSave, resetSave, updateSave } from './save';
import { BootScene } from './scenes/boot';
import { MediaScene } from './scenes/media';
import { PreloadScene } from './scenes/preload';
import { IntroScene } from './scenes/intro';
import { OutroScene } from './scenes/outro';
import { MenuScene } from './scenes/menu';
import { PlayScene } from './scenes/play';
import { ResultScene } from './scenes/result';
import { TreasuryScene } from './scenes/treasury';
import { BoardScene } from './scenes/board';
import { NickScene } from './scenes/nick';
import { typing } from './leaderboard';
import { VillageScene } from './scenes/village';

installCrispText();                     // every text snapped to whole pixels (no grey fog when scaled up)

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.getElementById('screen') ?? undefined,   // the page's screen box (index.html); none: the page itself
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
  scene: [PreloadScene, BootScene, MenuScene, IntroScene, VillageScene, PlayScene, TreasuryScene, ResultScene, OutroScene, NickScene, BoardScene, MediaScene],
});

// Largest whole-number zoom that fits the screen box (in fullscreen: the whole monitor). Every
// game pixel becomes an exact square block: on a 1920 x 1080 monitor that is 6 x 6 pixels per
// game pixel. Leftover space is black, never a blurry half pixel.
const screenBox = document.getElementById('screen');
function fitCanvas() {
  const w = screenBox ? screenBox.clientWidth : window.innerWidth;
  const h = screenBox ? screenBox.clientHeight : window.innerHeight;
  const zoom = Math.max(1, Math.floor(Math.min(w / WIDTH, h / HEIGHT)));
  // setZoom (not CSS sizes): it also updates the pointer mapping, so the mouse lands on the
  // right game pixel. With CSS-only sizing, Scale.NONE never learns the canvas grew.
  game.scale.setZoom(zoom);
  requestAnimationFrame(placeHandArt);   // the weapon picture lives in the black space beside the canvas
}
fitCanvas();
window.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);
if (screenBox) new ResizeObserver(() => fitCanvas()).observe(screenBox);   // the page's layout moved the box

// M mutes all sound (remembered).
game.sound.mute = loadSave().muted;
window.addEventListener('keydown', (e) => {
  if (typing.on || (e.key !== 'm' && e.key !== 'M')) return;
  game.sound.mute = !game.sound.mute;
  updateSave((s) => ({ ...s, muted: game.sound.mute }));
});

// R (local dev only, never in the deployed build): erase the save and start over as a new player.
// Only the mute setting stays. A reload drops every running scene, so nothing old lingers.
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (typing.on || (e.key !== 'r' && e.key !== 'R') || e.repeat || e.metaKey || e.ctrlKey) return;   // Cmd+R stays a normal reload
    resetSave();
    window.location.reload();
  });
}

// Fullscreen: the screen box fills the monitor (browsers only allow it after a key press or a
// click). F and the page's Fullscreen button both toggle it.
function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void (screenBox ?? document.documentElement).requestFullscreen().catch(() => { /* blocked: stay windowed */ });
}
window.addEventListener('keydown', (e) => {
  if (typing.on || (e.key !== 'f' && e.key !== 'F')) return;
  toggleFullscreen();
});
const fsButton = document.getElementById('fullscreen');
fsButton?.addEventListener('click', () => { toggleFullscreen(); fsButton.blur(); });   // blur: Space must not press it again
document.addEventListener('fullscreenchange', () => {
  if (fsButton) fsButton.textContent = document.fullscreenElement ? '\u26F6 Exit fullscreen' : '\u26F6 Fullscreen';
});

// Debug handle for automated checks (scene name, etc.). Harmless in production.
(window as unknown as { game: Phaser.Game }).game = game;
