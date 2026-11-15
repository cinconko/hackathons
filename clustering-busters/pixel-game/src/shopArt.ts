import Phaser from 'phaser';
import { FONT } from './ui';

export const BOOK_PAGE = 70;
export const BOOK_H = 64;
const INK = '#3a2410';

export function crisp<T extends Phaser.GameObjects.Image>(img: T, max: number): T {
  return img.setScale(Math.max(1, Math.min(2, Math.floor(max / Math.max(img.width, img.height))))) as T;
}

export interface TagInfo {
  price: number;
  canPay: boolean;
  sold: boolean;
  picked: boolean;
  tilt: number;
  deal?: { full: number; discount: number };
}

export function priceTag(s: Phaser.Scene, drop: number, t: TagInfo): Phaser.GameObjects.GameObject[] {
  const string = s.add.graphics().fillStyle(0xd8c8a0).fillRect(0, 10, 1, drop - 15);
  const tag = s.add.container(0, drop).setRotation(t.tilt);
  const label = t.sold
    ? s.add.text(0, 0, 'SOLD', { ...FONT, color: '#2f7a1a' }).setOrigin(0.5)
    : s.add.text(-4, 0, `${t.price}`, { ...FONT, color: t.canPay ? INK : '#b02020' }).setOrigin(0.5);
  const tw = label.width + (t.sold ? 8 : 16);
  const paper = s.add.graphics();
  paper.fillStyle(0x5a3a1a).fillRect(-tw / 2 - 1, -7, tw + 2, 14);
  paper.fillStyle(t.picked ? 0xfff4d0 : 0xe8d8b0).fillRect(-tw / 2, -6, tw, 12);
  paper.fillStyle(0x5a3a1a).fillRect(-1, -5, 2, 2);
  tag.add([paper, label]);
  if (!t.sold) tag.add(s.add.image(label.x + label.width / 2 + 5, 0, 'ring_classic'));
  if (t.deal && !t.sold) {
    const old = s.add.text(-9, 10, `${t.deal.full}`, { ...FONT, color: '#c8c8d0' }).setOrigin(0.5, 0);
    tag.add(old);
    tag.add(s.add.graphics().fillStyle(0xd83a3a).fillRect(old.x - old.width / 2 - 1, 14, old.width + 2, 1).fillRect(5, 10, 22, 9));
    tag.add(s.add.text(16, 10, `-${Math.round(t.deal.discount * 100)}%`, { ...FONT, color: '#ffffff' }).setOrigin(0.5, 0));
  }
  return [string, tag];
}

export interface BookPage { name: string; kind: string; kindColor: string; pic: string; stats: string }

export function shopBook(s: Phaser.Scene, sx: number, cy: number, p: BookPage, open: boolean, delay = 0): Phaser.GameObjects.Container {
  const PW = BOOK_PAGE;
  const PH = BOOK_H;
  const b = s.add.container(sx, cy);
  const cover = s.add.graphics();
  cover.fillStyle(0x000000, 0.4).fillRect(-PW - 3, -PH / 2 + 3, PW * 2 + 8, PH + 4);
  cover.fillStyle(0x6b2a1a).fillRect(-PW - 4, -PH / 2 - 2, PW * 2 + 8, PH + 4);
  cover.fillStyle(0x4a1a10).fillRect(-1, -PH / 2 - 2, 2, PH + 4);
  b.add(cover);
  const page = (side: -1 | 1) => {
    const pg = s.add.container(0, 0);
    const g = s.add.graphics();
    g.fillStyle(0xf2e6c4).fillRect(side < 0 ? -PW : 1, -PH / 2, PW - 1, PH);
    g.fillStyle(0xd8c89c).fillRect(side < 0 ? -2 : 1, -PH / 2, 1, PH);
    pg.add(g);
    return pg;
  };
  const left = page(-1);
  const right = page(1);
  const name = s.add.text(-PW / 2, -PH / 2 + 4, p.name, { ...FONT, color: INK, align: 'center', wordWrap: { width: PW - 8 } }).setOrigin(0.5, 0);
  left.add(name);
  left.add(s.add.text(-PW / 2, name.y + name.height + 3, p.kind, { ...FONT, color: p.kindColor }).setOrigin(0.5, 0));
  left.add(crisp(s.add.image(-PW / 2, PH / 2 - 15, p.pic), 30));
  right.add(s.add.text(5, -PH / 2 + 4, p.stats, { ...FONT, color: INK, wordWrap: { width: PW - 8 }, lineSpacing: 1 }));
  b.add([left, right]);
  if (open) {
    left.setScale(0, 1);
    right.setScale(0, 1);
    b.setAlpha(0);
    s.tweens.add({ targets: b, alpha: 1, duration: 120, delay });
    s.tweens.add({ targets: [left, right], scaleX: 1, duration: 260, delay: delay + 60, ease: 'Back.easeOut' });
  }
  return b;
}

