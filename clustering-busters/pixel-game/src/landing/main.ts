// The one page around the game (index.html): the hero with your name, the game's framed screen,
// the story, the leaderboard and how lucky you have to be (src/game/odds.ts).
//
// Animations: elements with .reveal get .in when they scroll into view (CSS does the motion);
// the hero's tile wordmark is knocked apart by our farmer (wordmark.ts); a gold bar at the top shows
// how far down you are. prefers-reduced-motion: no reveals, nothing flies, everything simply shows.
//
// Sprites: every img[data-sprite] is filled from the running game's own textures (window.game)
// once it has booted: the page shows exactly what the game shows, and the media loads only once.
import type Phaser from 'phaser';
import { cleanNick, NICK_MAX, NICK_MIN } from '../game/leaderboard';
import { oddsGroups, pct } from '../game/odds';
import { fetchBoard, loadNick, saveNick, typing } from '../leaderboard';
import { boardTime } from '../scenes/board';
import { formatTime, walletValue } from '../game/rules';
import { loadSave } from '../save';
import { wordmark } from './wordmark';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const gameOf = () => (window as unknown as { game?: Phaser.Game }).game;

const el = <T extends HTMLElement>(tag: string, cls?: string, text?: string): T => {
  const e = document.createElement(tag) as T;
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ---- scroll reveals ----
const seen = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
function reveal(root: ParentNode = document) {
  for (const n of Array.from(root.querySelectorAll('.reveal:not(.in)'))) {
    if (reduceMotion) n.classList.add('in'); else seen.observe(n);
  }
}

// ---- your name, then play: the game is right below ----
const form = document.getElementById('play') as HTMLFormElement;
const input = document.getElementById('nick') as HTMLInputElement;
const hint = document.getElementById('nick-hint')!;
input.value = loadNick() ?? '';
// check the name while typing, without nagging mid-word: only bad characters or too long show red;
// too short stays neutral until Play is pressed
input.addEventListener('input', () => {
  const v = input.value.normalize('NFC').trim().replace(/\s+/g, ' ');
  const n = [...v].length;
  const bad = (v !== '' && !/^[\p{L}\p{N} _.-]+$/u.test(v)) || n > NICK_MAX;
  hint.textContent = bad ? `Letters, digits, space, _ . - only, ${NICK_MIN}-${NICK_MAX} long`
    : n >= NICK_MIN ? `Playing as ${v}` : `${NICK_MIN}-${NICK_MAX} letters or digits`;
  hint.classList.toggle('bad', bad);
});
// The game listens to the keyboard on the whole window (W, A, S, D, E, Q, Space...). While you
// type your name it steps aside, or those letters would never reach the box.
// The keyboard reaches the game only while you are not typing and the game is awake: asleep,
// Phaser never empties its key queue (the frame loop does), so presses made while reading the page
// would all replay at once on the next key. Turning it off drops them; the queue is cleared too.
// Only the page's own name box counts here (pageTyping): the in-game name screen sets typing.on by
// itself and never calls syncKeys, so reading typing.on could leave the keyboard off after it.
let asleep = false;
let pageTyping = false;
function syncKeys() {
  const kb = gameOf()?.input.keyboard;
  if (!kb) return;
  kb.enabled = !pageTyping && !asleep;
  if (!kb.enabled) (kb as unknown as { queue: KeyboardEvent[] }).queue.length = 0;   // public in Phaser, missing from its types
}
const keysToGame = (on: boolean) => { pageTyping = !on; typing.on = !on; syncKeys(); };
input.addEventListener('focus', () => keysToGame(false));
input.addEventListener('blur', () => keysToGame(true));
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
  hint.textContent = `Good luck, ${nick}! The game is right below.`;
  hint.classList.remove('bad');
  input.blur();
  document.getElementById('play-area')!.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});

// ---- the leaderboard: rows slide in one after another ----
async function showBoard() {
  const list = document.getElementById('board')!;
  const b = await fetchBoard();
  list.replaceChildren();
  if (!b) { list.append(el('li', 'muted', 'The leaderboard is offline right now.')); return; }
  if (!b.top.length) { list.append(el('li', 'muted', 'Nobody yet. Be the first!')); return; }
  const me = loadNick();
  b.top.forEach((s, i) => {
    const li = el<HTMLLIElement>('li', ['reveal', i < 3 ? 'top' : '', s.nick === me ? 'me' : ''].join(' ').trim());
    li.style.setProperty('--i', String(i));
    li.append(el('span', 'rank', `${i + 1}.`), el('span', 'nick', s.nick), el('span', 'time', boardTime(s.timeMs)));
    list.append(li);
  });
  reveal(list);
}
void showBoard();

