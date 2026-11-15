// The village's buildings, drawn in the catapult's style (boot.ts `catapult_*`, src/catapult.ts):
// a 1 px dark outline where a shape meets the background, light from the upper left (a LIGHT top
// row and left column, a SHADE bottom row and right column), chunky members, iron at the joints.
// Drawn at 1x on the game grid. Each texture is made only when the team has no file for it
// (public/media/sprites/<key>.png wins), like every placeholder in boot.ts.
//
// Animations made here: the fountain (4 frames), the waving flag (3), the lantern's flame (2).
// The chimney smoke is puffed by the village itself (village.ts, CHIMNEYS).
import Phaser from 'phaser';
import { mediaStatus } from './media';

/** One material: its highlight, body and shade. */
export interface Tone { l: number; m: number; s: number }
export const DARK = 0x3a2a1a;   // the catapult's outline, also the darkest wood
export const WOOD: Tone = { l: 0x9a7040, m: 0x7a5230, s: 0x5a3a1a };
export const STONE: Tone = { l: 0xc4c0b6, m: 0x9e9a90, s: 0x76726a };
export const PLASTER: Tone = { l: 0xf6ecd0, m: 0xe8d8b0, s: 0xc8b48c };
export const TILE: Tone = { l: 0xc8584a, m: 0xa0402f, s: 0x7a2f22 };
export const THATCH: Tone = { l: 0xe8cc78, m: 0xc8a84a, s: 0x9a7a30 };
export const GOLDT: Tone = { l: 0xfff1a8, m: 0xffcc44, s: 0xc89a1a };
export const IRON = 0x8a8a94;
export const ROPE = 0xd8c8a0;
const GLASS = 0x9fd3ff;
const WATER: Tone = { l: 0x9fd3ff, m: 0x4a8ac8, s: 0x2a5a8a };

/** Where each building's chimney top is, from its centre (the village puffs smoke there). */
export const CHIMNEYS: Readonly<Record<string, { x: number; y: number }>> = {
  house: { x: 7, y: -13 },
  house_big: { x: 9, y: -18 },
};

type Px = (c: number, x: number, y: number, w?: number, h?: number, a?: number) => void;

/** The drawing kit for one texture: plain pixels, outlined shaded blocks, a gable roof. */
export function kit(g: Phaser.GameObjects.Graphics) {
  const px: Px = (c, x, y, w = 1, h = 1, a = 1) => { g.fillStyle(c, a).fillRect(x, y, w, h); };
  /** A solid block: outlined, lit on top and left, shaded on the bottom and right. */
  const block = (x: number, y: number, w: number, h: number, t: Tone, outline = true) => {
    const o = outline ? 1 : 0;
    if (outline) px(DARK, x, y, w, h);
    px(t.m, x + o, y + o, w - 2 * o, h - 2 * o);
    px(t.l, x + o, y + o, w - 2 * o, 1); px(t.l, x + o, y + o, 1, h - 2 * o);
    px(t.s, x + o, y + h - 1 - o, w - 2 * o, 1); px(t.s, x + w - 1 - o, y + o, 1, h - 2 * o);
  };
  /**
   * A gable roof, apex at (cx, top), `rows` tall, widening 1 px each side per row. Tiles in
   * courses (a shade line every 3rd row), the left slope lit, the right slope shaded, outlined.
   */
  const gable = (cx: number, top: number, rows: number, startW: number, t: Tone, course = 3) => {
    for (let i = 0; i < rows; i++) {
      const w = startW + 2 * i;
      const x = cx - Math.floor(w / 2);
      px(DARK, x, top + i, w, 1);
      if (i === 0 || w < 3) continue;
      const row = i % course === 0 ? t.s : t.m;
      px(row, x + 1, top + i, w - 2, 1);
      px(t.l, x + 1, top + i, Math.max(1, Math.floor((w - 2) / 3)), 1);   // the lit slope
      if (i % course !== 0) px(t.s, x + w - 3, top + i, 2, 1);           // the shaded edge
    }
  };
  /** A window: dark frame, glass, a cross of wooden bars, a glint, a sill. */
  const window = (x: number, y: number, w: number, h: number) => {
    px(DARK, x, y, w, h);
    px(GLASS, x + 1, y + 1, w - 2, h - 2);
    px(0x6aa8d8, x + 1, y + h - 3, w - 2, 2);
    px(WOOD.m, x + Math.floor(w / 2), y + 1, 1, h - 2); px(WOOD.m, x + 1, y + Math.floor(h / 2), w - 2, 1);
    px(0xffffff, x + 1, y + 1, 1, 1);
    px(WOOD.l, x - 1, y + h, w + 2, 1); px(DARK, x - 1, y + h + 1, w + 2, 1);   // the sill
  };
  /** A plank door with an iron band and a gold knob. */
  const door = (x: number, y: number, w: number, h: number) => {
    px(DARK, x, y, w, h);
    px(WOOD.m, x + 1, y + 1, w - 2, h - 1);
    px(WOOD.l, x + 1, y + 1, 1, h - 1);
    for (let k = x + 3; k < x + w - 1; k += 2) px(WOOD.s, k, y + 1, 1, h - 1);
    px(IRON, x + 1, y + 3, w - 2, 1);
    px(GOLDT.m, x + w - 3, y + Math.floor(h / 2) + 1, 1, 1);
  };
  /** A stone chimney. */
  const chimney = (x: number, y: number, h: number) => { block(x, y, 4, h, STONE); px(DARK, x - 1, y, 6, 1); px(0x2a2a2a, x + 1, y + 1, 2, 1); };
  return { px, block, gable, window, door, chimney };
}

