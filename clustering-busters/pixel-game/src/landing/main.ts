// The landing page (landing.html, served at / on Vercel; the game is at /play): your name, the
// leaderboard, and how lucky you have to be (src/game/odds.ts).
//
// The sprites are the game's own: a tiny hidden copy of the game runs its preload and boot scenes
// (the team's art files, and the placeholders drawn in code), then each texture is copied out as
// a PNG. So the page always shows exactly what the game shows, and nothing is drawn twice.
import Phaser from 'phaser';
import { cleanNick, NICK_MAX, NICK_MIN } from '../game/leaderboard';
import { oddsGroups, oneIn, pct } from '../game/odds';
import { fetchBoard, loadNick, saveNick } from '../leaderboard';
import { BootScene } from '../scenes/boot';
import { PreloadScene } from '../scenes/preload';
import { boardTime } from '../scenes/board';

const PLAY_URL = import.meta.env.DEV ? '/' : '/play';   // dev: the game is index.html at the root

const el = <T extends HTMLElement>(tag: string, cls?: string, text?: string): T => {
  const e = document.createElement(tag) as T;
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ---- your name, then play ----
const form = document.getElementById('play') as HTMLFormElement;
const input = document.getElementById('nick') as HTMLInputElement;
const hint = document.getElementById('nick-hint')!;
input.value = loadNick() ?? '';
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const nick = cleanNick(input.value);
  if (!nick) {
    hint.textContent = `${NICK_MIN}-${NICK_MAX} letters or digits, please`;
    hint.classList.add('bad');
    input.focus();
    return;
  }
  saveNick(nick);
  window.location.href = PLAY_URL;
});

// ---- the leaderboard ----
async function showBoard() {
  const list = document.getElementById('board')!;
  const b = await fetchBoard();
  list.replaceChildren();
  if (!b) { list.append(el('li', 'muted', 'The leaderboard is offline right now.')); return; }
  if (!b.top.length) { list.append(el('li', 'muted', 'Nobody yet. Be the first!')); return; }
  const me = loadNick();
  b.top.forEach((s, i) => {
    const li = el<HTMLLIElement>('li', [i < 3 ? 'top' : '', s.nick === me ? 'me' : ''].join(' ').trim());
    li.append(el('span', 'rank', `${i + 1}.`), el('span', 'nick', s.nick), el('span', 'time', boardTime(s.timeMs)));
    list.append(li);
  });
}
void showBoard();

// ---- the odds ----
function showOdds() {
  const root = document.getElementById('odds')!;
  for (const g of oddsGroups()) {
    const box = el('div', 'group');
    box.append(el('h3', '', g.title), el('p', '', g.blurb));
    for (const r of g.rows) {
      const row = el('div', `odd ${r.sprite.replace('ring_', '')}`);
      const pic = el('div', 'pic');
      const img = el<HTMLImageElement>('img');
      img.dataset.sprite = r.sprite;
      img.alt = '';
      pic.append(img);
      const what = el('div', 'what', r.label);
      if (r.note) what.append(el('small', '', r.note));
      const meter = el('div', 'meter');
      const fill = el('span');
      fill.style.width = `${Math.max(2, r.chance * 100)}%`;
      meter.append(fill);
      what.append(meter);
      const num = el('div', 'num', pct(r.chance));
      if (r.chance < 0.5) num.append(el('small', '', oneIn(r.chance)));
      row.append(pic, what, num);
      box.append(row);
    }
    root.append(box);
  }
}
showOdds();

// ---- the game's sprites, copied out of a hidden copy of the game ----
class SpriteGrab extends Phaser.Scene {
  constructor() { super('menu'); }   // the boot scene starts 'menu' when it is done
  create() {
    for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img[data-sprite]'))) {
      const key = img.dataset.sprite!;
      if (!this.textures.exists(key)) { img.closest('.pic')?.classList.add('empty'); continue; }
      const frame = this.textures.getFrame(key);
      const scale = Number(img.dataset.scale ?? 0) || Math.max(1, Math.min(4, Math.floor(40 / Math.max(frame.width, frame.height))));
      img.src = this.textures.getBase64(key);
      img.width = frame.width * scale;
      img.height = frame.height * scale;
    }
    this.time.delayedCall(0, () => this.game.destroy(true));
  }
}
new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'sprite-factory',
  width: 32,
  height: 32,
  audio: { noAudio: true },
  banner: false,
  scene: [PreloadScene, BootScene, SpriteGrab],
});
