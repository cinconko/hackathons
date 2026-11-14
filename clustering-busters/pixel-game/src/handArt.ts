// The big picture of the weapon in hand, in the black space beside the game canvas.
// The game scales by whole steps, so most screens have black bars around it; this panel lives
// there (outside the canvas, plain HTML). Detailed art: public/media/sprites/art_<weapon>.png
// (e.g. art_sword.png). Until that exists, the weapon's sprite is shown big and tilted.
// No room beside the game (e.g. fullscreen at an exact zoom) = the panel hides.
import Phaser from 'phaser';
import { FISTS, item, weapon, type WeaponId } from './game/rules';

const MIN_ROOM = 96;         // the black space must be at least this wide (CSS px)
let el: HTMLDivElement | null = null;
let pic: HTMLImageElement;
let title: HTMLDivElement;
let info: HTMLDivElement;
let fill: HTMLDivElement;
let ready: HTMLDivElement;
let shownId = '';
let wanted = false;          // a scene wants it shown (it may still not fit)
const urls = new Map<string, { url: string; w: number; h: number; art: boolean }>();

function ensure() {
  if (el) return;
  el = document.createElement('div');
  el.id = 'hand-art';
  el.style.cssText = 'position:fixed;display:none;flex-direction:column;align-items:center;gap:10px;box-sizing:border-box;padding:16px 10px;'
    + 'background:radial-gradient(ellipse at 50% 35%,#2a2040 0%,#120e1c 65%,#000 100%);border:1px solid #3a2a5a;border-radius:6px;'
    + 'font-family:monospace;color:#c8b8e8;text-align:center;pointer-events:none;user-select:none;';
  el.innerHTML = '<div style="font-size:11px;letter-spacing:2px;color:#8a7aa8">IN HAND</div>'
    + '<div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;min-height:120px">'
    + '<img alt="" style="image-rendering:pixelated;transform:rotate(-35deg);filter:drop-shadow(0 0 12px rgba(255,204,68,.35))"></div>'
    + '<div class="t" style="font-size:16px;color:#ffcc44;font-weight:bold"></div><div class="i" style="font-size:12px;line-height:1.5"></div>'
    + '<div style="width:80%;height:6px;background:#2a2238;border-radius:3px;overflow:hidden"><div class="f" style="height:100%;width:100%;background:#ffffff"></div></div>'
    + '<div class="r" style="font-size:11px;color:#6fd13a">READY</div>';
  pic = el.querySelector('img')!;
  title = el.querySelector('.t')!;
  info = el.querySelector('.i')!;
  fill = el.querySelector('.f')!;
  ready = el.querySelector('.r')!;
  document.body.appendChild(el);
}

/** Fits the panel into the widest black margin beside the canvas (call after every rescale). */
export function placeHandArt() {
  if (!el) return;
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const room = Math.min(r.left, window.innerWidth - r.right) - 16;
  if (!wanted || room < MIN_ROOM) { el.style.display = 'none'; return; }
  const w = Math.min(room, 280);
  el.style.width = `${w}px`;
  el.style.height = `${Math.min(r.height - 16, 420)}px`;
  el.style.left = `${Math.max(8, (r.left - w) / 2)}px`;          // centred in the left black space
  el.style.top = `${r.top + (r.height - Math.min(r.height - 16, 420)) / 2}px`;
  el.style.display = 'flex';
  const p = urls.get(shownId);
  if (p) {                                                       // as big as fits, keeping pixels crisp
    const max = w * 0.72;
    const scale = p.art ? Math.min(max / p.w, 220 / p.h) : Math.max(1, Math.floor(Math.min(max / p.w, 150 / p.h)));
    pic.style.width = `${Math.round(p.w * scale)}px`;
    pic.style.transform = p.art ? 'none' : 'rotate(-35deg)';
  }
}

function picture(scene: Phaser.Scene, id: WeaponId) {
  const key = scene.textures.exists(`art_${id}`) ? `art_${id}` : `held_${id}`;
  if (!urls.has(key)) {
    const src = scene.textures.get(key).getSourceImage() as { width: number; height: number };
    urls.set(key, { url: scene.textures.getBase64(key) as string, w: src.width, h: src.height, art: key.startsWith('art_') });
  }
  return key;
}

/** Show the weapon in hand. ready: 0..1 how far it has recharged. */
export function showHandArt(scene: Phaser.Scene, id: WeaponId, readyFrac = 1) {
  ensure();
  wanted = true;
  if (id !== shownId.replace(/^(art|held)_/, '')) {
    const key = picture(scene, id);
    shownId = key;
    pic.src = urls.get(key)!.url;
    const w = id === 'fists' ? FISTS : weapon(id);
    title.textContent = w.name;
    const it = id === 'fists' ? null : item(id);
    info.innerHTML = `${it ? (it.kind === 'melee' ? 'MELEE' : 'RANGED') : 'BARE HANDS'}<br>${w.damage} damage<br>cooldown ${w.cooldownMs / 1000}s${it ? `<br><span style="color:#8a7aa8">${it.desc}</span>` : ''}`;
    placeHandArt();
  }
  fill.style.width = `${Math.round(readyFrac * 100)}%`;
  fill.style.background = readyFrac >= 1 ? '#6fd13a' : '#ffffff';
  ready.textContent = readyFrac >= 1 ? 'READY' : 'recharging';
  ready.style.color = readyFrac >= 1 ? '#6fd13a' : '#8a7aa8';
}

export function hideHandArt() {
  wanted = false;
  shownId = '';
  if (el) el.style.display = 'none';
}
