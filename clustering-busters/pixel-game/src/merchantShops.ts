// The ring merchant's shop grows with the village. In the village (village.ts PARTS) and in the
// window you open (village.ts renderCards):
//
//   level            in the village                       his shop window
//   1-2 camp, tents  a blanket on the ground (boot.ts)    his rug
//   3   village      the striped market stall (boot.ts)   his rug
//   4   fountains    a market booth: awning, jars, crates his rug, crates and a barrel at the back
//   5   rich town    a timber ring shop, display window   a wooden counter with a felt runner
//   6   the city     the ring emporium: stone, gold crest a velvet display case behind glass
//
// The buildings are drawn here in code, and only when the team has no art file for them
// (public/media/sprites/shop_booth.png, shop_house.png, shop_emporium.png): drop one in and it wins.
import Phaser from 'phaser';
import { DARK, GOLDT, IRON, kit, PLASTER, STONE, TILE, WOOD } from './villageArt';

export type ShopFloor = 'rug' | 'booth' | 'counter' | 'velvet';

/** Which window his wares lie in at this village level. */
export const shopFloor = (level: number): ShopFloor => (level >= 6 ? 'velvet' : level >= 5 ? 'counter' : level >= 4 ? 'booth' : 'rug');

const GOLD = 0xffcc44;

/** The three new buildings, as textures (sizes: booth 48x24, house 50x30, emporium 56x30), drawn
 * like the rest of the village (src/villageArt.ts): outlined, lit from the upper left. */
