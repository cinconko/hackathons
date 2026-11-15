import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { installCrispText } from './crispText';
import { placeHandArt } from './handArt';
import { loadSave, updateSave } from './save';
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

installCrispText();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.getElementById('screen') ?? undefined,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.NONE,
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  // smoothStep off: delta smoothing ran the game at half speed on 30 fps machines; min 20 caps a frame at 50 ms.
  fps: { smoothStep: false, min: 20 },
  scene: [PreloadScene, BootScene, MenuScene, IntroScene, VillageScene, PlayScene, TreasuryScene, ResultScene, OutroScene, NickScene, BoardScene, MediaScene],
});

const screenBox = document.getElementById('screen');
function fitCanvas() {
  const w = screenBox ? screenBox.clientWidth : window.innerWidth;
  const h = screenBox ? screenBox.clientHeight : window.innerHeight;
  const zoom = Math.max(1, Math.floor(Math.min(w / WIDTH, h / HEIGHT)));
  game.scale.setZoom(zoom);
  requestAnimationFrame(placeHandArt);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);
if (screenBox) new ResizeObserver(() => fitCanvas()).observe(screenBox);

game.sound.mute = loadSave().muted;
window.addEventListener('keydown', (e) => {
  if (typing.on || (e.key !== 'm' && e.key !== 'M')) return;
  game.sound.mute = !game.sound.mute;
  updateSave((s) => ({ ...s, muted: game.sound.mute }));
});

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void (screenBox ?? document.documentElement).requestFullscreen().catch(() => {   });
}
window.addEventListener('keydown', (e) => {
  if (typing.on || (e.key !== 'f' && e.key !== 'F')) return;
  toggleFullscreen();
});
const fsButton = document.getElementById('fullscreen');
fsButton?.addEventListener('click', () => { toggleFullscreen(); fsButton.blur(); });
document.addEventListener('fullscreenchange', () => {
  if (fsButton) fsButton.textContent = document.fullscreenElement ? '\u26F6 Exit fullscreen' : '\u26F6 Fullscreen';
});

(window as unknown as { game: Phaser.Game }).game = game;
