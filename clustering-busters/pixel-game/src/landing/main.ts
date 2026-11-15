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

const seen = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
function reveal(root: ParentNode = document) {
  for (const n of Array.from(root.querySelectorAll('.reveal:not(.in)'))) {
    if (reduceMotion) n.classList.add('in'); else seen.observe(n);
  }
}

const form = document.getElementById('play') as HTMLFormElement;
const input = document.getElementById('nick') as HTMLInputElement;
const hint = document.getElementById('nick-hint')!;
input.value = loadNick() ?? '';
input.addEventListener('input', () => {
  const v = input.value.normalize('NFC').trim().replace(/\s+/g, ' ');
  const n = [...v].length;
  const bad = (v !== '' && !/^[\p{L}\p{N} _.-]+$/u.test(v)) || n > NICK_MAX;
  hint.textContent = bad ? `Letters, digits, space, _ . - only, ${NICK_MIN}-${NICK_MAX} long`
    : n >= NICK_MIN ? `Playing as ${v}` : `${NICK_MIN}-${NICK_MAX} letters or digits`;
  hint.classList.toggle('bad', bad);
});
let asleep = false;
let pageTyping = false;
function syncKeys() {
  const kb = gameOf()?.input.keyboard;
  if (!kb) return;
  kb.enabled = !pageTyping && !asleep;
  // Asleep, Phaser never empties its key queue: without this, old presses all replay on the next key.
  if (!kb.enabled) (kb as unknown as { queue: KeyboardEvent[] }).queue.length = 0;
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

function boardRows(list: HTMLElement, top: { nick: string; timeMs: number }[], me: string | null, animate: boolean) {
  list.replaceChildren();
  top.forEach((s, i) => {
    const li = el<HTMLLIElement>('li', [animate ? 'reveal' : '', i < 3 ? 'top' : '', s.nick === me ? 'me' : ''].join(' ').trim());
    li.style.setProperty('--i', String(i));
    li.append(el('span', 'rank', `${i + 1}.`), el('span', 'nick', s.nick), el('span', 'time', boardTime(s.timeMs)));
    list.append(li);
  });
  if (animate) reveal(list);
}
let boardShown = false;
async function showBoard() {
  const full = document.getElementById('board');
  const mini = document.getElementById('board-top');
  const foot = document.getElementById('board-me');
  const b = await fetchBoard();
  const me = loadNick();
  const say = (msg: string) => { for (const l of [full, mini]) l?.replaceChildren(el('li', 'muted', msg)); };
  if (!b) say('The leaderboard is offline right now.');
  else if (!b.top.length) say('Nobody yet. Be the first!');
  else {
    if (full) boardRows(full, b.top, me, !boardShown);
    if (mini) boardRows(mini, b.top.slice(0, 5), me, false);
  }
  if (foot) {
    const best = loadSave().bestTimeMs;
    const mine = b?.top.findIndex((s) => s.nick === me) ?? -1;
    foot.textContent = mine >= 0 ? `You are #${mine + 1}, ${me}!`
      : best ? `Your best: ${boardTime(best)}${b ? ` · ${b.total} on the board` : ''}`
      : b ? `${b.total} ${b.total === 1 ? 'hero' : 'heroes'} on the board. Win to join them.` : '';
  }
  boardShown = true;
}
void showBoard();
setInterval(() => { if (document.visibilityState === 'visible') void showBoard(); }, 20_000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void showBoard(); });

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

wordmark(document.getElementById('wordmark') as HTMLCanvasElement, document.getElementById('knocked'),
  document.getElementById('hero-sprite') as HTMLImageElement | null, reduceMotion);

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
  if (g && g.textures.exists('boss_flash') && !g.scene.isActive('boot')) { fillSprites(g); booted = true; restOrPlay(); return; }
  requestAnimationFrame(waitForBoot);
})();
