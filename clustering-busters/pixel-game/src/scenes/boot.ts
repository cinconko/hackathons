import Phaser from 'phaser';
import { CATALOG, RINGS, RARITY_ORDER, STAGES, type ArmorId, type CatalogId } from '../game/rules';
import { mediaStatus, ROBES } from '../media';
import { loadSave, updateSave } from '../save';

// Draws a placeholder for every sprite that has no file in public/media/sprites (see its README).
// A file named <key>.png replaces the placeholder with the same key: no code change needed.
//
// Dev hooks (URL parameters), to jump to one moment without playing up to it:
//   ?scene=intro | village | treasury | menu | media   (media = the art and sound checklist)
//   ?play            start the fight right away (no landing)
//     &t=30500       fight clock in ms (30500 = the fisherman is there)
//     &stage=3       start the boss in stage 2 or 3
//     &shop          open the fisherman's shop as soon as he is there
//     &dead          the boss is already beaten: the key is on the floor
//     &lose          lose at once: watch Mossback bounce you back to the village
//   &wallet=10,2,1   put rings in the wallet (classic, rare, super rare). Writes the save!
//   &kit=all         own everything in the chart (sword, bow, steel equipped). Writes the save!
//   ?scene=village&merchant   open the ring merchant's shop at once (&nodeal: cards already on the table)
//   ?scene=village&yard       start inside the training yard, weapon out
//   ?scene=village&tutorial   start Sergeant Brann's combat training (normally once, after the cutscene)
//   &spent=800       rings spent in the village (its level); &seen=N = levels already watched. Writes the save!
/**
 * The boss's six hands, in boss_art.png pixels (32x35): the box around each hand and the way
 * "out" (away from his body). A hand frame moves each hand along it: +1 reaches out (drawn over
 * the drawing, so the hand just looks longer), -1 pulls it in over the end of its arm.
 */
const BOSS_W = 32;
const BOSS_H = 35;
const BOSS_PAD = 2;   // room around the picture for a hand reaching past its edge
const BOSS_HANDS: { box: [number, number, number, number]; out: [number, number] }[] = [
  { box: [8, 0, 12, 2], out: [0, -1] },     // top left claw
  { box: [20, 1, 23, 3], out: [0, -1] },    // top right claw
  { box: [0, 7, 3, 11], out: [-1, 0] },     // far left
  { box: [27, 8, 31, 11], out: [1, 0] },    // far right
  { box: [5, 16, 9, 20], out: [-1, 1] },    // lower left claw
  { box: [25, 14, 28, 17], out: [1, 0] },   // lower right
];
/** Per hand (same order): how far it moves. Played by the arena (play.ts, bossHands). */
const HAND_FRAMES: Record<string, number[]> = {
  a: [0, 0, 0, 0, 0, 0],                  // as drawn
  b: [1, -1, -1, 1, 1, -1],               // writhing: every other hand reaches
  c: [-1, 1, 1, -1, -1, 1],               // ... and the others
  spread: [1, 1, 2, 2, 1, 1],             // all out: puffing up for the ring, smashing
  grab: [-1, -1, -1, -1, -1, -1],         // all in: winding up a shot or a charge
};