export function makeShopTextures(s: Phaser.Scene) {
  const g = s.make.graphics({ x: 0, y: 0 }, false);
  const { px, block, gable, door } = kit(g);
  const tex = (key: string, w: number, h: number, draw: () => void) => {
    if (s.textures.exists(key)) return;   // the team's art (or made already)
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  // 4: a market booth. A scalloped awning in gold and teal on outlined posts, a cloth back wall with a
  // shelf of jars, a plank counter with rings laid out, crates at one end, a barrel at the other.
  tex('shop_booth', 48, 24, () => {
    px(DARK, 0, 0, 48, 7);
    for (let i = 0; i < 8; i++) {
      const c = i % 2 ? GOLD : 0x2d8a8a;
      px(c, i * 6 + 1, 1, 5, 4); px(c, i * 6 + 2, 5, 3, 1);       // a stripe and its scallop
      px(0xffffff, i * 6 + 1, 1, 5, 1, 0.3);
    }
    for (const x of [2, 43]) { px(DARK, x, 7, 3, 9); px(WOOD.l, x + 1, 7, 1, 9); }   // posts
    px(DARK, 5, 7, 38, 8); px(0x4a2a4a, 6, 7, 36, 7); px(0x5a3a5a, 6, 7, 36, 1);     // the cloth back wall
    px(DARK, 6, 11, 36, 1); px(WOOD.l, 6, 10, 36, 1);                                 // a shelf
    [0x6fd13a, 0xd83a3a, 0x44aaff, 0xa04ad9, GOLD, 0x6fd13a].forEach((c, i) => { px(DARK, 8 + i * 6, 7, 4, 4); px(c, 9 + i * 6, 8, 2, 2); px(0xffffff, 9 + i * 6, 8, 1, 1, 0.6); });   // jars
    block(0, 15, 48, 9, WOOD);
    for (const x of [12, 24, 36]) px(WOOD.s, x, 16, 1, 7);
    [0xc8c8d0, 0x44aaff, 0xff55dd, 0xc8c8d0, 0x44aaff].forEach((c, i) => { px(DARK, 14 + i * 4, 13, 4, 2); px(c, 15 + i * 4, 13, 2, 1); });   // rings
    block(0, 11, 9, 7, { l: 0xc09858, m: 0xa07a42, s: 0x7a5a2a }); px(DARK, 4, 11, 1, 7);   // crates
    block(1, 17, 9, 7, { l: 0xc09858, m: 0xa07a42, s: 0x7a5a2a }); px(DARK, 5, 17, 1, 7);
    px(DARK, 39, 14, 9, 10); px(WOOD.m, 40, 15, 7, 8); px(WOOD.l, 40, 15, 2, 8); px(IRON, 40, 17, 7, 1); px(IRON, 40, 21, 7, 1);   // barrel
  });

  // 5: a timber ring shop. A tiled roof, whitewash between dark beams, a display window with rings
  // glinting, an arched door, a flower box, a gold ring hanging from an iron bracket.
  tex('shop_house', 50, 30, () => {
    gable(24, 0, 9, 30, TILE);
    px(DARK, 2, 8, 46, 1);
    block(4, 9, 42, 21, PLASTER);
    for (const x of [4, 25, 45]) px(DARK, x, 9, 1, 21);
    px(DARK, 4, 18, 22, 1);
    // the display window: rings on velvet behind glass
    px(DARK, 7, 11, 16, 11); px(0x5a0e24, 8, 12, 14, 9);
    [[10, 17, GOLD], [13, 15, 0x44aaff], [16, 18, 0xff55dd], [19, 16, GOLD]].forEach(([x, y, c]) => { px(c, x, y, 2, 2); px(0xffffff, x, y, 1, 1, 0.7); });
    px(0xffffff, 9, 12, 1, 3, 0.35); px(0xffffff, 19, 12, 3, 1, 0.25);
    px(WOOD.l, 6, 22, 18, 1); px(DARK, 6, 23, 18, 1);                      // the sill
    [8, 11, 14, 17, 20].forEach((x, i) => { px(0x3f7a30, x, 20, 2, 2); px([0xd83a3a, GOLD, 0xff55dd, 0xd83a3a, GOLD][i], x, 20, 2, 1); });
    door(29, 16, 12, 14);
    block(26, 28, 18, 2, STONE, false);                                    // the step
    px(DARK, 45, 11, 5, 1); px(DARK, 49, 11, 1, 2);                        // the bracket
    g.fillStyle(DARK).fillCircle(48, 16, 4); g.fillStyle(GOLD).fillCircle(48, 16, 3); g.fillStyle(PLASTER.m).fillCircle(48, 16, 1); px(0xfff1a8, 46, 14, 1, 1);
  });

  // 6: the ring emporium. Pale stone, a slate roof trimmed in gold with a gold ring crest, two
  // columns, arched windows glowing with velvet, a grand door under a gold plaque, banners, steps.
  tex('shop_emporium', 56, 30, () => {
    block(1, 4, 54, 6, { l: 0x4a5a8a, m: 0x2a3a6a, s: 0x1a2a5a });       // slate roof
    px(GOLD, 2, 4, 52, 1);
    g.fillStyle(DARK).fillCircle(28, 3, 4); g.fillStyle(GOLD).fillCircle(28, 3, 3); g.fillStyle(0x2a3a6a).fillCircle(28, 3, 1); px(0xfff1a8, 26, 1, 1, 1);   // the ring crest
    block(2, 9, 52, 21, STONE);
    for (let y = 13, r = 0; y < 29; y += 4, r++) { px(STONE.s, 3, y, 50, 1); for (let x = 6 + (r % 2) * 4; x < 52; x += 8) px(STONE.s, x, y - 3, 1, 3); }
    for (const x of [3, 49]) { block(x, 9, 5, 21, { l: 0xfaf4e8, m: 0xe8e0d0, s: 0xc8c0b0 }); px(GOLD, x, 9, 5, 1); }   // columns
    for (const x of [11, 37]) {                                            // arched windows, lit with velvet
      g.fillStyle(DARK).fillCircle(x + 4, 15, 5); px(DARK, x - 1, 15, 11, 9);
      g.fillStyle(GOLD).fillCircle(x + 4, 15, 4); px(GOLD, x, 15, 9, 8);
      g.fillStyle(0x8a1a3a).fillCircle(x + 4, 15, 3); px(0x8a1a3a, x + 1, 15, 7, 7);
      px(GOLD, x + 2, 18, 2, 2); px(0xff55dd, x + 5, 20, 2, 2); px(0xffffff, x + 1, 13, 1, 3, 0.5);
    }
    block(21, 10, 14, 4, GOLDT);                                           // the plaque
    door(23, 15, 10, 15);
    for (const x of [9, 46]) { px(DARK, x - 1, 9, 4, 7); px(0x6a2a8a, x, 9, 2, 6); px(GOLD, x, 13, 2, 1); }   // banners
    block(17, 28, 22, 2, STONE, false);                                    // steps
  });
  g.destroy();
}

/** The colour of the patch each ware lies on, when the floor is not a rug (the rug has its own cloth). */
export const FLOOR_PATCH: Readonly<Record<'counter' | 'velvet', number>> = { counter: 0x2f6a3a, velvet: 0xd8b060 };

/**
 * His shop window's floor behind the wares, inside the window (x, y, w, h). The rug ('rug',
 * 'booth') is drawn by village.ts from the team's rug art; this adds the booth's crates on it, or
 * draws the counter or the velvet case instead. Returns what to add to the window, back to front.
 */
export function shopFloorArt(s: Phaser.Scene, floor: ShopFloor, x: number, y: number, w: number, h: number): Phaser.GameObjects.GameObject[] {
  const g = s.add.graphics();
  const top = y + 22;
  const bottom = y + h - 14;
  if (floor === 'booth') {
    // crates and a barrel at the back corners of the rug, clear of the book and the wares
    const crate = (cx: number, cy: number, sz: number) => {
      g.fillStyle(0x000000, 0.35).fillRect(cx + 2, cy + 2, sz, sz);
      g.fillStyle(0xa07a42).fillRect(cx, cy, sz, sz);
      g.fillStyle(0x6b4a2b).fillRect(cx, cy, sz, 2).fillRect(cx, cy + sz - 2, sz, 2).fillRect(cx, cy, 2, sz).fillRect(cx + sz - 2, cy, 2, sz);
      g.lineStyle(2, 0x6b4a2b).lineBetween(cx + 2, cy + 2, cx + sz - 2, cy + sz - 2);
    };
    crate(x + 36, top + 30, 22); crate(x + 60, top + 38, 14); crate(x + 40, top + 10, 16);   // on the rug, not its fringe
    const bx = x + w - 52;
    g.fillStyle(0x000000, 0.35).fillEllipse(bx + 2, top + 54, 24, 8);
    g.fillStyle(0x7a5230).fillRect(bx - 10, top + 26, 20, 28);
    g.fillStyle(0x8a6a3a).fillRect(bx - 8, top + 26, 4, 28);
    g.fillStyle(0x4a4a54).fillRect(bx - 10, top + 31, 20, 2).fillRect(bx - 10, top + 47, 20, 2);
    g.fillStyle(0x5a3a1a).fillEllipse(bx, top + 26, 20, 6);
    return [g];
  }
  if (floor === 'counter') {
    // warm planks, the counter's front edge, a green felt runner where the wares lie
    for (let i = 0, py = top; py < bottom; i++, py += 7) {
      g.fillStyle(i % 2 ? 0x8a5a30 : 0x9a6a38).fillRect(x + 1, py, w - 2, 7);
      g.fillStyle(0x6b4220).fillRect(x + 1, py + 6, w - 2, 1);
      for (let k = 0; k < 3; k++) g.fillStyle(0x7a4a28).fillRect(x + 20 + ((i * 53 + k * 97) % (w - 40)), py + 3, 9, 1);   // grain
    }
    g.fillStyle(0x2f6a3a).fillRect(x + 10, y + 92, w - 20, 50);
    g.fillStyle(0x3f7a4a).fillRect(x + 10, y + 92, w - 20, 1);
    g.fillStyle(GOLD).fillRect(x + 10, y + 141, w - 20, 1);   // a brass rail at the front
    g.fillStyle(0x000000, 0.25).fillRect(x + 10, y + 142, w - 20, 2);
  } else if (floor === 'velvet') {
    // deep crimson velvet, tufted with buttons in a diamond grid, framed in gold, behind glass
    g.fillStyle(0x5a0e24).fillRect(x + 1, top, w - 2, bottom - top);
    for (let row = 0, py = top + 6; py < bottom; row++, py += 12) {
      for (let px = x + 8 + (row % 2) * 12; px < x + w - 4; px += 24) {
        g.fillStyle(0x6e1630).fillCircle(px, py, 7);
        g.fillStyle(0x3a0614).fillCircle(px, py, 1);
      }
    }
    g.lineStyle(2, GOLD).strokeRect(x + 4, top + 3, w - 8, bottom - top - 6);
    g.lineStyle(1, 0xc89a1a).strokeRect(x + 7, top + 6, w - 14, bottom - top - 12);
  }
  // the bands behind the title and the keys line, as on the rug
  g.fillStyle(0x000000, 0.6).fillRect(x + 1, y + 1, w - 2, 21).fillRect(x + 1, y + h - 14, w - 2, 13);
  const out: Phaser.GameObjects.GameObject[] = [g];
  if (floor === 'velvet') {
    // the glass: two faint diagonal reflections over everything
    const glass = s.add.graphics();
    for (const [x0, wd] of [[60, 18], [96, 6], [220, 14]] as const) {
      glass.fillStyle(0xffffff, 0.06).fillPoints([
        { x: x + x0, y: top }, { x: x + x0 + wd, y: top }, { x: x + x0 + wd - 40, y: bottom }, { x: x + x0 - 40, y: bottom },
      ], true);
    }
    out.push(glass);
  }
  return out;
}