export function makeVillageArt(s: Phaser.Scene) {
  const g = s.make.graphics({ x: 0, y: 0 }, false);
  const k = kit(g);
  const { px, block, gable, window, door, chimney } = k;
  const tex = (key: string, w: number, h: number, draw: () => void) => {
    if (s.textures.exists(key)) { mediaStatus.fromFiles.add(key); return; }
    mediaStatus.placeholders.set(key, { w, h });
    g.clear(); draw(); g.generateTexture(key, w, h);
  };

  // ---- homes ----
  // a cottage: a tiled gable roof with a chimney, plaster walls on a stone footing, two windows, a door
  tex('house', 30, 26, () => {
    chimney(20, 1, 8);
    gable(15, 0, 11, 8, TILE);
    px(DARK, 0, 10, 30, 1);                                     // the eave
    block(2, 11, 26, 15, PLASTER);
    block(2, 22, 26, 4, STONE);                                 // the stone footing
    window(5, 13, 6, 5); window(19, 13, 6, 5);
    door(12, 15, 6, 11);
  });
  // a big two-storey house: half-timbered upstairs, a tall roof and chimney, a window box
  tex('house_big', 32, 36, () => {
    chimney(23, 1, 9);
    gable(16, 0, 12, 8, TILE);
    px(DARK, 0, 11, 32, 1);
    block(2, 12, 28, 24, PLASTER);
    for (const x of [2, 15, 29]) px(DARK, x, 12, 1, 11);        // the upstairs timber frame
    px(WOOD.m, 3, 22, 26, 2); px(DARK, 2, 24, 28, 1);            // the floor beam
    px(WOOD.s, 4, 14, 1, 1); px(WOOD.s, 5, 15, 1, 1); px(WOOD.s, 26, 14, 1, 1); px(WOOD.s, 25, 15, 1, 1);   // braces
    window(5, 14, 7, 5); window(20, 14, 7, 5);
    px(WOOD.s, 4, 21, 9, 1); [5, 7, 9, 11].forEach((x, i) => px([0xd83a3a, 0xffcc44, 0xff6a8a, 0xffcc44][i], x, 20, 1, 1));   // window box
    block(2, 31, 28, 5, STONE);
    window(5, 26, 6, 4); window(21, 26, 6, 4);
    door(13, 25, 6, 11);
  });
  // a log hut: a shaggy thatch roof, round logs, a cloth over the doorway
  tex('hut', 24, 20, () => {
    for (let i = 0; i < 8; i++) {
      const w = 8 + 2 * i;
      const x = 12 - w / 2;
      px(DARK, x, i, w, 1);
      if (i) for (let c = x + 1; c < x + w - 1; c++) px((c + i) % 3 === 0 ? THATCH.s : c < 12 ? THATCH.l : THATCH.m, c, i, 1, 1);
    }
    for (let c = 1; c < 23; c += 2) px(THATCH.s, c, 8, 1, 1);  // the ragged eave
    for (let r = 0; r < 4; r++) {                               // the logs
      const y = 9 + r * 3;
      px(DARK, 2, y, 20, 3); px(WOOD.l, 3, y, 18, 1); px(WOOD.m, 3, y + 1, 18, 1);
      px(0xb88a4a, 2, y + 1, 1, 1); px(0xb88a4a, 21, y + 1, 1, 1);   // log ends
    }
    px(DARK, 9, 12, 6, 8); px(0x8a3a3a, 10, 13, 4, 7); px(0xa84a4a, 10, 13, 1, 7); px(0x2a1a0a, 12, 13, 2, 7);   // the doorway's cloth
  });
  // tents (camp): canvas over a pole, the flap pinned open, guy ropes to pegs
  const tent = (key: string, t: Tone) => tex(key, 26, 18, () => {
    for (let i = 0; i < 15; i++) {
      const w = 3 + Math.floor(i * 1.5);
      const x = 13 - Math.floor(w / 2);
      const y = 2 + i;
      px(DARK, x, y, w, 1);
      if (w > 2) { px(t.l, x + 1, y, Math.floor((w - 2) / 2), 1); px(t.m, x + 1 + Math.floor((w - 2) / 2), y, w - 2 - Math.floor((w - 2) / 2), 1); }
    }
    px(DARK, 3, 16, 21, 2);
    px(DARK, 10, 9, 6, 8); px(0x2a1a10, 11, 10, 4, 7); px(t.s, 10, 9, 2, 6);   // the open flap
    px(WOOD.m, 13, 0, 1, 3); px(0xd83a3a, 14, 0, 2, 1);          // the pole and a pennant
    px(ROPE, 1, 12, 1, 1); px(ROPE, 2, 10, 1, 1); px(ROPE, 24, 12, 1, 1); px(ROPE, 23, 10, 1, 1);   // guy ropes
    px(WOOD.s, 0, 15, 1, 2); px(WOOD.s, 25, 15, 1, 2);           // pegs
  });
  tent('tent_a', { l: 0xf4ead0, m: 0xe0d0a8, s: 0xb8a880 });
  tent('tent_b', { l: 0xe8b878, m: 0xd09a5a, s: 0xa0703a });

  // ---- the market ----
  // the ring merchant's stall: a scalloped red and white awning on posts, a plank counter, rings
  tex('stall', 40, 20, () => {
    px(DARK, 0, 0, 40, 6);
    for (let i = 0; i < 8; i++) { px(i % 2 ? 0xf6f0e8 : 0xd83a3a, i * 5 + 1, 1, 4, 4); px(i % 2 ? 0xf6f0e8 : 0xd83a3a, i * 5 + 1, 5, 3, 1); px(DARK, i * 5 + 4, 5, 2, 1); }
    px(0xffffff, 1, 1, 38, 1, 0.35);
    for (const x of [2, 35]) { px(DARK, x, 6, 3, 9); px(WOOD.l, x + 1, 6, 1, 9); }   // the posts
    block(0, 12, 40, 8, WOOD);
    for (const x of [10, 20, 30]) px(WOOD.s, x, 13, 1, 6);
    px(IRON, 1, 14, 1, 4); px(IRON, 38, 14, 1, 4);
    [0xc8c8d0, 0x44aaff, 0xff55dd, 0xc8c8d0, 0x44aaff].forEach((c, i) => { px(DARK, 6 + i * 6, 10, 4, 2); px(c, 7 + i * 6, 10, 2, 1); });   // rings on the counter
  });
  // the fruit stall: a green and white awning, crates of fruit
  tex('fruitstall', 28, 18, () => {
    px(DARK, 0, 0, 28, 5);
    for (let i = 0; i < 7; i++) { px(i % 2 ? 0xf6f0e8 : 0x3a9a3a, i * 4 + 1, 1, 3, 3); px(i % 2 ? 0xf6f0e8 : 0x3a9a3a, i * 4 + 1, 4, 2, 1); }
    for (const x of [1, 24]) { px(DARK, x, 5, 3, 7); px(WOOD.l, x + 1, 5, 1, 7); }
    block(0, 11, 28, 7, WOOD);
    for (const [x, c] of [[3, 0xd83a3a], [10, 0xffaa33], [17, 0x6fd13a]] as const) {   // three crates, heaped
      px(DARK, x, 8, 7, 4); px(WOOD.m, x + 1, 9, 5, 2);
      for (let f = 0; f < 3; f++) { px(DARK, x + f * 2, 6, 3, 3); px(c, x + f * 2 + 1, 7, 1, 1); px(0xffffff, x + f * 2 + 1, 7, 1, 1, 0.3); }
    }
    px(GOLDT.m, 24, 8, 2, 2); px(DARK, 24, 7, 2, 1);
  });
  // a barrel: staves lit on the left, two iron hoops
  tex('barrel', 10, 12, () => {
    px(DARK, 1, 0, 8, 12); px(DARK, 0, 1, 10, 10);
    px(WOOD.m, 1, 1, 8, 10); px(WOOD.l, 2, 1, 2, 10); px(WOOD.s, 7, 1, 2, 10);
    px(DARK, 1, 3, 8, 1); px(IRON, 1, 3, 3, 1); px(DARK, 1, 8, 8, 1); px(IRON, 1, 8, 3, 1);
    px(WOOD.s, 2, 0, 6, 1);
  });
  // a planter of flowers
  tex('flowers', 14, 5, () => {
    block(0, 2, 14, 3, WOOD);
    for (let i = 0; i < 5; i++) { px(0x3f7a30, 1 + i * 3, 1, 2, 2); px([0xff6a8a, 0xffee44, 0xffffff, 0xff6a8a, 0xa070ff][i], 1 + i * 3, 0, 2, 1); }
  });

  // ---- the square ----
  // the fountain: a stone basin with a lit rim, a pillar with a bowl, water arcing out and rippling
  for (let f = 0; f < 4; f++) {
    tex(`fountain_${f}`, 26, 22, () => {
      g.fillStyle(DARK).fillEllipse(13, 16, 26, 11);
      g.fillStyle(STONE.m).fillEllipse(13, 16, 24, 9);
      g.fillStyle(STONE.l).fillEllipse(12, 15, 22, 6);
      g.fillStyle(DARK).fillEllipse(13, 15, 19, 6);
      g.fillStyle(WATER.s).fillEllipse(13, 15, 18, 5);
      g.fillStyle(WATER.m).fillEllipse(13, 15, 14, 3);
      // ripples: a ring spreading from the pillar, a frame apart
      const r = 3 + f * 2;
      px(WATER.l, 13 - r, 15, 2, 1); px(WATER.l, 12 + r, 15, 2, 1);
      // the pillar and its bowl
      px(DARK, 11, 6, 5, 10); px(STONE.m, 12, 7, 3, 8); px(STONE.l, 12, 7, 1, 8);
      px(DARK, 8, 5, 11, 3); px(STONE.l, 9, 5, 9, 1); px(STONE.m, 9, 6, 9, 1);
      // the jet and the arcs falling to both sides; drops move down the arc frame by frame
      const jet = [3, 2, 1, 2][f];
      px(WATER.l, 13, jet, 1, 5 - jet); px(0xffffff, 13, jet, 1, 1);
      for (let d = 0; d < 3; d++) {
        const t = ((d + f) % 4) / 4;
        const dx = Math.round(2 + t * 6);
        const dy = Math.round(4 + t * t * 9);
        px(WATER.l, 13 - dx, dy, 1, 1); px(WATER.l, 13 + dx, dy, 1, 1);
      }
    });
  }
  // the hero's statue: gold on a stone plinth with a plaque, sword raised
  tex('statue', 14, 22, () => {
    block(0, 15, 14, 7, STONE);
    px(GOLDT.s, 4, 18, 6, 2); px(GOLDT.l, 4, 18, 6, 1);           // the plaque
    px(DARK, 4, 1, 6, 6); px(GOLDT.m, 5, 2, 4, 4); px(GOLDT.l, 5, 2, 2, 1);   // head
    px(DARK, 3, 6, 8, 7); px(GOLDT.m, 4, 7, 6, 5); px(GOLDT.l, 4, 7, 1, 5); px(GOLDT.s, 9, 7, 1, 5);   // body
    px(DARK, 3, 12, 3, 4); px(GOLDT.m, 4, 12, 1, 3); px(DARK, 8, 12, 3, 4); px(GOLDT.s, 9, 12, 1, 3);  // legs
    px(DARK, 10, 0, 3, 10); px(0xe8e8f0, 11, 0, 1, 8); px(GOLDT.m, 9, 7, 4, 1);   // the raised sword
  });
  // the well: a ring of stones round dark water, two posts, a crossbeam, the rope and bucket
  tex('well', 22, 22, () => {
    for (const x of [1, 18]) { px(DARK, x, 0, 3, 16); px(WOOD.l, x + 1, 1, 1, 14); }
    px(DARK, 0, 1, 22, 3); px(WOOD.m, 1, 2, 20, 1); px(WOOD.l, 1, 2, 20, 1, 0.5);   // crossbeam
    px(ROPE, 11, 4, 1, 5); block(9, 8, 5, 4, WOOD); px(IRON, 9, 9, 5, 1);           // rope and bucket
    g.fillStyle(DARK).fillEllipse(11, 16, 22, 11);
    g.fillStyle(STONE.m).fillEllipse(11, 16, 20, 9);
    g.fillStyle(STONE.l).fillEllipse(10, 15, 18, 6);
    for (let a = 0; a < 10; a++) { const t = (a / 10) * Math.PI * 2; px(STONE.s, Math.round(11 + Math.cos(t) * 9), Math.round(16 + Math.sin(t) * 4), 1, 1); }   // the stones' joints
    g.fillStyle(DARK).fillEllipse(11, 16, 13, 5);
    g.fillStyle(0x0e2236).fillEllipse(11, 16, 12, 4);
    px(WATER.s, 8, 16, 6, 1);
  });
  // its roof (village level 4): shingles over the crossbeam
  tex('well_roof', 24, 8, () => {
    for (let i = 0; i < 7; i++) {
      const w = 12 + 2 * i;
      const x = 12 - w / 2;
      px(DARK, x, i, w, 1);
      if (i) { px(i % 2 ? TILE.m : TILE.s, x + 1, i, w - 2, 1); px(TILE.l, x + 1, i, Math.floor(w / 4), 1); }
    }
    px(DARK, 0, 7, 24, 1);
  });
  // a street lantern: an iron post, a glass box, the flame (2 frames: it flickers)
  for (let f = 0; f < 2; f++) {
    tex(`lantern_${f}`, 5, 12, () => {
      px(DARK, 2, 4, 1, 8); px(DARK, 1, 11, 3, 1);
      px(DARK, 0, 0, 5, 5); px(0x3a3a3a, 0, 0, 5, 1);
      px(f ? 0xffaa33 : 0xffd27a, 1, 1, 3, 3); px(f ? 0xffee88 : 0xffffff, 2, f ? 2 : 1, 1, 1);
    });
  }
  if (!s.textures.exists('lantern')) tex('lantern', 5, 12, () => { px(DARK, 2, 4, 1, 8); px(DARK, 1, 11, 3, 1); px(DARK, 0, 0, 5, 5); px(0xffd27a, 1, 1, 3, 3); px(0xffffff, 2, 1, 1, 1); });

  // ---- the walls (rich town) ----
  // a stone tower: coursed blocks, battlements, an arrow slit, a door banded in iron
  tex('tower', 18, 34, () => {
    block(2, 7, 14, 27, STONE);
    for (let y = 10, r = 0; y < 33; y += 4, r++) {              // courses of blocks
      px(STONE.s, 3, y, 12, 1);
      for (let x = 5 + (r % 2) * 3; x < 15; x += 6) px(STONE.s, x, y - 3, 1, 3);
    }
    block(0, 3, 18, 5, STONE);                                  // the parapet
    for (const x of [0, 7, 14]) block(x, 0, 4, 4, STONE);      // battlements
    px(DARK, 8, 13, 2, 6); px(0x1a1a24, 8, 14, 2, 4);           // arrow slit
    px(DARK, 6, 25, 6, 9); px(WOOD.m, 7, 26, 4, 8); px(WOOD.l, 7, 26, 1, 8); px(IRON, 7, 28, 4, 1); px(IRON, 7, 31, 4, 1);   // door
  });
  // a flag on a pole (3 frames: it waves)
  for (let f = 0; f < 3; f++) {
    tex(`flag_${f}`, 10, 12, () => {
      px(DARK, 0, 0, 2, 12); px(WOOD.l, 0, 1, 1, 11); px(GOLDT.m, 0, 0, 2, 1);
      const wave = [[0, 0, 1, 1, 0, 0, 0, 0], [0, 1, 1, 0, 0, 1, 1, 0], [1, 1, 0, 0, 0, 0, 1, 1]][f];
      for (let c = 0; c < 8; c++) {
        const y = 1 + wave[c];
        px(DARK, 2 + c, y, 1, 7);
        px(c < 7 ? 0xd83a3a : DARK, 2 + c, y + 1, 1, 5);
        if (c < 7) { px(GOLDT.m, 2 + c, y + 3, 1, 1); px(0xff6a5a, 2 + c, y + 1, 1, 1); }
      }
    });
  }
  if (!s.textures.exists('flag')) tex('flag', 10, 12, () => { px(DARK, 0, 0, 2, 12); px(0xd83a3a, 2, 1, 7, 5); px(GOLDT.m, 2, 3, 7, 1); });

  // ---- the training ground ----
  // the straw dummy: a sack head tied with rope, straw arms, a painted target, on a post
  const dummy = (key: string, flash: boolean) => tex(key, 16, 26, () => {
    const W = flash ? 0xffffff : 0;
    const straw: Tone = flash ? { l: W, m: W, s: W } : { l: 0xf0d888, m: 0xd8b860, s: 0xa8883a };
    px(DARK, 6, 12, 4, 14); px(flash ? W : WOOD.m, 7, 12, 2, 14); px(flash ? W : WOOD.l, 7, 12, 1, 14);   // the post
    block(4, 0, 8, 8, straw);                                   // the sack head
    px(flash ? W : 0x8a3a3a, 4, 7, 8, 1);                       // the rope at the neck
    block(0, 9, 16, 4, straw); block(2, 8, 12, 9, straw);       // arms, body
    for (let x = 3; x < 13; x += 3) px(flash ? W : straw.s, x, 16, 1, 2);   // straw poking out
    if (!flash) { px(DARK, 6, 3); px(DARK, 9, 3); px(DARK, 6, 5, 4, 1);
      px(DARK, 5, 10, 6, 6); px(0xd83a3a, 6, 11, 4, 4); px(0xffffff, 7, 12, 2, 2); px(0xd83a3a, 8, 13, 1, 1); }   // face, target
  });
  dummy('dummy', false);
  dummy('dummy_flash', true);
  // a wooden signboard on a post
  tex('sign', 16, 12, () => { block(0, 0, 16, 7, WOOD); px(DARK, 7, 7, 2, 5); px(WOOD.s, 3, 3, 8, 1); px(WOOD.s, 10, 2, 2, 3); });

  g.destroy();

  // the animations (frames above, or file frames with the same keys)
  const anim = (key: string, frames: [string, number][]) => {
    if (s.anims.exists(key)) s.anims.remove(key);
    s.anims.create({ key, frames: frames.map(([k, duration]) => ({ key: k, duration })), repeat: -1 });
  };
  anim('fountain', [['fountain_0', 160], ['fountain_1', 160], ['fountain_2', 160], ['fountain_3', 160]]);
  anim('flag', [['flag_0', 220], ['flag_1', 200], ['flag_2', 220], ['flag_1', 200]]);
  anim('lantern', [['lantern_0', 420], ['lantern_1', 140], ['lantern_0', 900], ['lantern_1', 120]]);
}