const OUTLINE = [0x1c, 0x12, 0x0e];

export function wareArt(s: Phaser.Scene, key: string): string {
  const out = `ware_${key}`;
  if (s.textures.exists(out) || !s.textures.exists(key)) return s.textures.exists(out) ? out : key;
  const src = s.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width + 2;
  const h = src.height + 2;
  const tex = s.textures.createCanvas(out, w, h);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.drawImage(src, 1, 1);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const at = (x: number, y: number) => (y * w + x) * 4;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  if (key.startsWith('icon_')) cutBox(d, w, h, at);
  const filled = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) filled[y * w + x] = d[at(x, y) + 3] === 255 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (filled[y * w + x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && filled[ny * w + nx] === 1;
    });
    if (near) { const i = at(x, y); d[i] = OUTLINE[0]; d[i + 1] = OUTLINE[1]; d[i + 2] = OUTLINE[2]; d[i + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return out;
}

function cutBox(d: Uint8ClampedArray, w: number, h: number, at: (x: number, y: number) => number) {
  const box = new Set<number>();
  const rgb = (i: number) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
  box.add(rgb(at(1, 1)));
  box.add(rgb(at(2, 2)));
  const seen = new Uint8Array(w * h);
  const stack: [number, number][] = [];
  for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
    seen[y * w + x] = 1;
    const i = at(x, y);
    if (d[i + 3] === 255 && !box.has(rgb(i))) continue;
    d[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

const busyMaps = new Map<string, { w: number; h: number; busy: Uint8Array; cloth: number }>();

function busyMap(s: Phaser.Scene, rugKey: string) {
  const hit = busyMaps.get(rugKey);
  if (hit) return hit;
  const src = s.textures.get(rugKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const count = new Map<number, number>();
  for (let y = cv.height / 4; y < (cv.height * 3) / 4; y += 3) for (let x = cv.width / 4; x < (cv.width * 3) / 4; x += 3) {
    const i = (Math.floor(y) * cv.width + Math.floor(x)) * 4;
    const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const cloth = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const cr = (cloth >> 10) << 3, cg = ((cloth >> 5) & 31) << 3, cb = (cloth & 31) << 3;
  const busy = new Uint8Array(cv.width * cv.height);
  for (let p = 0; p < busy.length; p++) {
    const i = p * 4;
    busy[p] = Math.abs(d[i] - cr) + Math.abs(d[i + 1] - cg) + Math.abs(d[i + 2] - cb) > 60 ? 1 : 0;
  }
  const m = { w: cv.width, h: cv.height, busy, cloth: (cr << 16) | (cg << 8) | cb };
  busyMaps.set(rugKey, m);
  return m;
}

export function clearSpot(s: Phaser.Scene, rugKey: string, rugX: number, rugY: number, want: { x: number; y: number }, size = 22, reach = { x: 14, y: 8 }) {
  const m = busyMap(s, rugKey);
  const ox = rugX - m.w / 2;
  const oy = rugY - m.h / 2;
  const clutter = (cx: number, cy: number) => {
    let n = 0;
    for (let y = Math.round(cy - oy - size / 2); y < cy - oy + size / 2; y++) {
      for (let x = Math.round(cx - ox - size / 2); x < cx - ox + size / 2; x++) {
        if (x >= 0 && y >= 0 && x < m.w && y < m.h) n += m.busy[y * m.w + x];
      }
    }
    return n;
  };
  let best = { x: want.x, y: want.y, score: Infinity };
  for (let dy = -reach.y; dy <= reach.y; dy += 2) {
    for (let dx = -reach.x; dx <= reach.x; dx += 2) {
      const score = clutter(want.x + dx, want.y + dy) * 4 + Math.abs(dx) + Math.abs(dy);
      if (score < best.score) best = { x: want.x + dx, y: want.y + dy, score };
    }
  }
  return { x: Math.round(best.x), y: Math.round(best.y) };
}

export const clothColor = (s: Phaser.Scene, rugKey: string): number => busyMap(s, rugKey).cloth;

export function clothPatch(s: Phaser.Scene, cloth: number, rx: number, ry: number, shade: number): Phaser.GameObjects.Graphics {
  const k = 1 - shade;
  const c = (Math.round(((cloth >> 16) & 255) * k) << 16) | (Math.round(((cloth >> 8) & 255) * k) << 8) | Math.round((cloth & 255) * k);
  const g = s.add.graphics();
  g.fillStyle(c, 0.45).fillEllipse(0, 2, rx * 2 + 12, ry * 2 + 10);
  g.fillStyle(c, 0.75).fillEllipse(0, 2, rx * 2 + 6, ry * 2 + 5);
  g.fillStyle(c, 1).fillEllipse(0, 2, rx * 2, ry * 2);
  return g;
}