/** One hand frame: the picture padded by BOSS_PAD, each hand moved along its "out". */
function moveHands(src: ImageData, shifts: number[]): ImageData {
  const W = src.width + BOSS_PAD * 2;
  const H = src.height + BOSS_PAD * 2;
  const out = new ImageData(W, H);
  for (let y = 0; y < src.height; y++) {
    out.data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((y + BOSS_PAD) * W + BOSS_PAD) * 4);
  }
  const at = (x: number, y: number) => ((y + BOSS_PAD) * W + x + BOSS_PAD) * 4;
  BOSS_HANDS.forEach(({ box: [x0, y0, x1, y1], out: [ox, oy] }, i) => {
    const n = shifts[i] ?? 0;
    if (!n) return;
    const hand: [number, number, Uint8ClampedArray][] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = (y * src.width + x) * 4;
      if (src.data[p + 3] > 0) hand.push([x, y, src.data.slice(p, p + 4)]);
    }
    if (n < 0) for (const [x, y] of hand) out.data.fill(0, at(x, y), at(x, y) + 4);   // pulled in: lift it off first
    for (const [x, y, px] of hand) {
      const nx = x + ox * n;
      const ny = y + oy * n;
      if (nx < -BOSS_PAD || ny < -BOSS_PAD || nx >= src.width + BOSS_PAD || ny >= src.height + BOSS_PAD) continue;
      out.data.set(px, at(nx, ny));
    }
  });
  return out;
}

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    this.weaponArt();
    this.bossArt();
    this.campfireArt();
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // A sprite from public/media (loaded by the preload scene) wins; otherwise draw the placeholder.
    const tex = (key: string, w: number, h: number, draw: () => void) => {
      if (this.textures.exists(key)) { mediaStatus.fromFiles.add(key); return; }
      mediaStatus.placeholders.set(key, { w, h });
      g.clear(); draw(); g.generateTexture(key, w, h);
    };
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
    tex('tree_apple', 14, 18, () => { g.fillStyle(0x2f6b2f).fillCircle(7, 6, 6); g.fillStyle(0x3f8a3a).fillCircle(5, 5, 3); px(0x5a3a1a, 6, 11, 2, 7); px(0xd83a3a, 3, 7); px(0xd83a3a, 9, 4); px(0xd83a3a, 10, 9); });
    // bushes (village decoration), the berry ones with red dots
    const bush = (key: string, w: number, h: number, berries: boolean) => tex(key, w, h, () => {
      g.fillStyle(0x2f6b2f).fillEllipse(w / 2, h / 2 + 1, w, h - 2); g.fillStyle(0x3f8a3a).fillEllipse(w / 2 - 2, h / 2, w - 8, h - 5);
      if (berries) for (let i = 0; i < 4; i++) px(0xd83a3a, 3 + i * Math.floor((w - 6) / 4), 3 + (i % 2) * 3);
    });
    bush('bush_big', 19, 11, false);
    bush('bush_big_berry', 19, 11, true);
    bush('bush_mid', 23, 10, false);
    bush('bush_mid_berry', 23, 10, true);
    // textures the game repeats: village grass, arena pond water, treasury planks
    tex('grass', 8, 8, () => { px(0x4f8a3a, 0, 0, 8, 8); px(0x5c9a44, 1, 2); px(0x5c9a44, 5, 5); px(0x3f7a30, 6, 1); });
    // village paths: dirt, then cobblestone, then stone brick as the village grows
    tex('path_dirt', 8, 8, () => { px(0xc8a86a, 0, 0, 8, 8); px(0xb8985a, 1, 2, 2, 1); px(0xb8985a, 5, 6, 2, 1); px(0xd8bc80, 4, 3); });
    tex('path_cobble', 8, 8, () => { px(0x3a3a3a, 0, 0, 8, 8); px(0x8a8a8a, 0, 0, 3, 3); px(0x7a7a7a, 4, 0, 4, 3); px(0x7a7a7a, 0, 4, 4, 4); px(0x8a8a8a, 5, 4, 3, 4); });
    tex('path_brick', 8, 8, () => { px(0x4a4a55, 0, 0, 8, 8); px(0x8a8a99, 0, 0, 7, 3); px(0x8a8a99, 0, 4, 3, 3); px(0x8a8a99, 4, 4, 4, 3); });
    tex('water', 8, 8, () => { px(0x1e4f7a, 0, 0, 8, 8); px(0x2d6fa3, 1, 2, 3, 1); px(0x2d6fa3, 4, 6, 3, 1); });
    tex('floor_wood', 8, 8, () => { px(0x8a6040, 0, 0, 8, 8); px(0x6b4a2b, 3, 0, 1, 8); px(0x6b4a2b, 7, 0, 1, 8); px(0x5a3a1a, 0, 5, 3, 1); });
    tex('wall_wood', 8, 8, () => { px(0x7a5230, 0, 0, 8, 8); px(0x5a3a1a, 0, 3, 8, 1); px(0x5a3a1a, 0, 7, 8, 1); });
    // the intro's catapult shot: sky and a cloud
    tex('sky', 8, 8, () => { px(0x87c4ff, 0, 0, 8, 8); });
    tex('cloud', 24, 19, () => { g.fillStyle(0xffffff).fillCircle(9, 11, 7).fillCircle(16, 10, 6).fillCircle(12, 6, 5); });
    tex('merchant', 10, 14, () => { px(0x6a3fa0, 1, 0, 8, 3); px(0xf2c79a, 2, 3, 6, 4); px(0x000000, 3, 4); px(0x000000, 6, 4); px(0x8a5fc0, 1, 7, 8, 7); px(GOLD, 4, 9, 2, 2); });
    tex('stall', 40, 20, () => {
      for (let i = 0; i < 8; i++) px(i % 2 ? 0xffffff : 0xd83a3a, i * 5, 0, 5, 5);                     // awning
      px(0x6b4a2b, 1, 5, 2, 15); px(0x6b4a2b, 37, 5, 2, 15); px(0x8a6a3a, 0, 12, 40, 8); px(0x6b4a2b, 0, 12, 40, 1);
      for (let i = 0; i < 5; i++) px([0xc8c8d0, 0x44aaff, 0xff55dd, 0xc8c8d0, 0x44aaff][i], 6 + i * 6, 10, 3, 2);  // rings on the counter
    });
    tex('sign', 16, 12, () => { px(0x8a6a3a, 0, 0, 16, 7); px(0x6b4a2b, 7, 7, 2, 5); px(0x3a2a1a, 3, 3, 8, 1); px(0x3a2a1a, 10, 2, 2, 3); px(0x3a2a1a, 12, 3); });
    // The bar: a wide timber building with a hanging mug sign; the barkeeper wears an apron.
    // the tavern: a timber-framed house, whitewashed walls between dark beams, a straw thatch roof,
    // a stone chimney, an arched plank door, small leaded windows and a hanging sign with a mug
    tex('bar', 50, 34, () => {
      const BEAM = 0x3a2414, PLASTER = 0xe6dcc2, THATCH = 0xc49a52, THATCH_DARK = 0x8a6a32;
      px(0x7a7a84, 37, 0, 5, 7); px(0x9a9aa4, 37, 0, 5, 1); px(0x5a5a64, 39, 2, 1, 1); px(0x5a5a64, 37, 4, 1, 1);   // chimney
      for (let i = 0; i < 11; i++) px(THATCH, 11 - i, 2 + i, 28 + i * 2, 1);                                         // thatch roof
      for (let i = 0; i < 11; i += 2) for (let x = 12 - i; x < 39 + i; x += 3) px(THATCH_DARK, x, 2 + i, 1, 1);     // straw strokes
      px(THATCH_DARK, 0, 12, 50, 1);                                                                                // eave
      px(PLASTER, 2, 13, 46, 21);                                                                                   // walls
      px(BEAM, 2, 13, 46, 1); px(BEAM, 2, 22, 46, 1); px(BEAM, 2, 33, 46, 1);                                       // beams
      for (const x of [2, 15, 34, 47]) px(BEAM, x, 13, 1, 21);                                                      // posts
      for (let i = 0; i < 10; i++) { px(BEAM, 3 + i, 23 + i, 1, 1); px(BEAM, 14 - i, 23 + i, 1, 1); px(BEAM, 35 + i, 23 + i, 1, 1); px(BEAM, 46 - i, 23 + i, 1, 1); }   // X braces
      for (const wx of [6, 38]) {                                                                                   // leaded windows, warm light
        px(0xffd27a, wx, 15, 6, 6); px(BEAM, wx - 1, 14, 8, 1); px(BEAM, wx - 1, 21, 8, 1);
        px(0xb8862a, wx + 2, 15, 1, 6); px(0xb8862a, wx, 17, 6, 1); px(0xfff1b8, wx + 1, 16);
      }
      px(0x5a3a22, 19, 21, 12, 13); px(0x5a3a22, 20, 20, 10, 1); px(0x5a3a22, 21, 19, 8, 1);                        // arched door
      for (const x of [22, 25, 28]) px(0x4a2e1a, x, 20, 1, 14);                                                     // planks
      px(0x2a2a2a, 19, 24, 5, 1); px(0x2a2a2a, 19, 30, 5, 1); px(GOLD, 27, 27);                                     // iron hinges, handle
      px(BEAM, 32, 15, 6, 1); px(BEAM, 33, 16, 1, 2); px(BEAM, 37, 16, 1, 2);                                       // the sign's bracket...
      px(0x8a6040, 32, 18, 7, 5); px(0x5a3a22, 32, 18, 7, 1);                                                       // ...the board...
      px(0xeeeeee, 34, 19, 2, 3); px(0xd89a2a, 34, 20, 2, 2); px(0xeeeeee, 36, 20, 1, 1);                           // ...and its mug
    });
    tex('barkeeper', 10, 14, () => { px(0x3a2418, 2, 0, 6, 2); px(0xf2c79a, 2, 2, 6, 4); px(0x000000, 3, 3); px(0x000000, 6, 3); px(0x5a3a2a, 2, 5, 6, 1); px(0x8a3a3a, 1, 6, 8, 8); px(0xeeeeee, 3, 7, 4, 7); });
    // the bar's big mugs (the team's art replaces them): full, half poured, knocked over
    const glass = (key: string, h: number, beer: number) => tex(key, 21, h, () => {
      px(0xdddddd, 0, 0, 16, h); px(0x2a2a2a, 1, 1, 14, h - 2); px(0xd89a2a, 1, h - 1 - beer, 14, beer); px(0xdddddd, 16, 6, 4, 9); px(0x2a2a2a, 17, 8, 2, 5);
    });
    glass('beer_full', 24, 18);
    glass('beer_half', 21, 9);
    tex('beer_spilled', 26, 16, () => { px(0xdddddd, 0, 2, 20, 12); px(0x2a2a2a, 1, 3, 18, 10); px(0xd89a2a, 14, 13, 12, 3); });
    tex('mug', 9, 9, () => { px(0x000000, 0, 0, 9, 9, 0.7); px(0xc89a3a, 2, 3, 4, 5); px(0xffffff, 2, 2, 4, 2); px(0xc89a3a, 6, 4, 1, 3); px(0x8a6a2a, 2, 7, 4, 1); });
    tex('drop', 2, 2, () => { px(0x6ab8ff, 0, 0, 2, 2); });
    // ---- what the village builds as it grows ----
    tex('house_big', 32, 36, () => {
      for (let i = 0; i < 10; i++) px(0x7a2f22, 11 - i, i, 10 + i * 2, 1);              // roof
      px(0x5a2018, 0, 10, 32, 1);
      px(0xe8d8b0, 2, 11, 28, 25); px(0x8a6040, 2, 22, 28, 1);                          // two floors
      px(0x9fd3ff, 5, 13, 5, 5); px(0x9fd3ff, 22, 13, 5, 5); px(0x9fd3ff, 5, 25, 5, 5);
      px(0x6b4a2b, 13, 26, 6, 10); px(GOLD, 17, 31); px(0x6b4a2b, 4, 18, 7, 1); px(0x6b4a2b, 21, 18, 7, 1);
    });
    tex('lantern', 5, 12, () => { px(0x3a3a3a, 2, 3, 1, 9); px(0x3a3a3a, 1, 11, 3, 1); px(0x2a2a2a, 0, 0, 5, 1); px(0xffd27a, 1, 1, 3, 2); });
    tex('flowers', 14, 5, () => { px(0x3f7a30, 0, 2, 14, 3); for (let i = 0; i < 5; i++) px([0xff6a8a, 0xffee44, 0xffffff, 0xff6a8a, 0xa070ff][i], 1 + i * 3, 1, 2, 2); });
    tex('fruitstall', 28, 18, () => {
      for (let i = 0; i < 7; i++) px(i % 2 ? 0xffffff : 0x3a9a3a, i * 4, 0, 4, 4);
      px(0x6b4a2b, 1, 4, 2, 14); px(0x6b4a2b, 25, 4, 2, 14); px(0x8a6a3a, 0, 11, 28, 7);
      for (let i = 0; i < 6; i++) px([0xd83a3a, 0xffaa33, 0xffee44, 0xd83a3a, 0x6fd13a, 0xffaa33][i], 3 + i * 4, 8, 3, 3);
    });
    tex('tower', 18, 34, () => {
      px(0x7a7a84, 2, 8, 14, 26); for (let y = 10; y < 34; y += 5) px(0x6a6a74, 2, y, 14, 1);
      px(0x8a8a94, 0, 4, 18, 5); px(0x8a8a94, 0, 0, 4, 4); px(0x8a8a94, 7, 0, 4, 4); px(0x8a8a94, 14, 0, 4, 4);   // battlements
      px(0x1a1a24, 7, 14, 4, 6); px(0x3a2418, 6, 26, 6, 8);
    });
    tex('flag', 10, 12, () => { px(0x6b4a2b, 0, 0, 1, 12); px(0xffcc44, 1, 0, 8, 2); px(0xd83a3a, 1, 2, 8, 3); px(0xffcc44, 1, 5, 6, 1); });
    tex('statue', 14, 22, () => {
      px(0x8a8a94, 0, 16, 14, 6); px(0x6a6a74, 0, 21, 14, 1);                           // plinth
      px(GOLD, 5, 2, 4, 4); px(0xfff1a8, 5, 2, 1, 1);                                     // head
      px(GOLD, 4, 6, 6, 6); px(GOLD, 4, 12, 2, 4); px(GOLD, 8, 12, 2, 4);                 // body, legs
      px(0xdddddd, 10, 0, 1, 9); px(GOLD, 9, 7, 3, 1);                                    // raised sword
    });
    tex('well_roof', 24, 8, () => { for (let i = 0; i < 6; i++) px(0x8a3a2a, 6 - i, i, 12 + i * 2, 1); px(0x5a2018, 0, 6, 24, 2); });
    const villager = (key: string, shirt: number, hair: number) => tex(key, 8, 10, () => {
      px(hair, 1, 0, 6, 2); px(0xf2c79a, 1, 2, 6, 3); px(0x000000, 2, 3); px(0x000000, 5, 3);
      px(shirt, 1, 5, 6, 3); px(0x2b2b3a, 1, 8, 2, 2); px(0x2b2b3a, 5, 8, 2, 2);
    });
    villager('villager_a', 0xd8823a, 0x2a1a10);
    villager('villager_b', 0x6aa84a, 0xe8c34a);
    // ---- village stages: camp -> tents -> village -> fountains -> rich town -> city ----
    // campfire: crossed logs + three flame frames; level 2 puts a ring of stones around it
    for (const kind of ['wood', 'stone']) for (let i = 0; i < 3; i++) {
      tex(`campfire_${kind}_${i}`, 14, 14, () => {
        px(0x5a3a1a, 1, 11, 12, 2); px(0x6b4a2b, 3, 10, 8, 1);
        if (kind === 'stone') { px(0x777777, 0, 12, 2, 2); px(0x777777, 12, 12, 2, 2); px(0x8a8a8a, 3, 13, 2, 1); px(0x8a8a8a, 9, 13, 2, 1); }
        const h = [7, 9, 8][i];
        px(0xd83a1a, 4, 11 - h, 6, h); px(0xffaa33, 5, 12 - h + (i % 2), 4, h - 2); px(0xffee88, 6, 13 - h + 2, 2, h - 4);
      });
    }
    // fountain: stone basin, water, a jet in two heights
    for (let i = 0; i < 2; i++) {
      tex(`fountain_${i}`, 26, 22, () => {
        g.fillStyle(0x8a8a94).fillEllipse(13, 17, 26, 10); g.fillStyle(0x1e4f7a).fillEllipse(13, 16, 20, 6);
        px(0x8a8a94, 11, 6, 4, 10); px(0x9a9aa4, 9, 6, 8, 2);
        const top = i ? 0 : 2;
        px(0x9fd3ff, 12, top, 2, 6 - top); px(0x9fd3ff, 9 + i, top + 2, 1, 3); px(0x9fd3ff, 16 - i, top + 2, 1, 3);
        px(0xffffff, 12, top); px(0x9fd3ff, 6, 14, 1, 1); px(0x9fd3ff, 19, 14, 1, 1);
      });
    }
    tex('barrel', 10, 12, () => { px(0x6b4a2b, 0, 1, 10, 10); px(0x8a6040, 1, 0, 8, 12); px(0x3a3a3a, 0, 3, 10, 1); px(0x3a3a3a, 0, 8, 10, 1); px(0x999999, 4, 6, 2, 2); });
    // the beer guy (camp) and the barkeeper (bar building): frame 0 mug down, frame 1 mug raised with foam
    const pourer = (key: string, shirt: number, apron: boolean) => {
      for (let i = 0; i < 2; i++) tex(`${key}_${i}`, 12, 14, () => {
        px(0x3a2418, 3, 0, 6, 2); px(0xf2c79a, 3, 2, 6, 4); px(0x000000, 4, 3); px(0x000000, 7, 3); px(0x5a3a2a, 3, 5, 6, 1);
        px(shirt, 2, 6, 8, 8); if (apron) px(0xeeeeee, 4, 7, 4, 7);
        const my = i ? 3 : 8;                          // the mug moves up
        px(0xc89a3a, 9, my, 3, 4); px(0xffffff, 9, my - 1, 3, 1); px(0xf2c79a, 8, my + 1, 1, 2);
      });
    };
    pourer('beerguy', 0x6b5a3a, false);
    pourer('barkeeper', 0x8a3a3a, true);
    // the merchant: frame 1 holds a ring up
    for (let i = 0; i < 2; i++) tex(`merchant_${i}`, 12, 16, () => {
      px(0x6a3fa0, 2, 2, 8, 3); px(0xf2c79a, 3, 5, 6, 4); px(0x000000, 4, 6); px(0x000000, 7, 6); px(0x8a5fc0, 2, 9, 8, 7); px(GOLD, 5, 11, 2, 2);
      if (i) { px(0xf2c79a, 10, 3, 2, 3); px(0x44aaff, 10, 0, 2, 1); px(0x44aaff, 9, 1); px(0x44aaff, 12 - 1, 1); }
      else px(0xf2c79a, 10, 10, 2, 2);
    });
    tex('blanket', 34, 10, () => {
      px(0x9a3a3a, 0, 2, 34, 8); px(0xc85a4a, 1, 3, 32, 6); for (let i = 0; i < 8; i++) px(0xffcc44, 2 + i * 4, 4, 1, 4);
      for (let i = 0; i < 4; i++) px([0xc8c8d0, 0x44aaff, 0xff55dd, 0xc8c8d0][i], 4 + i * 7, 5, 3, 2);
      px(0x6b4a2b, 26, 0, 7, 6); px(0x8a6a3a, 27, 1, 5, 4);          // a crate
    });
    const tent = (key: string, cloth: number, dark: number) => tex(key, 26, 18, () => {
      for (let i = 0; i < 16; i++) px(i < 8 ? cloth : dark, 12 - Math.floor(i * 0.75), 2 + i, 2 + Math.floor(i * 1.5), 1);
      px(0x2a1a10, 11, 10, 4, 8); px(0x6b4a2b, 12, 0, 1, 3);
    });
    tent('tent_a', 0xe8d8b0, 0xc8b890);
    tent('tent_b', 0xd8a86a, 0xb8884a);
    tex('hut', 24, 20, () => {
      for (let i = 0; i < 7; i++) px(0xc8a84a, 7 - i, i, 10 + i * 2, 1);   // straw roof
      px(0x8a6040, 2, 7, 20, 13); for (let y = 8; y < 20; y += 3) px(0x6b4a2b, 2, y, 20, 1);
      px(0x3a2418, 10, 12, 5, 8);
    });
    // rich people: top hat, long coat, a cane
    const noble = (key: string, coat: number, hat: number) => tex(key, 9, 14, () => {
      px(hat, 2, 0, 5, 3); px(hat, 1, 3, 7, 1); px(0xf2c79a, 2, 4, 5, 3); px(0x000000, 3, 5); px(0x000000, 5, 5);
      px(coat, 1, 7, 7, 6); px(GOLD, 4, 8, 1, 4); px(0x2b2b3a, 2, 13, 2, 1); px(0x2b2b3a, 5, 13, 2, 1); px(0x2b1a10, 8, 8, 1, 6);
    });
    noble('noble_a', 0x5a2a8a, 0x1a1a24);
    noble('noble_b', 0x2a4a8a, 0x3a2418);
    // Horse carts, in three views (no rotating a side view: the game is drawn at an angle).
    // Side (cart_*): horse trotting right, a driver with the reins, a cart with crate, barrel, sack.
    // Front (cartf_*): coming toward you, the horse's face and chest, the driver behind it.
    // Back (cartb_*): driving away, the horse's rump and tail, the back of the loaded cart.
    {
      const BR = 0x8a5a32, BRD = 0x6b4426, BRL = 0xa8723f, MANE = 0x2e1c10, HOOF = 0x1e140c;
      const WOOD = 0x9a6a3a, WOODD = 0x6b4a2b, WOODL = 0xb88a4a, WHEEL = 0x3a2414, IRON = 0x8a8a94;
      const HARNESS = 0xa03a2a, SACK = 0xd8c8a0, SKIN = 0xf2c79a, HAT = 0x5a3a1a, SHIRT = 0x3a7bd5, BLAZE = 0xeeeeee;
      const straight = (x: number, top: number, len: number) => { px(BRD, x, top, 2, len); px(HOOF, x, top + len, 2, 1); };
      const lifted = (x: number, top: number) => { px(BRD, x, top, 2, 4); px(BRD, x + 1, top + 4, 2, 2); px(HOOF, x + 1, top + 6, 2, 1); };
      const crate = (x: number, y: number, w: number, h: number) => {
        px(WOODL, x, y, w, h); px(WOODD, x, y, w, 1); px(WOODD, x, y + h - 1, w, 1); px(WOODD, x, y, 1, h); px(WOODD, x + w - 1, y, 1, h);
        for (let k = 1; k < Math.min(w, h) - 1; k++) px(WOODD, x + k, y + k);
      };
      const barrel = (x: number, y: number) => { px(BRD, x, y, 4, 5); px(IRON, x, y + 1, 4, 1); px(IRON, x, y + 3, 4, 1); px(BRL, x + 1, y, 1, 5); };

      for (let i = 0; i < 2; i++) tex(`cart_${i}`, 44, 26, () => {
        // wheel with spokes (they turn: + then x)
        g.fillStyle(WHEEL).fillCircle(9, 20, 5); g.fillStyle(WOODD).fillCircle(9, 20, 4);
        if (i === 0) { px(WHEEL, 9, 16, 1, 9); px(WHEEL, 5, 20, 9, 1); } else for (let k = -3; k <= 3; k++) { px(WHEEL, 9 + k, 20 + k); px(WHEEL, 9 + k, 20 - k); }
        px(IRON, 8, 19, 2, 2);
        // cart bed, cargo, driver
        px(WOOD, 1, 13, 20, 4); px(WOODL, 1, 13, 20, 1); px(WOODD, 1, 16, 20, 1);
        px(WOODD, 6, 13, 1, 3); px(WOODD, 11, 13, 1, 3); px(WOODD, 1, 10, 1, 3);
        crate(2, 7, 6, 6); barrel(9, 8); px(SACK, 13, 9, 3, 4); px(WOODD, 13, 9, 3, 1);
        px(WOODD, 16, 12, 5, 1);                                                      // seat
        px(SHIRT, 17, 6, 4, 6); px(SKIN, 17, 2, 4, 4); px(0x000000, 20, 3); px(HAT, 16, 2, 6, 1); px(HAT, 17, 0, 4, 2); px(SKIN, 21, 8, 2, 1);
        px(WOODD, 21, 15, 8, 1);                                                      // shaft
        g.lineStyle(1, MANE, 1).lineBetween(22.5, 8.5, 38.5, 5.5);                    // reins
        // horse: legs (trotting), tail, body, neck, head
        if (i === 0) { straight(27, 16, 8); lifted(29, 16); lifted(36, 16); straight(38, 16, 8); }
        else { lifted(27, 16); straight(29, 16, 8); straight(36, 16, 8); lifted(38, 16); }
        px(MANE, 23, 10, 2, 2); px(MANE, 22, 12, 2, 5); px(MANE, 23, 17, 1, 2);
        g.fillStyle(BR).fillEllipse(32, 13, 18, 9);
        px(BRD, 26, 16, 12, 1); px(BRL, 28, 9, 8, 1);
        px(BR, 37, 6, 4, 7); px(BR, 38, 4, 4, 3); px(BR, 39, 2, 4, 3); px(BR, 41, 4, 3, 4);
        px(BRD, 42, 7, 2, 1); px(BLAZE, 42, 3, 1, 3); px(BRD, 39, 0, 1, 2); px(0x000000, 40, 3); px(HOOF, 43, 6);
        px(MANE, 36, 7, 1, 3); px(MANE, 37, 5, 1, 2); px(MANE, 38, 3, 1, 2);
        px(HARNESS, 35, 7, 2, 6); px(HARNESS, 30, 9, 1, 8); px(0x5a2a1a, 26, 10, 9, 1);
      });

      for (let i = 0; i < 2; i++) tex(`cartf_${i}`, 22, 28, () => {
        // behind: the cart front with cargo and the driver
        px(WHEEL, 0, 6, 3, 9); px(WHEEL, 19, 6, 3, 9); px(IRON, 1, 10); px(IRON, 20, 10);
        crate(3, 3, 5, 5); barrel(14, 3);
        px(WOOD, 3, 8, 16, 5); px(WOODL, 3, 8, 16, 1); px(WOODD, 3, 12, 16, 1);
        px(HAT, 7, 1, 8, 1); px(HAT, 9, 0, 4, 1); px(SKIN, 9, 2, 4, 3); px(0x000000, 10, 3); px(0x000000, 12, 3); px(SHIRT, 8, 5, 6, 3);
        px(MANE, 7, 6, 1, 7); px(MANE, 14, 6, 1, 7);                                  // reins down to the bridle
        // in front: the horse coming at you: a broad chest, a long face with a blaze
        px(BR, 4, 17, 14, 6); px(BRL, 5, 17, 12, 1); px(BRD, 4, 22, 14, 1);          // chest
        px(HARNESS, 4, 16, 14, 1); px(HARNESS, 4, 16, 1, 4); px(HARNESS, 17, 16, 1, 4); // collar
        if (i === 0) { straight(5, 23, 3); px(BRD, 15, 23, 2, 2); px(HOOF, 15, 25, 2, 1); }
        else { px(BRD, 5, 23, 2, 2); px(HOOF, 5, 25, 2, 1); straight(15, 23, 3); }
        px(BRD, 7, 11, 2, 3); px(BRD, 13, 11, 2, 3);                                  // ears
        px(BR, 7, 13, 8, 4); px(BR, 8, 17, 6, 4); px(BRD, 8, 21, 6, 2);               // head, muzzle
        px(BLAZE, 10, 13, 2, 7); px(MANE, 9, 12, 4, 1);                               // blaze, forelock
        px(0x000000, 7, 15); px(0x000000, 14, 15); px(HOOF, 9, 22); px(HOOF, 12, 22);  // eyes, nostrils
      });

      for (let i = 0; i < 2; i++) tex(`cartb_${i}`, 22, 28, () => {
        // ahead (farther): the horse from behind: ears, neck, a round rump with the breeching strap
        px(BRD, 8, 0, 2, 2); px(BRD, 12, 0, 2, 2); px(BR, 8, 2, 6, 3); px(MANE, 10, 1, 2, 6);
        px(BR, 7, 5, 8, 2);
        px(BR, 6, 7, 10, 1); px(BR, 5, 8, 12, 5); px(BR, 6, 13, 10, 1);              // rump
        px(BRL, 7, 8, 3, 2); px(BRL, 12, 8, 3, 2); px(BRD, 10, 7, 2, 6);              // two haunches, the spine
        px(HARNESS, 5, 11, 12, 1); px(HARNESS, 5, 8, 1, 4); px(HARNESS, 16, 8, 1, 4); // breeching strap
        px(MANE, 10, 9, 2, 6); px(MANE, 9, 14, 4, 2);                                 // tail
        if (i === 0) { straight(6, 14, 3); px(BRD, 14, 14, 2, 2); px(HOOF, 14, 16, 2, 1); }
        else { px(BRD, 6, 14, 2, 2); px(HOOF, 6, 16, 2, 1); straight(14, 14, 3); }
        px(WOODD, 4, 12, 1, 6); px(WOODD, 17, 12, 1, 6);                              // shafts
        // closer: the back of the loaded cart
        px(WHEEL, 0, 16, 3, 10); px(WHEEL, 19, 16, 3, 10); px(IRON, 1, 21); px(IRON, 20, 21);
        crate(4, 14, 5, 5); barrel(13, 15); px(SACK, 9, 16, 4, 3);
        px(WOOD, 3, 19, 16, 6); px(WOODL, 3, 19, 16, 1); px(WOODD, 3, 24, 16, 1); px(WOODD, 8, 19, 1, 5); px(WOODD, 13, 19, 1, 5);
      });
    }

    // ---- the training ground and the people you can talk to ----
    const dummy = (key: string, flash: boolean) => tex(key, 16, 26, () => {
      const straw = flash ? 0xffffff : 0xd8b860;
      px(flash ? 0xffffff : 0x6b4a2b, 7, 12, 2, 14);                       // post
      px(straw, 4, 0, 8, 7); px(flash ? 0xffffff : 0x8a3a3a, 4, 7, 8, 1);  // sack head, rope
      px(straw, 2, 8, 12, 8); px(straw, 0, 9, 16, 3);                      // body, arms
      if (!flash) { px(0x000000, 6, 3); px(0x000000, 9, 3); px(0xd83a3a, 6, 11, 4, 4); px(0xffffff, 7, 12, 2, 2); }   // face, target
    });
    dummy('dummy', false);
    dummy('dummy_flash', true);
    const person = (key: string, hair: number, top: number, extra: () => void, h = 12) => tex(key, 10, h, () => {
      px(hair, 2, 0, 6, 2); px(0xf2c79a, 2, 2, 6, 4); px(0x000000, 3, 3); px(0x000000, 6, 3);
      px(top, 1, 6, 8, h - 8); px(0x2b2b3a, 2, h - 2, 2, 2); px(0x2b2b3a, 6, h - 2, 2, 2); extra();
    });
    person('elder', 0xdddddd, 0x6a6a8a, () => { px(0xdddddd, 3, 5, 4, 2); px(0x8a6a3a, 9, 2, 1, 10); });          // white hair + beard, staff
    person('grandpa', 0xf2c79a, 0x7a5a3a, () => {                                                                     // bald, white tufts, big moustache, cane
      px(0xdddddd, 1, 1, 1, 3); px(0xdddddd, 8, 1, 1, 3); px(0xffffff, 3, 5, 4, 1); px(0xc8a86a, 3, 7, 4, 3); px(0x5a3a1a, 9, 4, 1, 8); px(0x5a3a1a, 8, 4);
    }, 13);
    person('kid', 0xd8823a, 0x4ab84a, () => { px(0xffcc44, 0, 6, 1, 1); }, 9);                                         // small, freckled
    person('sergeant', 0x5a5a64, 0x7a7a84, () => { px(0x9a9aa8, 1, 0, 8, 2); px(0xd83a3a, 4, 7, 2, 3); px(0xdddddd, 9, 4, 1, 7); });   // helmet, armor, spear

    tex('catapult_base', 26, 14, () => { px(0x6b4a2b, 0, 8, 26, 3); px(0x6b4a2b, 10, 0, 3, 9); px(0x8a6a3a, 11, 0, 1, 9); g.fillStyle(0x3a2a1a).fillCircle(4, 11, 3).fillCircle(21, 11, 3); px(0x999999, 4, 11); px(0x999999, 21, 11); });
    tex('catapult_arm', 28, 7, () => { px(0x8a6a3a, 0, 2, 22, 2); px(0x6b4a2b, 20, 0, 8, 1); px(0x6b4a2b, 20, 0, 1, 7); px(0x6b4a2b, 27, 0, 1, 7); px(0x6b4a2b, 20, 6, 8, 1); });
    g.destroy();

    // Animations (frames above, or a file sheet with the same keys). Created once for all scenes.
    const anim = (key: string, frames: [string, number][]) => {
      if (this.anims.exists(key)) return;
      this.anims.create({ key, frames: frames.map(([k, duration]) => ({ key: k, duration })), repeat: -1 });
    };
    anim('campfire_wood', [['campfire_wood_0', 130], ['campfire_wood_1', 110], ['campfire_wood_2', 120]]);
    anim('campfire_stone', [['campfire_stone_0', 130], ['campfire_stone_1', 110], ['campfire_stone_2', 120]]);
    anim('fountain', [['fountain_0', 260], ['fountain_1', 260]]);
    anim('beerguy', [['beerguy_0', 1100], ['beerguy_1', 700]]);
    anim('barkeeper', [['barkeeper_0', 1300], ['barkeeper_1', 600]]);
    anim('merchant', [['merchant_0', 1800], ['merchant_1', 600]]);
    // one robe colour per deal (files only: without them every deal shows the default merchant)
    for (const r of ROBES) {
      if (this.textures.exists(`merchant_${r}_0`) && this.textures.exists(`merchant_${r}_1`)) anim(`merchant_${r}`, [[`merchant_${r}_0`, 1800], [`merchant_${r}_1`, 600]]);
    }
    anim('cart', [['cart_0', 160], ['cart_1', 160]]);
    anim('cart_up', [['cartb_0', 170], ['cartb_1', 170]]);
    anim('cart_down', [['cartf_0', 170], ['cartf_1', 170]]);

    // ---- dev hooks ----
    const q = new URLSearchParams(window.location.search);
    const wallet = q.get('wallet')?.split(',').map(Number);
    if (wallet && wallet.length === 3 && wallet.every((n) => Number.isFinite(n) && n >= 0)) {
      updateSave((s) => ({ ...s, wallet: { classic: wallet[0], rare: wallet[1], superRare: wallet[2] } }));
    }
    if (q.has('spent')) {
      const spent = Math.max(0, Number(q.get('spent')) || 0);
      updateSave((s) => ({ ...s, spent, villageSeen: Math.max(1, Number(q.get('seen') ?? 1) || 1) }));
    }
    if (q.get('kit') === 'all') {
      updateSave((s) => ({ ...s, inventory: { owned: CATALOG.map((i) => i.id as CatalogId), melee: 'sword', range: 'bow', armor: 'steel' } }));
    }
    const armor = q.get('armor');   // ?armor=iron: wear that armor (none = no armor)
    if (armor !== null) updateSave((s) => ({ ...s, inventory: { ...s.inventory, armor: armor && armor !== 'none' ? armor as ArmorId : null } }));
    const scene = q.get('scene');
    if (q.has('play')) {
      this.scene.start('play', { startMs: Number(q.get('t') ?? 0), stage: Number(q.get('stage') ?? 1), openShop: q.has('shop'), bossDead: q.has('dead'), lose: q.has('lose'), landing: false });
    } else if (scene && ['intro', 'village', 'treasury', 'menu', 'media'].includes(scene)) {
      this.scene.start(scene, scene === 'treasury' ? { found: [], wallet: loadSave().wallet, timeMs: 60_000 } : { openShop: q.has('merchant'), openBar: q.has('bar'), inYard: q.has('yard'), tutorial: q.has('tutorial') });
    } else {
      this.scene.start('menu');
    }
  }

  /**
   * Team weapon art: files named after the weapon (sword.png, warhammer.png, slingshot.png...) in
   * public/media/sprites become the in-hand sprite held_<weapon>. The empty border is trimmed and
   * weapons drawn pointing up are turned to point right (the game rotates them toward the aim).
   * The files stay as uploaded; a held_<weapon>.png of its own still wins.
   */
  private weaponArt() {
    // [file, weapon id, degrees to turn so it points right]
    const ART: [string, string, number][] = [
      ['dagger', 'dagger', 90], ['sword', 'sword', 90], ['axe', 'axe', 90], ['mace', 'mace', 90],
      ['warhammer', 'warHammer', 90], ['spear', 'spear', 0], ['slingshot', 'sling', 90],
      ['bow', 'bow', 0], ['crossbow', 'crossbow', 0], ['javelin', 'javelin', 0], ['handcannon', 'handCannon', 0],
    ];
    for (const [file, id, turn] of ART) {
      const key = `held_${id}`;
      if (!this.textures.exists(file) || this.textures.exists(key)) continue;
      const src = this.textures.get(file).getSourceImage() as HTMLImageElement;
      // find the drawn part (alpha > 0)
      const probe = document.createElement('canvas');
      probe.width = src.width;
      probe.height = src.height;
      const pc = probe.getContext('2d')!;
      pc.drawImage(src, 0, 0);
      const px = pc.getImageData(0, 0, src.width, src.height).data;
      let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
        if (px[(y * src.width + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      if (x1 < 0) continue;                                   // an empty picture: keep the drawn one
      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      const turned = turn % 180 !== 0;
      const out = document.createElement('canvas');
      out.width = turned ? h : w;
      out.height = turned ? w : h;
      const oc = out.getContext('2d')!;
      oc.imageSmoothingEnabled = false;
      oc.translate(out.width / 2, out.height / 2);
      oc.rotate((turn * Math.PI) / 180);                      // clockwise: up becomes right
      oc.drawImage(src, x0, y0, w, h, -w / 2, -h / 2, w, h);
      this.textures.addCanvas(key, out);
      mediaStatus.fromFiles.add(key);
    }
  }

  /** Copy a loaded texture into a canvas we can read and change pixel by pixel. */
  private pixels(key: string) {
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0);
    return { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height) };
  }

  /** ImageData -> a new texture (skipped when a file with that key exists). */
  private addPixels(key: string, img: ImageData) {
    if (this.textures.exists(key)) return;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d')!.putImageData(img, 0, 0);
    this.textures.addCanvas(key, c);
    mediaStatus.fromFiles.add(key);
  }

  /**
   * The team's boss (sprites/boss_art.png, 32x35, from art/Boss.png) -> boss_<stage> (stage 2/3 glow
   * orange/red, the treasury key on his chest), boss_flash (white, on a hit), boss_nokey (dead).
   * The drawing is never cut: the arena moves the whole picture (waddle, lunge, recoil).
   * Colours are baked in because the Canvas renderer ignores setTint.
   */
  private bossArt() {
    if (!this.textures.exists('boss_art')) return;            // no file: boot draws the placeholder
    const { w, h, data } = this.pixels('boss_art');
    const mix = (tint: number, a: number) => {
      const out = new ImageData(new Uint8ClampedArray(data.data), w, h);
      const d = out.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        d[i] = d[i] * (1 - a) + ((tint >> 16) & 255) * a;
        d[i + 1] = d[i + 1] * (1 - a) + ((tint >> 8) & 255) * a;
        d[i + 2] = d[i + 2] * (1 - a) + (tint & 255) * a;
      }
      return out;
    };
    const put = (img: ImageData, x: number, y: number, rgb: number) => {
      img.data.set([(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 255], (y * w + x) * 4);
    };
    const withKey = (img: ImageData) => {                      // below the chin, over the chest
      for (const [x, y] of [[14, 13], [15, 14], [19, 13], [18, 14]]) put(img, x, y, 0x2b1a10);   // cord
      for (const [x, y] of [[15, 15], [16, 15], [17, 15], [15, 16], [17, 16], [16, 17], [16, 18], [17, 18]]) put(img, x, y, 0xffcc44);
      put(img, 16, 16, 0x2b1a10);                              // the hole in the bow
      put(img, 15, 15, 0xfff1a8);                              // shine
      return img;
    };
    const stages: [number, ImageData][] = [[1, withKey(mix(0, 0))], [2, withKey(mix(0xff8a2c, 0.25))], [3, withKey(mix(0xff2a2a, 0.38))]];
    for (const [s, img] of stages) this.addPixels(`boss_${s}`, img);
    // his hands: frames where only the six hands move by a pixel or two (the arms stay as drawn)
    if (w === BOSS_W && h === BOSS_H) {
      for (const [s, img] of stages) for (const [name, shifts] of Object.entries(HAND_FRAMES)) this.addPixels(`boss_${s}_${name}`, moveHands(img, shifts));
    }
    this.addPixels('boss_flash', mix(0xffffff, 1));
    this.addPixels('boss_nokey', mix(0xff2a2a, 0.38));
  }

  /**
   * The team's campfires (sprites/campfire_wood.png and campfire_stone.png, from art/Campfire/) ->
   * three flicker frames each: as drawn, the flame 1 px taller, the flame brighter.
   */
  private campfireArt() {
    for (const kind of ['wood', 'stone']) {
      const src = `campfire_${kind}`;
      if (!this.textures.exists(src)) continue;
      const { w, h, data } = this.pixels(src);
      const isFlame = (d: Uint8ClampedArray, i: number) => d[i + 3] > 0 && d[i] > 180 && d[i] - d[i + 2] > 70;
      const taller = new ImageData(new Uint8ClampedArray(data.data), w, h);
      for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (isFlame(data.data, i)) taller.data.set(data.data.subarray(i, i + 4), i - w * 4);
      }
      const bright = new ImageData(new Uint8ClampedArray(data.data), w, h);
      for (let i = 0; i < bright.data.length; i += 4) {
        if (isFlame(data.data, i)) { bright.data[i + 1] = Math.min(255, bright.data[i + 1] + 45); bright.data[i + 2] = Math.min(255, bright.data[i + 2] + 20); }
      }
      this.addPixels(`${src}_0`, data);
      this.addPixels(`${src}_1`, taller);
      this.addPixels(`${src}_2`, bright);
    }
  }
}