// ---- the odds: each group's bars fill when it scrolls into view ----
/**
 * The odds as compact tiles: a sprite, a big percentage, a word or two, a bar. No blurbs. The
 * merchants' odds go onto their cards in the merchants section (no second list down here).
 */
function showOdds() {
  const root = document.getElementById('odds')!;
  for (const g of oddsGroups()) {
    if (g.id === 'merchants') {
      for (const r of g.rows) {
        const cap = document.querySelector(`.robes img[data-sprite="${r.sprite}"]`)?.parentElement?.querySelector('figcaption');
        if (cap) cap.append(el('b', 'odds-badge', pct(r.chance)));
      }
      continue;
    }
    // the fisherman's four supplies all have the same chance: one tile for them
    const rows = g.id === 'fisher' ? [{ ...g.rows[0], short: 'Each supply' }] : g.rows;
    const box = el('div', 'group reveal');
    box.append(el('h3', '', g.title));
    const tiles = el('div', 'tiles');
    rows.forEach((r, i) => {
      const tile = el('div', `tile ${r.sprite.replace('ring_', '')}`);
      const img = el<HTMLImageElement>('img');
      img.dataset.sprite = r.sprite;
      img.alt = '';
      const meter = el('div', 'meter');
      const fill = el('span');
      fill.style.setProperty('--w', `${Math.max(2, r.chance * 100)}%`);
      fill.style.setProperty('--i', String(i));
      meter.append(fill);
      tile.append(img, el('b', 'num', pct(r.chance)), el('span', 'what', r.short), meter);
      tiles.append(tile);
    });
    box.append(tiles);
    root.append(box);
  }
}
showOdds();
reveal();

// ---- the reading progress bar ----
const bar = document.getElementById('progress')!;
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---- the wordmark you can knock apart ----
wordmark(document.getElementById('wordmark') as HTMLCanvasElement, document.getElementById('knocked'),
  document.getElementById('hero-sprite') as HTMLImageElement | null, reduceMotion);

// ---- your stats beside the screen, from this browser's save (refreshed when you come back to it) ----
function showStats() {
  const s = loadSave();
  const set = (id: string, v: string) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('st-best', s.bestTimeMs ? formatTime(s.bestTimeMs) : '-');
  set('st-wins', String(s.wins));
  set('st-home', String(walletValue(s.lifetimeRings)));
  set('st-wallet', String(walletValue(s.wallet)));
}
showStats();
setInterval(showStats, 3000);

// ---- the game rests while its screen is out of sight (not in fullscreen) ----
// (only after boot: a sleeping game would never finish loading, and the page's sprites come from it)
const screenBox = document.getElementById('screen');
let booted = false;
let screenSeen = true;
function restOrPlay() {
  const g = gameOf();
  if (!g || !booted || document.fullscreenElement) return;
  asleep = !screenSeen;
  if (asleep) { g.loop.sleep(); g.sound.pauseAll(); } else { g.loop.wake(); g.sound.resumeAll(); }
  syncKeys();
}
if (screenBox) new IntersectionObserver(([e]) => { screenSeen = e.isIntersecting; restOrPlay(); }, { threshold: 0.1 }).observe(screenBox);

// ---- sprites from the game's own textures, once it has booted ----
function fillSprites(g: Phaser.Game) {
  for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img[data-sprite]'))) {
    const key = img.dataset.sprite!;
    if (!g.textures.exists(key)) { img.closest('.pic')?.classList.add('empty'); continue; }
    const frame = g.textures.getFrame(key);
    const scale = Number(img.dataset.scale ?? 0) || Math.max(1, Math.min(4, Math.floor(40 / Math.max(frame.width, frame.height))));
    img.src = g.textures.getBase64(key);
    img.width = frame.width * scale;
    img.height = frame.height * scale;
  }
}
(function waitForBoot() {
  const g = gameOf();
  // the boot scene makes the boss textures last of all: when they exist, every sprite does
  if (g && g.textures.exists('boss_flash') && !g.scene.isActive('boot')) { fillSprites(g); booted = true; restOrPlay(); return; }
  requestAnimationFrame(waitForBoot);
})();
