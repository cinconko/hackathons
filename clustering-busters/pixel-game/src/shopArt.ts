// What every shop draws the same way: the paper price tag on its string, and the book that opens
// with a ware's name and stats. The ring merchant (village.ts) lays his wares on his rug; the
// fisherman (play.ts) on his dock. Both build their wares from these.
import Phaser from 'phaser';
import { FONT } from './ui';

export const BOOK_PAGE = 70;   // width of one page (game pixels)
export const BOOK_H = 64;      // height of the book
const INK = '#3a2410';

/** Scale team art by whole steps only (1x or 2x), as big as fits `max` pixels: it stays crisp. */
export function crisp<T extends Phaser.GameObjects.Image>(img: T, max: number): T {
  return img.setScale(Math.max(1, Math.min(2, Math.floor(max / Math.max(img.width, img.height))))) as T;
}

export interface TagInfo {
  price: number;
  canPay: boolean;
  sold: boolean;
  picked: boolean;
  tilt: number;                              // radians: tags hang a little crooked
  deal?: { full: number; discount: number }; // the best deal: the old price crossed out, the discount
}

/**
 * A price tag hanging `drop` pixels below a ware: the string, then the cream paper with the price
 * and a ring (red ink when you can't pay, SOLD in green once bought). Add both to the ware.
 */
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
  paper.fillStyle(0x5a3a1a).fillRect(-1, -5, 2, 2);   // the hole for the string
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

/** What a book shows: left page name, kind (in its colour) and picture; right page the stats. */
export interface BookPage { name: string; kind: string; kindColor: string; pic: string; stats: string }

/**
 * An open book, its spine at (sx, cy). `open`: the pages unfold from the spine (a new pick),
 * after `delay` ms; otherwise it is simply there (the shop redrew for another reason).
 */
export function shopBook(s: Phaser.Scene, sx: number, cy: number, p: BookPage, open: boolean, delay = 0): Phaser.GameObjects.Container {
  const PW = BOOK_PAGE;
  const PH = BOOK_H;
  const b = s.add.container(sx, cy);
  const cover = s.add.graphics();
  cover.fillStyle(0x000000, 0.4).fillRect(-PW - 3, -PH / 2 + 3, PW * 2 + 8, PH + 4);   // its shadow
  cover.fillStyle(0x6b2a1a).fillRect(-PW - 4, -PH / 2 - 2, PW * 2 + 8, PH + 4);         // the leather cover
  cover.fillStyle(0x4a1a10).fillRect(-1, -PH / 2 - 2, 2, PH + 4);                        // the spine
  b.add(cover);
  const page = (side: -1 | 1) => {
    const pg = s.add.container(0, 0);
    const g = s.add.graphics();
    g.fillStyle(0xf2e6c4).fillRect(side < 0 ? -PW : 1, -PH / 2, PW - 1, PH);
    g.fillStyle(0xd8c89c).fillRect(side < 0 ? -2 : 1, -PH / 2, 1, PH);                    // the fold's shade
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