/** The village's ground details, drawn into a Graphics in the same style. */
export const villageGround = {
  /** Cobbles on the road: each stone outlined, lit on top. */
  cobbles(g: Phaser.GameObjects.Graphics, x0: number, y0: number, w: number) {
    for (let x = 0; x < w; x += 6) for (let row = 0; row < 3; row++) {
      const x1 = x0 + x + (row % 2) * 3;
      const y1 = y0 + row * 5;
      g.fillStyle(0x6a5e48).fillRect(x1, y1, 5, 4);
      g.fillStyle(row % 2 ? 0xa89a7a : 0xb8aa8a).fillRect(x1, y1, 4, 3);
      g.fillStyle(0xd0c4a4).fillRect(x1, y1, 4, 1);
    }
  },
  /** The town wall: two courses of outlined stone blocks with a coping on top. */
  wall(g: Phaser.GameObjects.Graphics, x0: number, y: number, w: number) {
    g.fillStyle(DARK).fillRect(x0, y - 1, w, 8);
    for (let x = 0; x < w - 4; x += 6) {
      for (const [dy, off] of [[0, 0], [3, 3]] as const) {
        const bx = x0 + x + off;
        if (bx + 5 > x0 + w) continue;
        g.fillStyle(STONE.m).fillRect(bx, y + dy, 5, 2);
        g.fillStyle(STONE.l).fillRect(bx, y + dy, 5, 1);
      }
    }
    g.fillStyle(STONE.l).fillRect(x0, y - 1, w, 1);
  },
  /** A fence rail along x or y with posts every 6 px: posts outlined and lit, rails with a lit top. */
  fence(g: Phaser.GameObjects.Graphics, x0: number, y0: number, len: number, across: boolean) {
    if (across) {
      g.fillStyle(DARK).fillRect(x0, y0 - 2, len, 3);
      g.fillStyle(WOOD.m).fillRect(x0, y0 - 1, len, 1);
      g.fillStyle(WOOD.l).fillRect(x0, y0 - 2, len, 1);
    } else {
      g.fillStyle(DARK).fillRect(x0 - 1, y0, 3, len);
      g.fillStyle(WOOD.m).fillRect(x0, y0, 1, len);
    }
    for (let i = 0; i <= len; i += 6) {
      const px = across ? x0 + i : x0 - 1;
      const py = across ? y0 - 4 : y0 + i - 3;
      g.fillStyle(DARK).fillRect(px - 1, py - 1, 4, 6);
      g.fillStyle(WOOD.m).fillRect(px, py, 2, 4);
      g.fillStyle(WOOD.l).fillRect(px, py, 1, 4);
      g.fillStyle(WOOD.l).fillRect(px, py, 2, 1);
    }
  },
};
