import Phaser from 'phaser';
import { CATALOG, RINGS, RARITY_ORDER, STAGES, type CatalogId } from '../game/rules';
import { loadSave, updateSave } from '../save';

// Generates all sprites in code (no art files yet). Real art goes in public/media/ (see its
// README): load it under the same texture key and delete the matching tex(...) call.
//
// Dev hooks (URL parameters), to jump to one moment without playing up to it:
//   ?scene=intro | village | treasury | menu
//   ?play            start the fight right away (no landing)
//     &t=30500       fight clock in ms (30500 = the fisherman is there)
//     &stage=3       start the boss in stage 2 or 3
//     &shop          open the fisherman's shop as soon as he is there
//     &dead          the boss is already beaten: the key is on the floor
//     &lose          lose at once: watch Mossback bounce you back to the village
//   &wallet=10,2,1   put rings in the wallet (classic, rare, super rare). Writes the save!
//   &kit=all         own everything in the chart (sword, bow, steel equipped). Writes the save!
//   ?scene=village&merchant   open the ring merchant's shop at once
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const tex = (key: string, w: number, h: number, draw: () => void) => { g.clear(); draw(); g.generateTexture(key, w, h); };
    const px = (color: number, x: number, y: number, w = 1, h = 1, alpha = 1) => g.fillStyle(color, alpha).fillRect(x, y, w, h);
    const GOLD = 0xffcc44;

    // Hero 8x10: hair, face, blue tunic, belt, legs.
    tex('player', 8, 10, () => {
      px(0x5a3a1a, 1, 0, 6, 2); px(0xf2c79a, 1, 2, 6, 3); px(0x000000, 2, 3); px(0x000000, 5, 3);
      px(0x3a7bd5, 1, 5, 6, 3); px(0x6b4a2b, 1, 7, 6, 1); px(0x2b2b3a, 1, 8, 2, 2); px(0x2b2b3a, 5, 8, 2, 2);
    });
    // Facing directions (the arena picks one from the aim): 'player' faces down,
    // 'player_up' shows the back of his head, 'player_side' is a profile facing right.
    tex('player_up', 8, 10, () => {
      px(0x5a3a1a, 1, 0, 6, 5);
      px(0x3a7bd5, 1, 5, 6, 3); px(0x6b4a2b, 1, 7, 6, 1); px(0x2b2b3a, 1, 8, 2, 2); px(0x2b2b3a, 5, 8, 2, 2);
    });
    tex('player_side', 8, 10, () => {
      px(0x5a3a1a, 1, 0, 6, 2); px(0x5a3a1a, 1, 2, 2, 2); px(0xf2c79a, 3, 2, 4, 3); px(0x000000, 5, 3);
      px(0x3a7bd5, 2, 5, 5, 3); px(0x6b4a2b, 2, 7, 5, 1); px(0x2b2b3a, 2, 8, 2, 2); px(0x2b2b3a, 5, 8, 2, 2);
    });

    // Boss 24x24, one sprite per stage colour, with the treasury key on a cord around his neck.
    // Baked colours, not setTint: the Canvas renderer (no WebGL) ignores tints.
    const boss = (key: string, body: number, flash: boolean, withKey: boolean) => tex(key, 24, 24, () => {
      g.fillStyle(body).fillCircle(12, 12, 10);
      px(body, 3, 0, 3, 5); px(body, 18, 0, 3, 5);                   // horns
      if (flash) return;
      px(0x000000, 7, 8, 3, 4); px(0x000000, 14, 8, 3, 4);           // eyes
      px(0xffffff, 8, 9); px(0xffffff, 15, 9);
      px(0x000000, 8, 15, 8, 2); px(0xffffff, 9, 15); px(0xffffff, 14, 15);
      if (!withKey) return;
      px(0x2b1a10, 7, 18); px(0x2b1a10, 8, 19); px(0x2b1a10, 9, 20);  // cord
      px(0x2b1a10, 16, 18); px(0x2b1a10, 15, 19); px(0x2b1a10, 14, 20);
      px(GOLD, 10, 20, 4, 2); px(0x000000, 11, 20, 2, 1);              // key bow
      px(GOLD, 11, 22, 2, 2); px(0xfff1a8, 10, 20);                    // shaft + shine
    });
    for (const s of [1, 2, 3] as const) boss(`boss_${s}`, STAGES[s].color, false, true);
    boss('boss_flash', 0xffffff, true, false);
    boss('boss_nokey', STAGES[3].color, false, false);

    tex('key', 9, 5, () => { px(GOLD, 0, 0, 4, 5); px(0x000000, 1, 1, 2, 3); px(GOLD, 4, 2, 5, 1); px(GOLD, 6, 3, 1, 2); px(GOLD, 8, 3, 1, 2); px(0xfff1a8, 0, 0); });
    tex('bullet', 4, 4, () => { g.fillStyle(0xff4f7a).fillCircle(2, 2, 2); px(0xffffff, 1, 1); });
    tex('arrow', 8, 3, () => { px(0xd9c08c, 1, 1, 5, 1); px(0xe0e0e0, 6, 0, 2, 3); px(0xff4444, 0, 0, 1, 3); });
    tex('bomb', 6, 6, () => { g.fillStyle(0x222233).fillCircle(3, 3, 3); px(0x666688, 1, 1); px(0xffaa33, 4, 0); });
    tex('blast', 48, 48, () => { g.fillStyle(0xffaa33, 0.9).fillCircle(24, 24, 22); g.fillStyle(0xffffff, 0.8).fillCircle(24, 24, 11); });
    tex('slash', 20, 20, () => { g.lineStyle(3, 0xffffff, 1).beginPath().arc(10, 10, 8, -1.1, 1.1).strokePath(); });
    tex('punch', 8, 8, () => { g.fillStyle(0xffffff, 0.9).fillCircle(4, 4, 3); });

    // Aim: a crosshair (white; red when an attack now would hit), and each weapon held in hand,
    // drawn pointing right so rotating it points it at the cursor.
    const cross = (key: string, c: number) => tex(key, 9, 9, () => {
      px(0x000000, 3, 0, 3, 9, 0.6); px(0x000000, 0, 3, 9, 3, 0.6);      // dark outline: readable on any ground
      px(c, 4, 0, 1, 3); px(c, 4, 6, 1, 3); px(c, 0, 4, 3, 1); px(c, 6, 4, 3, 1);
      px(c, 4, 4);
    });
    cross('crosshair', 0xffffff);
    cross('crosshair_hot', 0xff5a5a);
    // Each weapon held in hand, drawn pointing right: rotating it points it at the cursor.
    const WOOD = 0x8a6a3a;
    const DARKWOOD = 0x6b4a2b;
    const STEEL = 0xdddddd;
    const IRON = 0x9a9aa8;
    tex('held_fists', 4, 4, () => { px(0xf2c79a, 0, 0, 4, 4); px(0xd9a87a, 0, 3, 4, 1); });
    tex('held_dagger', 8, 3, () => { px(DARKWOOD, 0, 1, 2, 1); px(GOLD, 2, 0, 1, 3); px(STEEL, 3, 1, 4, 1); px(0xffffff, 7, 1); });
    tex('held_sword', 12, 3, () => { px(DARKWOOD, 0, 1, 3, 1); px(GOLD, 3, 0, 1, 3); px(STEEL, 4, 1, 7, 1); px(0xffffff, 11, 1); px(0xaaaaaa, 4, 2, 7, 1, 0.6); });
    tex('held_axe', 12, 7, () => { px(WOOD, 0, 3, 9, 1); px(IRON, 8, 0, 3, 7); px(STEEL, 11, 1, 1, 5); });
    tex('held_mace', 12, 7, () => { px(WOOD, 0, 3, 8, 1); g.fillStyle(IRON).fillCircle(9, 3, 3); px(STEEL, 9, 0); px(STEEL, 9, 6); px(STEEL, 12 - 1, 3); });
    tex('held_warHammer', 14, 8, () => { px(WOOD, 0, 3, 10, 2); px(IRON, 9, 0, 5, 8); px(STEEL, 13, 1, 1, 6); });
    tex('held_spear', 22, 3, () => { px(WOOD, 0, 1, 17, 1); px(STEEL, 17, 0, 3, 3); px(0xffffff, 20, 1, 2, 1); });
    tex('held_sling', 7, 5, () => { px(DARKWOOD, 0, 2, 3, 1); px(0xc8a86a, 3, 0, 1, 5); px(0x888888, 4, 1, 3, 3); });
    tex('held_javelin', 16, 3, () => { px(WOOD, 0, 1, 12, 1); px(STEEL, 12, 0, 3, 3); px(0xffffff, 15, 1); });
    tex('held_bow', 5, 10, () => { px(WOOD, 0, 0, 2, 1); px(WOOD, 2, 1, 1, 2); px(WOOD, 3, 3, 1, 4); px(WOOD, 2, 7, 1, 2); px(WOOD, 0, 9, 2, 1); px(0xeeeeee, 0, 1, 1, 8, 0.8); });
    tex('held_crossbow', 10, 9, () => { px(DARKWOOD, 0, 4, 9, 1); px(WOOD, 7, 0, 1, 9); px(0xeeeeee, 6, 1, 1, 7, 0.8); px(IRON, 9, 3, 1, 3); });
    tex('held_handCannon', 12, 5, () => { px(WOOD, 0, 2, 4, 2); px(0x555560, 4, 1, 8, 3); px(0x333338, 11, 1, 1, 3); px(0xffaa33, 5, 0); });

    // Projectiles (drawn flying right).
    tex('proj_sling', 3, 3, () => { px(0x999999, 0, 0, 3, 3); px(0xcccccc, 0, 0); });
    tex('proj_javelin', 12, 3, () => { px(WOOD, 0, 1, 9, 1); px(STEEL, 9, 0, 3, 3); });
    tex('proj_bow', 8, 3, () => { px(0xd9c08c, 1, 1, 5, 1); px(0xe0e0e0, 6, 0, 2, 3); px(0xff4444, 0, 0, 1, 3); });
    tex('proj_crossbow', 7, 3, () => { px(0x8a6a3a, 0, 1, 5, 1); px(IRON, 5, 0, 2, 3); });
    tex('proj_handCannon', 4, 4, () => { g.fillStyle(0x222228).fillCircle(2, 2, 2); px(0x777788, 1, 1); });
    tex('proj_fireball', 7, 7, () => { g.fillStyle(0xff5a1a).fillCircle(3, 3, 3); g.fillStyle(0xffcc44).fillCircle(4, 3, 2); px(0xffffff, 4, 3); });
    tex('proj_freeze', 7, 7, () => { px(0x9fe8ff, 3, 0, 1, 7); px(0x9fe8ff, 0, 3, 7, 1); px(0xffffff, 3, 3); px(0x9fe8ff, 1, 1); px(0x9fe8ff, 5, 5); px(0x9fe8ff, 1, 5); px(0x9fe8ff, 5, 1); });
    tex('proj_poison', 6, 6, () => { g.fillStyle(0x6fd13a).fillCircle(3, 3, 3); px(0xc8ff88, 2, 1); px(0x2f6b2f, 4, 4); });

    // Special icons 9x9 (HUD and shop).
    const icon = (key: string, bg: number, draw: () => void) => tex(key, 9, 9, () => { px(0x000000, 0, 0, 9, 9, 0.7); px(bg, 1, 1, 7, 7); draw(); });
    icon('icon_fireball', 0x5a1a0a, () => { g.fillStyle(0xff5a1a).fillCircle(4, 5, 2); px(0xffcc44, 4, 2); px(0xffcc44, 3, 3); });
    icon('icon_freeze', 0x0a2a3a, () => { px(0x9fe8ff, 4, 1, 1, 7); px(0x9fe8ff, 1, 4, 7, 1); px(0xffffff, 4, 4); });
    icon('icon_poison', 0x1a3a0a, () => { px(0x6fd13a, 3, 2, 3, 5); px(0x6fd13a, 2, 4, 5, 2); px(0xc8ff88, 3, 3); });
    icon('icon_paralysis', 0x3a3a0a, () => { px(0xffee44, 5, 1, 2, 1); px(0xffee44, 4, 2, 2, 2); px(0xffee44, 3, 4, 3, 1); px(0xffee44, 3, 5, 2, 2); px(0xffee44, 2, 7, 1, 1); });
    icon('icon_push', 0x1a1a3a, () => { px(0xffffff, 1, 4, 5, 1); px(0xffffff, 5, 2, 1, 5); px(0xffffff, 6, 3, 1, 3); px(0xffffff, 7, 4); });
    icon('icon_healthSuck', 0x3a0a14, () => { px(0xe03a4a, 2, 2, 2, 2); px(0xe03a4a, 5, 2, 2, 2); px(0xe03a4a, 2, 4, 5, 2); px(0xe03a4a, 3, 6, 3, 1); px(0x6fd13a, 4, 1, 1, 6); });
    icon('icon_bomb', 0x2a1a0a, () => { g.fillStyle(0x222233).fillCircle(4, 5, 3); px(0xffaa33, 6, 1); px(0x666688, 3, 4); });
    icon('icon_shield', 0x0a1a3a, () => { px(0x6aa8ff, 2, 1, 5, 4); px(0x6aa8ff, 3, 5, 3, 2); px(0x6aa8ff, 4, 7); px(0xffffff, 4, 2, 1, 3); });

    // Armor icons: a chest plate in the metal's colour.
    const ARMOR_COLORS: Record<string, number> = { leather: 0x8a5a2b, copper: 0xc87533, bronze: 0xcd9b4a, chainmail: 0xa0a0a8, iron: 0x7a7a84, steel: 0xd8dde6, magnetite: 0x3a3a50 };
    for (const [id, c] of Object.entries(ARMOR_COLORS)) {
      tex(`icon_${id}`, 9, 9, () => { px(0x000000, 0, 0, 9, 9, 0.7); px(c, 1, 1, 2, 2); px(c, 6, 1, 2, 2); px(c, 2, 2, 5, 6); px(0x000000, 4, 3, 1, 4, 0.3); px(0xffffff, 3, 3, 1, 1, 0.5); });
    }
    tex('dust', 4, 4, () => { g.fillStyle(0xd8d0c0, 0.9).fillCircle(2, 2, 2); });
    tex('shadow', 10, 4, () => { g.fillStyle(0x000000, 0.45).fillEllipse(5, 2, 10, 4); });
    tex('sparkle', 5, 5, () => { px(0xffffff, 2, 0, 1, 5); px(0xffffff, 0, 2, 5, 1); px(GOLD, 2, 2); });

    for (const r of RARITY_ORDER) {
      const c = RINGS[r].color;
      tex(`ring_${r}`, 7, 7, () => {
        px(c, 2, 0, 3, 1); px(c, 2, 6, 3, 1); px(c, 0, 2, 1, 3); px(c, 6, 2, 1, 3);
        px(c, 1, 1); px(c, 5, 1); px(c, 1, 5); px(c, 5, 5); px(0xffffff, 3, 0);
      });
    }

    // Fisherman 14x18: straw hat, white beard, green coat, boots, fishing rod.
    tex('fisher', 14, 18, () => {
      px(0xe8c34a, 3, 0, 8, 2); px(0xc9a136, 1, 2, 12, 1); px(0xf2c79a, 4, 3, 6, 3); px(0x000000, 5, 4); px(0x000000, 8, 4);
      px(0xdddddd, 4, 6, 6, 3); px(0x2f6f5e, 3, 9, 8, 6); px(0x3a2a1a, 4, 15, 2, 3); px(0x3a2a1a, 8, 15, 2, 3);
      px(0x8a6a3a, 12, 1, 1, 13); px(0xcccccc, 13, 1, 1, 9, 0.7);
    });

    // ---- treasury ----
    tex('chest', 14, 11, () => { px(0x5a3a1a, 0, 2, 14, 9); px(0x7a5230, 1, 3, 12, 7); px(0x5a3a1a, 0, 0, 14, 3); px(GOLD, 0, 3, 14, 1); px(GOLD, 6, 4, 2, 3); px(0x000000, 6, 5, 2, 1); });
    tex('chest_open', 14, 13, () => { px(0x5a3a1a, 0, 0, 14, 3); px(0x2a1a0a, 1, 3, 12, 2); px(GOLD, 2, 4, 10, 1, 0.9); px(0x5a3a1a, 0, 4, 14, 9); px(0x7a5230, 1, 5, 12, 7); px(GOLD, 0, 5, 14, 1); });
    tex('torch', 3, 8, () => { px(0x6b4a2b, 1, 3, 1, 5); px(0xffaa33, 0, 1, 3, 2); px(0xffee88, 1, 0, 1, 2); });
    tex('door', 12, 16, () => { px(0x55555f, 0, 0, 12, 16); px(0x3a2a1a, 2, 3, 8, 13); px(0x2a1a0a, 5, 3, 2, 13); px(GOLD, 8, 9); });
    tex('door_open', 12, 16, () => { px(0x55555f, 0, 0, 12, 16); px(0x000000, 2, 3, 8, 13); px(0x1a1a24, 3, 4, 6, 12); });

    // ---- village ----
    tex('house', 30, 26, () => {
      for (let i = 0; i < 10; i++) px(0xa0402f, 10 - i, i, 10 + i * 2, 1);   // roof
      px(0x7a2f22, 0, 9, 30, 1);
      px(0xe8d8b0, 2, 10, 26, 16); px(0x6b4a2b, 12, 16, 6, 10); px(GOLD, 16, 21);
      px(0x9fd3ff, 5, 13, 5, 4); px(0x9fd3ff, 20, 13, 5, 4); px(0x6b4a2b, 7, 13, 1, 4); px(0x6b4a2b, 22, 13, 1, 4);
    });
    tex('tree', 14, 18, () => { g.fillStyle(0x2f6b2f).fillCircle(7, 6, 6); g.fillStyle(0x3f8a3a).fillCircle(5, 5, 3); px(0x5a3a1a, 6, 11, 2, 7); });
    tex('merchant', 10, 14, () => { px(0x6a3fa0, 1, 0, 8, 3); px(0xf2c79a, 2, 3, 6, 4); px(0x000000, 3, 4); px(0x000000, 6, 4); px(0x8a5fc0, 1, 7, 8, 7); px(GOLD, 4, 9, 2, 2); });
    tex('stall', 40, 20, () => {
      for (let i = 0; i < 8; i++) px(i % 2 ? 0xffffff : 0xd83a3a, i * 5, 0, 5, 5);                     // awning
      px(0x6b4a2b, 1, 5, 2, 15); px(0x6b4a2b, 37, 5, 2, 15); px(0x8a6a3a, 0, 12, 40, 8); px(0x6b4a2b, 0, 12, 40, 1);
      for (let i = 0; i < 5; i++) px([0xc8c8d0, 0x44aaff, 0xff55dd, 0xc8c8d0, 0x44aaff][i], 6 + i * 6, 10, 3, 2);  // rings on the counter
    });
    tex('sign', 16, 12, () => { px(0x8a6a3a, 0, 0, 16, 7); px(0x6b4a2b, 7, 7, 2, 5); px(0x3a2a1a, 3, 3, 8, 1); px(0x3a2a1a, 10, 2, 2, 3); px(0x3a2a1a, 12, 3); });
    // The bar: a wide timber building with a hanging mug sign; the barkeeper wears an apron.
    tex('bar', 50, 34, () => {
      for (let i = 0; i < 10; i++) px(0x5a3a2a, 10 - i, i, 30 + i * 2, 1);            // roof
      px(0x3a2418, 0, 10, 50, 1);
      px(0x8a6040, 2, 11, 46, 23); px(0x6b4a2b, 2, 11, 46, 1);                          // timber walls
      for (let x = 2; x < 48; x += 8) px(0x6b4a2b, x, 11, 1, 23);
      px(0x3a2418, 20, 20, 10, 14); px(0x2a1810, 24, 20, 1, 14); px(GOLD, 28, 27);       // double door
      px(0xffd27a, 6, 16, 8, 6); px(0xffd27a, 36, 16, 8, 6);                            // warm windows
      px(0x6b4a2b, 10, 16, 1, 6); px(0x6b4a2b, 40, 16, 1, 6);
    });
    tex('barkeeper', 10, 14, () => { px(0x3a2418, 2, 0, 6, 2); px(0xf2c79a, 2, 2, 6, 4); px(0x000000, 3, 3); px(0x000000, 6, 3); px(0x5a3a2a, 2, 5, 6, 1); px(0x8a3a3a, 1, 6, 8, 8); px(0xeeeeee, 3, 7, 4, 7); });
    tex('mug', 9, 9, () => { px(0x000000, 0, 0, 9, 9, 0.7); px(0xc89a3a, 2, 3, 4, 5); px(0xffffff, 2, 2, 4, 2); px(0xc89a3a, 6, 4, 1, 3); px(0x8a6a2a, 2, 7, 4, 1); });
    tex('drop', 2, 2, () => { px(0x6ab8ff, 0, 0, 2, 2); });
    tex('catapult_base', 26, 14, () => { px(0x6b4a2b, 0, 8, 26, 3); px(0x6b4a2b, 10, 0, 3, 9); px(0x8a6a3a, 11, 0, 1, 9); g.fillStyle(0x3a2a1a).fillCircle(4, 11, 3).fillCircle(21, 11, 3); px(0x999999, 4, 11); px(0x999999, 21, 11); });
    tex('catapult_arm', 28, 7, () => { px(0x8a6a3a, 0, 2, 22, 2); px(0x6b4a2b, 20, 0, 8, 1); px(0x6b4a2b, 20, 0, 1, 7); px(0x6b4a2b, 27, 0, 1, 7); px(0x6b4a2b, 20, 6, 8, 1); });
    g.destroy();

    // ---- dev hooks ----
    const q = new URLSearchParams(window.location.search);
    const wallet = q.get('wallet')?.split(',').map(Number);
    if (wallet && wallet.length === 3 && wallet.every((n) => Number.isFinite(n) && n >= 0)) {
      updateSave((s) => ({ ...s, wallet: { classic: wallet[0], rare: wallet[1], superRare: wallet[2] } }));
    }
    if (q.get('kit') === 'all') {
      updateSave((s) => ({ ...s, inventory: { owned: CATALOG.map((i) => i.id as CatalogId), melee: 'sword', range: 'bow', armor: 'steel' } }));
    }
    const scene = q.get('scene');
    if (q.has('play')) {
      this.scene.start('play', { startMs: Number(q.get('t') ?? 0), stage: Number(q.get('stage') ?? 1), openShop: q.has('shop'), bossDead: q.has('dead'), lose: q.has('lose'), landing: false });
    } else if (scene && ['intro', 'village', 'treasury', 'menu'].includes(scene)) {
      this.scene.start(scene, scene === 'treasury' ? { found: [], wallet: loadSave().wallet, timeMs: 60_000 } : { openShop: q.has('merchant') });
    } else {
      this.scene.start('menu');
    }
  }
}
