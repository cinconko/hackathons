import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { bounce, dustPuff } from '../fx';
import {
  addRings, buyItem, DRINK_ORDER, DRINKS, equip, item, KIND_NAMES, loadout, pay, ringLuck, rollCards, villageLevel, villageProgress, walletValue, WELL_RING_CHANCE,
  type CatalogId, type CatalogItem, type ItemKind, type Rarity,
} from '../game/rules';
import { handHud, hasWeapon } from '../hand';
import { hideHandArt, showHandArt } from '../handArt';
import { playMusic, sfx } from '../media';
import { addKeys, near, steer, type Keys } from '../player';
import { loadSave, updateSave } from '../save';
import { banner, floatText, FONT, walletHud } from '../ui';

// The hub between fights:
//   ring merchant  three random cards from the weapons chart, dealt again after every run
//   bar            one drink at a time, drunk at the start of the next fight
//   well           step into it and you fall in (sometimes there is a ring at the bottom)
//   catapult       flies you into Mossback's arena
//   growth         rings spent here build it out: camp, tents, village, fountains, rich town, city

type Sprite = Phaser.Physics.Arcade.Sprite;
type Panel = 'cards' | 'gear' | 'bar';

const STALL = { x: PLAY.x + 120, y: PLAY.y + 46 };
const BAR = { x: PLAY.x + 222, y: PLAY.y + 38 };
const BAR_DOOR = { x: BAR.x, y: BAR.y + 20 };
const WELL = { x: PLAY.x + 70, y: PLAY.y + 142 };
const CATAPULT = { x: PLAY.x + PLAY.width - 40, y: PLAY.y + 104 };   // pivot of the arm
const ARM_REST = Math.PI * 0.92;     // arm lying back, bucket near the ground
const ARM_FIRE = -Math.PI * 0.35;    // arm after the throw
const ARM_LEN = 24;
/**
 * Everything the village shows, by stage. A part is there from `lvl` until (not including)
 * `until`: the forest is cleared bit by bit, tents and huts become houses, the campfire becomes
 * a fountain. x / y relative to the play area; solid = [w, h, y offset]; anim = looping
 * animation; swing = a hanging sign that sways.
 */
interface Part { lvl: number; until?: number; key: string; x: number; y: number; solid?: [number, number, number]; anim?: string; depth?: number; swing?: boolean }
const forest = (until: number, pts: [number, number][]): Part[] => pts.map(([x, y]) => ({ lvl: 1, until, key: 'tree', x, y, solid: [6, 6, 6] }));
const PARTS: readonly Part[] = [
  // trees that always stay
  ...forest(99, [[80, 24], [170, 20], [14, 82], [160, 150], [280, 150]]),
  // the forest, cleared stage by stage
  ...forest(2, [[60, 66], [80, 78], [184, 64], [196, 80], [232, 140], [246, 152], [28, 36], [44, 46]]),
  ...forest(3, [[42, 92], [250, 86], [140, 64]]),
  ...forest(4, [[100, 150], [36, 150]]),
  ...forest(5, [[300, 140]]),
  ...forest(6, [[205, 86]]),
  // 1 Camp: a campfire, beer from a barrel, the merchant on a blanket
  { lvl: 1, until: 4, key: 'campfire_0', anim: 'campfire', x: 158, y: 86, solid: [10, 6, 3] },
  { lvl: 1, until: 3, key: 'blanket', x: 120, y: 56, solid: [34, 6, 2] },
  { lvl: 1, until: 3, key: 'barrel', x: 236, y: 50, solid: [10, 6, 3] },
  { lvl: 1, until: 3, key: 'beerguy_0', anim: 'beerguy', x: 222, y: 47, depth: 6, solid: [16, 6, 4] },
  { lvl: 1, key: 'merchant_0', anim: 'merchant', x: 120, y: 42, depth: 6 },
  // 2 Tent camp: tents and the first wooden huts
  { lvl: 2, until: 3, key: 'tent_a', x: 70, y: 72, solid: [20, 8, 4] },
  { lvl: 2, until: 3, key: 'tent_b', x: 188, y: 68, solid: [20, 8, 4] },
  { lvl: 2, until: 3, key: 'tent_a', x: 232, y: 146, solid: [20, 8, 4] },
  { lvl: 2, until: 3, key: 'hut', x: 34, y: 40, solid: [20, 10, 5] },
  // 3 Village: complete houses, the bar building, the market stall, lanterns (+ cobbles, drawn)
  { lvl: 3, key: 'house', x: 70, y: 72, solid: [26, 14, 5] },
  { lvl: 3, key: 'house', x: 188, y: 68, solid: [26, 14, 5] },
  { lvl: 3, key: 'house', x: 232, y: 146, solid: [26, 14, 5] },
  { lvl: 3, until: 5, key: 'house', x: 34, y: 40, solid: [26, 14, 5] },
  { lvl: 3, key: 'bar', x: 222, y: 38, solid: [46, 16, 4] },
  { lvl: 3, key: 'mug', x: 252, y: 30, depth: 8, swing: true },
  { lvl: 3, key: 'barkeeper_0', anim: 'barkeeper', x: 241, y: 58, depth: 6 },
  { lvl: 3, key: 'stall', x: 120, y: 50, depth: 7, solid: [40, 8, 6] },
  ...[30, 92, 136, 195, 250].map((x): Part => ({ lvl: 3, key: 'lantern', x, y: 97 })),
  { lvl: 3, key: 'flowers', x: 70, y: 89 },
  { lvl: 3, key: 'flowers', x: 188, y: 85 },
  // 4 Fountain square: fountains (the big one where the campfire was), market (+ bunting, drawn)
  { lvl: 4, key: 'fountain_0', anim: 'fountain', x: 158, y: 84, solid: [22, 8, 5] },
  { lvl: 4, key: 'fountain_0', anim: 'fountain', x: 100, y: 150, solid: [22, 8, 5] },
  { lvl: 4, key: 'fruitstall', x: 36, y: 146, solid: [26, 6, 4] },
  { lvl: 4, key: 'well_roof', x: 70, y: 127, depth: 8 },
  { lvl: 4, key: 'flowers', x: 34, y: 57 },
  // 5 Rich town: rich people walk around (walkers); a big house, towers (+ wall, drawn)
  { lvl: 5, key: 'house_big', x: 34, y: 38, solid: [28, 14, 9] },
  { lvl: 5, key: 'tower', x: 12, y: 150, solid: [16, 8, 12] },
  { lvl: 5, key: 'tower', x: 300, y: 150, solid: [16, 8, 12] },
  // 6 Ringfall City: horse carts on the road (walkers), the hero's statue, flags
  { lvl: 6, key: 'statue', x: 205, y: 90, solid: [14, 6, 8] },
  { lvl: 6, key: 'flag', x: 16, y: 127, depth: 8 },
  { lvl: 6, key: 'flag', x: 304, y: 127, depth: 8 },
];

const KIND_COLORS: Readonly<Record<ItemKind, number>> = { range: 0x4a90d9, melee: 0xd94a4a, special: 0xa04ad9, armor: 0x9a9aa8 };

export interface VillageData { fromIntro?: boolean; bouncedBack?: boolean; fromRun?: boolean; kept?: number; openShop?: boolean }

export class VillageScene extends Phaser.Scene {
  private player!: Sprite;
  private keys!: Keys;
  private arm!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private wallet!: ReturnType<typeof walletHud>;
  private panel: Phaser.GameObjects.Container | null = null;
  private mode: Panel = 'cards';
  private note = '';
  private sel = 0;
  private locked = false;       // no control: launching, getting up, falling into the well
  private wellLooted = false;   // one ring from the well per visit, at most
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private placed = new Map<Part, { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; zone?: Phaser.GameObjects.Zone }>();
  private layers = new Set<number>();    // drawn layers already there (cobbles 3, bunting 4, wall 5)
  private villagers: Phaser.GameObjects.Image[] = [];
  private nobles: Phaser.GameObjects.Image[] = [];
  private carts: Phaser.GameObjects.Sprite[] = [];
  private dealCards = false;             // deal the cards with a flip when the shop opens
  private popCard = -1;                  // the card just bought: pop it
  private pour = false;                  // a drink was just bought: pour it
  private hand!: ReturnType<typeof handHud>;
  private revealHand = false;            // first weapon bought: pop the indicator up when the shop closes
  private levelHud!: { g: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text; next: Phaser.GameObjects.Text; luck: Phaser.GameObjects.Text };
  private pendingGrow = false;  // a purchase raised the level: build when the shop closes

  constructor() { super('village'); }

  create(data: VillageData = {}) {
    this.panel = null;
    this.locked = false;
    this.note = '';
    this.sel = 0;
    this.wellLooted = false;
    this.villagers = [];
    this.nobles = [];
    this.carts = [];
    this.placed = new Map();
    this.layers = new Set();
    this.pendingGrow = false;
    this.dealCards = false;
    this.popCard = -1;
    this.pour = false;
    this.revealHand = false;

    // the merchant deals new cards every time you come back from the arena (and on a first visit)
    const save = loadSave();
    if (data.bouncedBack || data.fromRun || save.merchantCards.length === 0) {
      const cards = rollCards(Math.random, save.inventory.owned);
      updateSave((s) => ({ ...s, merchantCards: cards }));
    }

    this.physics.world.setBounds(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    const solids = this.drawVillage();
    this.solids = solids;

    // the merchant, the bar and the stall change with the stages (PARTS); the signs stay
    this.add.text(STALL.x, STALL.y - 22, 'RING MERCHANT', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(8);
    this.add.text(BAR.x, BAR.y - 10, 'BAR', { ...FONT, color: '#ffd27a' }).setOrigin(0.5).setDepth(8);   // clear of the level HUD
    this.add.image(CATAPULT.x - 2, CATAPULT.y + 6, 'catapult_base').setDepth(6);
    this.arm = this.add.image(CATAPULT.x, CATAPULT.y, 'catapult_arm').setOrigin(0, 0.5).setRotation(ARM_REST).setDepth(7);
    this.add.text(PLAY.x + PLAY.width - 52, CATAPULT.y - 30, "TO MOSSBACK'S LAIR", { ...FONT, color: '#ff8888' }).setOrigin(0.5).setDepth(8);

    this.player = this.physics.add.sprite(PLAY.x + 30, PLAY.y + 112, 'player').setCollideWorldBounds(true).setDepth(10);
    this.physics.add.collider(this.player, solids);
    this.keys = addKeys(this);

    this.prompt = this.add.text(0, 0, '', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(950);
    this.wallet = walletHud(this, PLAY.x + 4, PLAY.y + 4);
    this.wallet.update(loadSave().wallet);
    this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + PLAY.height - 10, 'WASD move   E use', { ...FONT, color: '#2f5a2a' }).setOrigin(1, 0).setDepth(950);
    // what's in hand: only once you own a weapon; the very first time it pops up
    this.hand = handHud(this, PLAY.x + 4, PLAY.y + PLAY.height - 20);
    this.refreshHand();
    if (hasWeapon(loadout(save.inventory).weapons) && !save.handRevealed) this.revealHand = true;
    else if (this.hand.visible || hasWeapon(loadout(save.inventory).weapons)) { this.hand.show(); this.refreshHand(); }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hideHandArt());
    this.levelHud = {
      g: this.add.graphics().setDepth(950),
      name: this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 2, '', { ...FONT, color: '#ffffff' }).setOrigin(1, 0).setDepth(950),
      next: this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 15, '', { ...FONT, color: '#c8e8b8' }).setOrigin(1, 0).setDepth(950),
      luck: this.add.text(PLAY.x + 4, PLAY.y + 12, '', { ...FONT, color: '#ffcc44' }).setDepth(950),   // under the wallet
    };

    // what the village has built so far appears at once; anything new gets built in front of you
    const seen = Math.min(save.villageSeen, villageLevel(save.spent));
    this.applyLevel(seen, false);
    this.updateLevelHud();
    if (villageLevel(loadSave().spent) > seen) this.time.delayedCall(data.bouncedBack ? 3600 : 900, () => this.grow());

    drawFrame(this);
    playMusic(this, 'village');
    if (data.bouncedBack) {
      this.bounceIn(data.kept ?? 0);
    } else {
      this.cameras.main.fadeIn(data.fromIntro ? 900 : 500);
      banner(this, 'RINGFALL VILLAGE', data.fromRun ? 'The merchant has new cards.' : 'Merchant, bar, well. The catapult is east.');
    }
    if (this.revealHand && !data.openShop) this.time.delayedCall(data.bouncedBack ? 3400 : 900, () => this.doRevealHand());
    if (data.openShop) this.openPanel('cards'); // dev hook
  }

  update() {
    if (this.locked) return;
    if (this.panel) { this.panelKeys(); return; }
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    steer(this.player, k, 1);
    if (near(this.player, WELL.x, WELL.y, 5)) { this.fallInWell(); return; }
    const atShop = near(this.player, STALL.x, STALL.y + 16, 22);
    const atBar = near(this.player, BAR_DOOR.x, BAR_DOOR.y, 16);
    const atCatapult = near(this.player, CATAPULT.x - 8, CATAPULT.y + 6, 22);
    if (atShop) this.prompt.setText('E: merchant').setPosition(STALL.x, STALL.y + 26).setVisible(true);
    else if (atBar) this.prompt.setText('E: bar').setPosition(BAR_DOOR.x, BAR_DOOR.y + 10).setVisible(true);
    else if (atCatapult) this.prompt.setText('E: launch!').setPosition(CATAPULT.x - 6, CATAPULT.y + 20).setVisible(true);
    else this.prompt.setVisible(false);
    if (JD(k.E) || JD(k.ENTER)) {
      if (atShop) this.openPanel('cards');
      else if (atBar) this.openPanel('bar');
      else if (atCatapult) this.launch();
    }
  }

  // ---- panels: merchant cards, your gear, the bar ----

  private openPanel(mode: Panel) {
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.mode = mode;
    this.sel = 0;
    this.note = '';
    this.dealCards = mode === 'cards';
    this.render();
  }

  private closePanel() {
    this.panel?.destroy();
    this.panel = null;
    this.prompt.setVisible(false);
    if (this.revealHand) this.time.delayedCall(200, () => this.doRevealHand());
    if (this.pendingGrow) { this.pendingGrow = false; this.time.delayedCall(this.revealHand ? 1800 : 250, () => this.grow()); }
  }

  /** After spending: refresh the level bar, and build when the shop closes if the level went up. */
  private spentChanged(spent: number, seen: number) {
    this.updateLevelHud();
    if (villageLevel(spent) > seen) {
      this.pendingGrow = true;
      this.note = `${this.note ? `${this.note} ` : ''}The village will grow!`;
    }
  }

  private panelKeys() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    const count = this.mode === 'cards' ? loadSave().merchantCards.length : this.mode === 'gear' ? loadSave().inventory.owned.length : DRINK_ORDER.length;
    const prev = JD(k.A) || JD(k.LEFT) || JD(k.W) || JD(k.UP);
    const next = JD(k.D) || JD(k.RIGHT) || JD(k.S) || JD(k.DOWN);
    if (count > 0 && (prev || next)) { this.sel = (this.sel + (next ? 1 : count - 1)) % count; this.note = ''; this.render(); }
    if (JD(k.ENTER) || JD(k.SPACE)) this.choose();
    if (this.mode !== 'bar' && JD(k.Q)) { this.mode = this.mode === 'cards' ? 'gear' : 'cards'; this.sel = 0; this.note = ''; this.render(); }
    if (JD(k.E) || JD(k.ESC)) this.closePanel();
  }

  private choose() {
    const s = loadSave();
    if (this.mode === 'cards') {
      const id = s.merchantCards[this.sel];
      if (!id) return;
      const it = item(id);
      if (s.inventory.owned.includes(id)) { this.note = `${it.name} is already yours.`; this.render(); return; }
      const r = buyItem(s.wallet, s.inventory, id);
      if (!r.ok) this.note = `${it.name} costs ${it.price} rings. You have ${walletValue(s.wallet)}.`;
      else {
        sfx(this, 'buy');
        const after = updateSave((x) => ({ ...x, wallet: r.wallet, inventory: r.inventory, spent: x.spent + it.price }));
        this.wallet.update(r.wallet);
        this.spentChanged(after.spent, after.villageSeen);
        this.note = it.kind === 'special' ? `Bought ${it.name}: a number key in the fight.` : `Bought and equipped: ${it.name}.`;
        this.popCard = this.sel;
        this.refreshHand();
        if ((it.kind === 'melee' || it.kind === 'range') && !after.handRevealed) {
          this.revealHand = true;
          this.note = `${this.note} Check your hand when you leave!`;
        }
      }
    } else if (this.mode === 'gear') {
      const id = s.inventory.owned[this.sel];
      if (!id) return;
      const it = item(id);
      if (it.kind === 'special') this.note = `${it.name} is always ready: a number key in the fight.`;
      else { updateSave((x) => ({ ...x, inventory: equip(x.inventory, id) })); this.note = `Equipped: ${it.name}.`; this.refreshHand(); }
    } else {
      const id = DRINK_ORDER[this.sel];
      const d = DRINKS[id];
      const paid = pay(s.wallet, d.price);
      if (!paid) this.note = `${d.name} is ${d.price} rings.`;
      else {
        sfx(this, 'buy');
        const after = updateSave((x) => ({ ...x, wallet: paid, drink: id, spent: x.spent + d.price }));
        this.wallet.update(paid);
        this.spentChanged(after.spent, after.villageSeen);
        this.pour = true;
        this.note = s.drink ? `${d.name} instead of ${DRINKS[s.drink].name}. Drunk at the next fight.` : `${d.name}: you drink it when the fight starts.`;
      }
    }
    this.render();
  }

  /** One frame + title for every panel. Returns [container, background graphics, x, y, w, h]. */
  private frame(title: string, sub: string, npc: string, border: number, w: number, h: number) {
    this.panel?.destroy();
    const x = (WIDTH - w) / 2;
    const y = PLAY.y + (PLAY.height - h) / 2;
    const c = this.add.container(0, 0).setDepth(960);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    bg.fillStyle(0x1a1424).fillRect(x, y, w, h);
    bg.fillStyle(border).fillRect(x, y, w, 1).fillRect(x, y + h - 1, w, 1).fillRect(x, y, 1, h).fillRect(x + w - 1, y, 1, h);
    c.add(bg);
    c.add(this.anims.exists(npc) ? this.add.sprite(x + 11, y + 11, `${npc}_0`).play(npc) : this.add.image(x + 11, y + 11, npc));
    c.add(this.add.text(x + 22, y + 4, title, { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 22, y + 13, sub, { ...FONT, color: '#a898c8' }));
    c.add(this.add.text(x + w - 6, y + 4, `${walletValue(loadSave().wallet)} rings`, { ...FONT, color: '#ffcc44' }).setOrigin(1, 0));
    this.panel = c;
    return { c, bg, x, y, w, h };
  }

  private render() {
    if (this.mode === 'cards') this.renderCards();
    else if (this.mode === 'gear') this.renderGear();
    else this.renderBar();
  }

  /** Three cards on the merchant's table: dealt with a flip when the shop opens, a bought one pops. */
  private renderCards() {
    const s = loadSave();
    const { c, x, y, w, h } = this.frame('THE RING MERCHANT', '"Three today. New ones when you come back."', 'merchant', 0x8a5fc0, 272, 164);
    const cw = 80;
    const ch = 104;
    const gap = 8;
    const cx0 = x + (w - (3 * cw + 2 * gap)) / 2;
    const cy = y + 26;
    const money = walletValue(s.wallet);
    if (!s.merchantCards.length) c.add(this.add.text(x + w / 2, cy + 40, 'You own everything!', { ...FONT, color: '#ffffff' }).setOrigin(0.5));
    s.merchantCards.forEach((id, i) => {
      const it = item(id);
      const sold = s.inventory.owned.includes(id);
      const picked = i === this.sel;
      const col = KIND_COLORS[it.kind];
      // each card is its own container, centred, so it can flip and pop
      const card = this.add.container(cx0 + i * (cw + gap) + cw / 2, cy + ch / 2 - (picked ? 4 : 0));
      const L = -cw / 2;
      const T = -ch / 2;
      const g = this.add.graphics();
      g.fillStyle(sold ? 0x1e1e24 : 0x2a2238).fillRect(L, T, cw, ch);
      g.fillStyle(picked ? 0xffffff : col).fillRect(L, T, cw, 2).fillRect(L, T + ch - 2, cw, 2).fillRect(L, T, 2, ch).fillRect(L + cw - 2, T, 2, ch);
      g.fillStyle(col, 0.85).fillRect(L + 2, T + 2, cw - 4, 10);
      card.add(g);
      card.add(this.add.text(0, T + 3, KIND_NAMES[it.kind], { ...FONT, color: '#ffffff' }).setOrigin(0.5, 0));
      const ic = this.add.image(0, T + 28, it.kind === 'melee' || it.kind === 'range' ? `held_${id}` : `icon_${id}`);
      ic.setScale(Math.min(2, 30 / Math.max(ic.width, ic.height)));
      if (sold) ic.setAlpha(0.35);
      card.add(ic);
      card.add(this.add.text(0, T + 44, it.name, { ...FONT, color: sold ? '#666666' : '#ffffff' }).setOrigin(0.5, 0));
      card.add(this.add.text(L + 5, T + 56, this.cardStats(it), { ...FONT, color: sold ? '#555555' : '#c8b8e8', wordWrap: { width: cw - 10 }, lineSpacing: 1 }));
      card.add(this.add.text(0, T + ch - 12, sold ? 'SOLD' : `${it.price} rings`, { ...FONT, color: sold ? '#6fd13a' : money >= it.price ? '#ffcc44' : '#ff6a6a' }).setOrigin(0.5, 0));
      c.add(card);
      if (this.dealCards) {          // dealt from the merchant: slides in face down, flips over
        const tx = card.x;
        const ty = card.y;
        card.setPosition(x + 14, y + 12).setScale(0.2, 0.2).setAlpha(0);
        this.tweens.add({ targets: card, x: tx, y: ty, scaleY: 1, alpha: 1, duration: 260, delay: i * 140, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: card, scaleX: 1, duration: 200, delay: i * 140 + 200, ease: 'Back.easeOut' });
      }
      if (i === this.popCard) {      // just bought: a happy pop with sparkles
        this.tweens.add({ targets: card, scale: 1.12, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
        for (let k = 0; k < 6; k++) {
          const sp = this.add.image(card.x + Phaser.Math.Between(-cw / 2, cw / 2), card.y + Phaser.Math.Between(-ch / 2, ch / 2), 'sparkle');
          c.add(sp);
          this.tweens.add({ targets: sp, y: sp.y - 10, alpha: 0, duration: 600, delay: k * 60 });
        }
      }
    });
    this.dealCards = false;
    this.popCard = -1;
    if (this.note) c.add(this.add.text(x + 8, y + h - 21, this.note, { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 8, y + h - 11, 'A/D pick  Enter buy  Q your gear  E leave', { ...FONT, color: '#888888' }));
  }

  private cardStats(it: CatalogItem): string {
    const cd = it.cooldownMs ? `cooldown ${it.cooldownMs / 1000}s` : '';
    if (it.kind === 'armor') return `${it.desc}\nworn in every fight`;
    if (it.kind === 'special') return `${it.desc}\n${cd}`;
    return `${it.damage} damage\n${cd}\n${it.desc}`;
  }

  /** Everything you own: equip a different weapon or armor. */
  private renderGear() {
    const s = loadSave();
    const inv = s.inventory;
    const { c, bg, x, y, h } = this.frame('YOUR GEAR', 'Enter on a weapon or armor to wear it.', 'player', 0x6fd13a, 240, 150);
    if (!inv.owned.length) c.add(this.add.text(x + 10, y + 34, 'Nothing yet: buy a card first.', { ...FONT, color: '#ffffff' }));
    const visible = 9;
    const start = Phaser.Math.Clamp(this.sel - 4, 0, Math.max(0, inv.owned.length - visible));
    inv.owned.slice(start, start + visible).forEach((id: CatalogId, n) => {
      const i = start + n;
      const it = item(id);
      const ry = y + 28 + n * 11;
      if (i === this.sel) bg.fillStyle(0x2a3a2a).fillRect(x + 3, ry - 2, 234, 11);
      const worn = inv.melee === id || inv.range === id || inv.armor === id;
      c.add(this.add.text(x + 8, ry, `${i === this.sel ? '>' : ' '}${it.name}`, FONT));
      c.add(this.add.text(x + 100, ry, KIND_NAMES[it.kind].toLowerCase(), { ...FONT, color: '#8a8a8a' }));
      c.add(this.add.text(x + 232, ry, worn ? 'EQUIPPED' : it.kind === 'special' ? 'key 1-8' : '', { ...FONT, color: worn ? '#6fd13a' : '#9fd3ff' }).setOrigin(1, 0));
    });
    if (this.note) c.add(this.add.text(x + 8, y + h - 21, this.note, { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 8, y + h - 11, 'W/S choose  Enter wear  Q cards  E leave', { ...FONT, color: '#888888' }));
  }

  /** The bar: one drink, drunk at the start of the next fight. Buying one pours it into a big mug. */
  private renderBar() {
    const s = loadSave();
    const { c, bg, x, y, h } = this.frame('THE BAR', '"One drink each. It kicks in at the fight."', 'barkeeper', 0xc89a3a, 240, 124);
    DRINK_ORDER.forEach((id, i) => {
      const d = DRINKS[id];
      const ry = y + 30 + i * 13;
      if (i === this.sel) bg.fillStyle(0x3a2a18).fillRect(x + 3, ry - 2, 234, 12);
      c.add(this.add.image(x + 12, ry + 3, 'mug'));
      c.add(this.add.text(x + 22, ry, `${i === this.sel ? '>' : ' '}${d.name}`, FONT));
      c.add(this.add.text(x + 84, ry, d.desc, { ...FONT, color: '#e8c890' }));
      c.add(this.add.text(x + 232, ry, s.drink === id ? 'IN HAND' : `${d.price} rings`, { ...FONT, color: s.drink === id ? '#6fd13a' : walletValue(s.wallet) >= d.price ? '#ffcc44' : '#ff6a6a' }).setOrigin(1, 0));
    });
    // the big mug: pours when you just bought, else shows your drink (or stands empty)
    const mug = this.add.graphics();
    c.add(mug);
    const mx = x + 206;
    const my = y + 74;
    const draw = (f: number) => {
      if (!mug.active) return;
      const fill = Math.round(20 * f);
      mug.clear();
      if (f < 1 && f > 0) mug.fillStyle(0xd89a2a).fillRect(mx + 7, my - 12, 2, 12 + 21 - fill);       // the stream from the tap
      mug.fillStyle(0x6b4a2b).fillRect(mx + 3, my - 14, 10, 3);                                         // the tap
      mug.fillStyle(0xd89a2a).fillRect(mx + 1, my + 21 - fill, 14, fill);                               // beer
      if (f > 0.8) mug.fillStyle(0xffffff).fillRect(mx + 1, my + 21 - fill - 3, 14, 3).fillRect(mx + 3, my + 21 - fill - 5, 4, 2).fillRect(mx + 9, my + 21 - fill - 4, 3, 1);
      for (let b = 0; b < 4 && fill > 4; b++) mug.fillStyle(0xffe8a8).fillRect(mx + 3 + b * 3, my + 20 - ((f * 40 + b * 6) % Math.max(1, fill)), 1, 1);   // bubbles
      mug.lineStyle(1, 0xdddddd, 0.9).strokeRect(mx, my, 16, 22).strokeRect(mx + 16, my + 6, 4, 9);
    };
    if (this.pour) {
      this.pour = false;
      const st = { f: 0 };
      const tw = this.tweens.add({ targets: st, f: 1, duration: 900, ease: 'Sine.easeOut', onUpdate: () => draw(st.f), onComplete: () => draw(1) });
      c.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
    } else {
      draw(s.drink ? 1 : 0);
    }
    if (this.note) c.add(this.add.text(x + 8, y + h - 21, this.note, { ...FONT, color: '#ffcc44', wordWrap: { width: 180 } }));
    c.add(this.add.text(x + 8, y + h - 11, 'W/S choose  Enter buy  E leave', { ...FONT, color: '#888888' }));
  }

  // ---- what's in hand ----

  /** The indicator shows your equipped weapons; in the village the melee (or ranged) one is "in hand". */
  private refreshHand() {
    const w = loadout(loadSave().inventory).weapons;
    if (!hasWeapon(w)) return;
    this.hand.update(w, 1);
    if (this.hand.visible) showHandArt(this, w[1]);   // the big picture beside the game
  }

  /** The first weapon: the indicator pops up once, with a banner. */
  private doRevealHand() {
    if (!this.revealHand) return;
    this.revealHand = false;
    updateSave((x) => ({ ...x, handRevealed: true }));
    this.refreshHand();
    this.hand.reveal();
    this.refreshHand();
    sfx(this, 'levelup', 0.4);
    banner(this, 'IN HAND', 'Your weapon, bottom left. Q switches weapons in the fight.');
  }

  // ---- the village grows ----

  /**
   * Makes the village look like `level`. What this stage replaces goes first (shrinks away in
   * dust), then the new parts are built (spring up, sparkle). animate = false: just place them.
   */
  private applyLevel(level: number, animate: boolean) {
    const shown = (p: Part) => p.lvl <= level && level < (p.until ?? 99);
    let gone = 0;
    for (const [p, e] of [...this.placed]) {
      if (shown(p)) continue;
      this.placed.delete(p);
      if (e.zone) this.solids.remove(e.zone, true, true);
      if (!animate) { e.obj.destroy(); continue; }
      const o = e.obj;
      this.tweens.add({
        targets: o, scaleY: 0, alpha: 0, duration: 260, delay: gone++ * 110, ease: 'Quad.easeIn',
        onStart: () => dustPuff(this, o.x, o.y + o.displayHeight / 2 - 4, 6, 10), onComplete: () => o.destroy(),
      });
    }
    const start = animate ? 300 + gone * 110 : 0;
    let built = 0;
    for (const p of PARTS) {
      if (!shown(p) || this.placed.has(p)) continue;
      const x = PLAY.x + p.x;
      const y = PLAY.y + p.y;
      const obj = p.anim ? this.add.sprite(x, y, p.key).play(p.anim) : this.add.image(x, y, p.key);
      obj.setDepth(p.depth ?? 5);
      if (p.swing) {   // a hanging sign: pivot at the top, sways
        obj.setOrigin(0.5, 0);
        this.tweens.add({ targets: obj, angle: { from: -9, to: 9 }, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
      }
      let zone: Phaser.GameObjects.Zone | undefined;
      if (p.solid) { zone = this.add.zone(x, y + p.solid[2], p.solid[0], p.solid[1]); this.solids.add(zone); }
      this.placed.set(p, { obj, zone });
      if (animate) {
        const sy = obj.scaleY;
        obj.setScale(obj.scaleX, 0);
        this.tweens.add({
          targets: obj, scaleY: sy, duration: 380, delay: start + built++ * 180, ease: 'Back.easeOut',
          onStart: () => { dustPuff(this, x, y + obj.displayHeight / 2 - 4, 6, 12); this.sparkle(x, y - obj.height / 2); },
        });
      }
    }
    const layer = (lvl: number, depth: number, draw: (g: Phaser.GameObjects.Graphics) => Phaser.GameObjects.Graphics) => {
      if (level < lvl || this.layers.has(lvl)) return;
      this.layers.add(lvl);
      const g = draw(this.add.graphics().setDepth(depth));
      if (animate) { g.setAlpha(0); this.tweens.add({ targets: g, alpha: 1, duration: 600, delay: start }); }
    };
    layer(3, 1, (g) => this.drawCobbles(g));
    layer(4, 8, (g) => this.drawBunting(g));
    layer(5, 4, (g) => this.drawWall(g));
    this.solids.refresh();
    this.addVillagers(Math.min(level - 1, 3));
    if (level >= 5) this.addNobles(2);
    if (level >= 6) this.addCarts(2);
  }

  /** Build the levels reached since the player last looked, with a banner. */
  private grow() {
    const save = loadSave();
    const level = villageLevel(save.spent);
    const from = save.villageSeen;
    if (level <= from) return;
    updateSave((x) => ({ ...x, villageSeen: level }));
    this.applyLevel(level, true);
    sfx(this, 'levelup');
    this.cameras.main.shake(200, 0.006);
    banner(this, 'THE VILLAGE GROWS!', `Level ${level}: ${villageProgress(save.spent).name}. Mossback drops +${Math.round((ringLuck(level) - 1) * 100)}% rings.`);
    this.updateLevelHud();
  }

  private updateLevelHud() {
    const p = villageProgress(loadSave().spent);
    const { g, name, next, luck } = this.levelHud;
    const pct = Math.round((ringLuck(p.level) - 1) * 100);
    luck.setText(pct ? `+${pct}% boss rings` : '');
    name.setText(`${p.name} (${p.level}/6)`);
    next.setText(p.next === null ? 'fully built!' : `${loadSave().spent}/${p.next} spent`);
    const w = 60;
    const x = PLAY.x + PLAY.width - 4 - w;
    const y = PLAY.y + 11;
    g.clear().fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle(0x2a3a20).fillRect(x, y, w, 2).fillStyle(0xffcc44).fillRect(x, y, Math.round(w * p.frac), 2);
  }

  private sparkle(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const sp = this.add.image(x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-3, 3), 'sparkle').setDepth(12);
      this.tweens.add({ targets: sp, y: sp.y - 8, alpha: 0, duration: 700, delay: i * 90, onComplete: () => sp.destroy() });
    }
  }

  /** Villagers walking up and down the road: one more per level. */
  private addVillagers(count: number) {
    while (this.villagers.length < count) {
      const i = this.villagers.length;
      const y = PLAY.y + 108 + (i % 3) * 4;
      const x1 = PLAY.x + 14 + ((i * 47) % 90);
      const x2 = x1 + 70 + ((i * 31) % 90);
      const v = this.add.image(x1, y, i % 2 ? 'villager_b' : 'villager_a').setDepth(9);
      this.tweens.add({
        targets: v, x: x2, duration: (x2 - x1) * 55, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 400,
        onYoyo: () => v.setFlipX(true), onRepeat: () => v.setFlipX(false),
      });
      this.villagers.push(v);
    }
  }

  /** Rich people (stage 5): stroll slowly along the road, stop to look around, go back. */
  private addNobles(count: number) {
    while (this.nobles.length < count) {
      const i = this.nobles.length;
      const x1 = PLAY.x + (i ? 150 : 40);
      const x2 = x1 + 90;
      const n = this.add.image(x1, PLAY.y + 107, i ? 'noble_b' : 'noble_a').setDepth(9);
      this.tweens.add({
        targets: n, x: x2, duration: 90 * (x2 - x1), yoyo: true, repeat: -1, hold: 1400, repeatDelay: 1400, delay: i * 1500, ease: 'Sine.easeInOut',
        onYoyo: () => n.setFlipX(true), onRepeat: () => n.setFlipX(false),
      });
      this.tweens.add({ targets: n, y: n.y - 1, yoyo: true, repeat: -1, duration: 260 });   // a proud little bob
      this.nobles.push(n);
    }
  }

  /** Horse carts (stage 6): drive along the road one way and the other, fading out at the ends. */
  private addCarts(count: number) {
    while (this.carts.length < count) {
      const i = this.carts.length;
      const left = PLAY.x - 22;
      const right = PLAY.x + 248;
      const toRight = i === 0;
      const c = this.add.sprite(toRight ? left : right, PLAY.y + (toRight ? 113 : 108), 'cart_0').play('cart').setDepth(9).setFlipX(!toRight);
      this.tweens.add({
        targets: c, x: toRight ? right : left, duration: 9000, repeat: -1, delay: i * 4500,
        onUpdate: () => c.setAlpha(Phaser.Math.Clamp(Math.min(c.x - left, right - c.x) / 18, 0, 1)),
      });
      this.carts.push(c);
    }
  }

  private drawCobbles(g: Phaser.GameObjects.Graphics) {
    for (let x = 0; x < PLAY.width - 48; x += 6) for (let row = 0; row < 3; row++) {
      g.fillStyle(row % 2 ? 0xa89a7a : 0xb8aa8a).fillRect(PLAY.x + x + (row % 2) * 3, PLAY.y + 106 + row * 5, 4, 3);
    }
    return g;
  }

  private drawBunting(g: Phaser.GameObjects.Graphics) {
    const x1 = STALL.x + 20;
    const y1 = STALL.y - 16;
    const x2 = BAR.x - 25;
    const y2 = BAR.y - 10;
    g.lineStyle(1, 0x6b4a2b).lineBetween(x1, y1, x2, y2);
    const colors = [0xd83a3a, 0xffcc44, 0x4a90d9, 0x6fd13a];
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * 4;
      g.fillStyle(colors[i % 4]).fillTriangle(x - 2, y, x + 2, y, x, y + 4);
    }
    return g;
  }

  private drawWall(g: Phaser.GameObjects.Graphics) {
    const y = PLAY.y + PLAY.height - 6;
    for (let x = 20; x < PLAY.width - 20; x += 6) {
      g.fillStyle(0x7a7a84).fillRect(PLAY.x + x, y, 5, 3).fillStyle(0x8a8a94).fillRect(PLAY.x + x + 3, y + 3, 5, 3);
    }
    return g;
  }

  // ---- the well ----

  /** Step into the hole: you shrink and spin down, splash, then climb out soaked. */
  private fallInWell() {
    this.locked = true;
    this.prompt.setVisible(false);
    const p = this.player;
    (p.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0).enable = false;
    this.tweens.add({
      targets: p, x: WELL.x, y: WELL.y, scale: 0.15, rotation: Math.PI * 3, alpha: 0.2, duration: 550, ease: 'Quad.easeIn',
      onComplete: () => {
        p.setVisible(false);
        this.cameras.main.shake(160, 0.012);
        floatText(this, WELL.x, WELL.y - 10, 'SPLASH!', '#6ab8ff');
        sfx(this, 'splash');
        for (let i = 0; i < 12; i++) {
          const a = -Math.PI / 2 + (i / 11 - 0.5) * 2.2;
          const d = this.add.image(WELL.x, WELL.y - 2, 'drop').setDepth(11);
          this.tweens.add({ targets: d, x: WELL.x + Math.cos(a) * 18, y: WELL.y - 2 + Math.sin(a) * 18 + 10, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        }
        this.time.delayedCall(1100, () => this.climbOut());
      },
    });
  }

  private climbOut() {
    const p = this.player;
    p.setPosition(WELL.x, WELL.y + 13).setScale(1).setRotation(0).setAlpha(1).setVisible(true);
    this.tweens.add({ targets: p, y: p.y - 5, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    // drip for a while
    this.time.addEvent({
      delay: 160, repeat: 12, callback: () => {
        const d = this.add.image(p.x + Phaser.Math.Between(-3, 3), p.y + 4, 'drop').setDepth(9);
        this.tweens.add({ targets: d, y: d.y + 5, alpha: 0, duration: 400, onComplete: () => d.destroy() });
      },
    });
    let found: Rarity | null = null;
    if (!this.wellLooted && Math.random() < WELL_RING_CHANCE) found = Math.random() < 0.2 ? 'rare' : 'classic';
    this.wellLooted = true;
    if (found) {
      const ring = found;
      const s = updateSave((x) => ({ ...x, wallet: addRings(x.wallet, [ring]), lifetimeRings: addRings(x.lifetimeRings, [ring]) }));
      this.wallet.update(s.wallet);
      sfx(this, 'ring');
      banner(this, 'SPLASH!', `You climbed out with a ${ring === 'rare' ? 'rare' : 'classic'} ring from the bottom.`);
    } else {
      banner(this, 'SPLASH!', 'You climbed out. Soaked, and nothing at the bottom.');
    }
    this.time.delayedCall(350, () => {
      (p.body as Phaser.Physics.Arcade.Body).enable = true;
      (p.body as Phaser.Physics.Arcade.Body).reset(p.x, p.y);
      this.locked = false;
    });
  }

  // ---- bounced back from the arena ----

  /** Bounced back by Mossback: comes bouncing in along the road from the east, skids, lies dizzy, gets up. */
  private bounceIn(kept: number) {
    this.locked = true; // no control until he is back on his feet
    this.cameras.main.fadeIn(350, 255, 255, 255);
    const roadY = PLAY.y + 112;
    const p = this.player;
    p.setPosition(PLAY.x + PLAY.width + 16, roadY - 40).setRotation(0);
    const thud = (x: number, y: number, i: number) => {
      sfx(this, 'bounce', 0.6 - i * 0.12);
      dustPuff(this, x, y, 6, 14 - i * 2);
      this.cameras.main.shake(140 - i * 30, 0.018 - i * 0.004);
    };
    bounce(this, p, [
      { x: PLAY.x + 250, y: roadY, h: 34, ms: 520 },
      { x: PLAY.x + 205, y: roadY, h: 18, ms: 380 },
      { x: PLAY.x + 175, y: roadY, h: 8, ms: 260 },
      { x: PLAY.x + 160, y: roadY, h: 3, ms: 160 },
    ], { spin: -Math.PI * 2, onLand: thud }, () => {
      // skid to a stop, flat on his back
      this.tweens.add({ targets: p, x: p.x - 8, rotation: -Math.PI / 2, duration: 260, ease: 'Quad.easeOut', onComplete: () => this.dizzy(kept) });
    });
  }

  /** Stars circle his head, then he hops back onto his feet. */
  private dizzy(kept: number) {
    const p = this.player;
    const stars = [0, 1, 2].map(() => this.add.image(p.x, p.y - 8, 'sparkle').setDepth(12));
    const spin = { a: 0 };
    this.tweens.add({
      targets: spin, a: Math.PI * 6, duration: 1500,
      onUpdate: () => stars.forEach((st, i) => st.setPosition(p.x + Math.cos(spin.a + i * 2.1) * 7, p.y - 9 + Math.sin(spin.a + i * 2.1) * 2)),
      onComplete: () => {
        stars.forEach((st) => st.destroy());
        this.tweens.add({ targets: p, rotation: 0, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({
          targets: p, y: p.y - 6, duration: 130, yoyo: true, ease: 'Quad.easeOut',
          onComplete: () => {
            this.locked = false;
            banner(this, 'BOUNCED BACK HOME', `${kept ? `You kept ${kept} ring${kept === 1 ? '' : 's'}.` : 'No rings this time.'} The merchant has new cards.`);
          },
        });
      },
    });
    this.wallet.update(loadSave().wallet);
  }

  // ---- catapult ----

  private bucket(rotation: number) {
    return { x: CATAPULT.x + Math.cos(rotation) * ARM_LEN, y: CATAPULT.y + Math.sin(rotation) * ARM_LEN - 3 };
  }

  private launch() {
    this.locked = true;
    this.prompt.setVisible(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0).enable = false;
    const seat = this.bucket(ARM_REST);
    // 1. climb into the bucket
    this.tweens.add({
      targets: this.player, x: seat.x, y: seat.y, duration: 400, ease: 'Quad.easeOut',
      onComplete: () => {
        // 2. wind up (arm pulls back a little), then fire: the arm swings and carries the hero
        const state = { r: ARM_REST };
        const follow = () => {
          this.arm.setRotation(state.r);
          const b = this.bucket(state.r);
          this.player.setPosition(b.x, b.y);
        };
        this.tweens.add({
          targets: state, r: ARM_REST + 0.12, duration: 350, ease: 'Sine.easeInOut', onUpdate: follow,
          onComplete: () => this.tweens.add({ targets: state, r: ARM_FIRE, duration: 220, ease: 'Quad.easeIn', onUpdate: follow, onComplete: () => this.fly() }),
        });
      },
    });
  }

  private fly() {
    sfx(this, 'launch');
    this.cameras.main.shake(150, 0.01);
    const start = { x: this.player.x, y: this.player.y };
    const t = { p: 0 };
    // 3. a high arc to the north-east, growing (closer to the camera) and spinning, then gone
    this.tweens.add({
      targets: t, p: 1, duration: 1100, ease: 'Sine.easeIn',
      onUpdate: () => {
        this.player.setPosition(start.x + 80 * t.p, start.y - 150 * t.p + 60 * t.p * t.p);
        this.player.setScale(1 + 2.5 * t.p).setRotation(t.p * Math.PI * 4);
      },
    });
    this.time.delayedCall(800, () => {
      this.cameras.main.fadeOut(400, 255, 255, 255);   // white flash: the jump cut into the arena
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('play', { landing: true }));
    });
  }

  // ---- the village itself ----

  private drawVillage(): Phaser.Physics.Arcade.StaticGroup {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x4f8a3a).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    for (let i = 0; i < 180; i++) {
      g.fillStyle(i % 5 ? 0x5c9a44 : 0x3f7a30).fillRect(PLAY.x + ((i * 53) % PLAY.width), PLAY.y + ((i * 97 + (i % 7) * 13) % PLAY.height), 1, 1);
    }
    g.fillStyle(0xc8a86a).fillRect(PLAY.x, PLAY.y + 104, PLAY.width - 48, 16);                     // main road
    g.fillStyle(0xb8985a).fillRect(PLAY.x, PLAY.y + 104, PLAY.width - 48, 1).fillRect(PLAY.x, PLAY.y + 119, PLAY.width - 48, 1);
    g.fillStyle(0xc8a86a).fillRect(STALL.x - 6, STALL.y + 14, 12, 90);                              // path to the stall
    g.fillStyle(0xc8a86a).fillRect(BAR_DOOR.x - 6, BAR_DOOR.y - 2, 12, 104 - (BAR_DOOR.y - PLAY.y) + 2); // path to the bar
    // the well: stone rim, dark water, two posts and a crossbeam with a rope
    g.fillStyle(0x6a6a6a).fillCircle(WELL.x, WELL.y, 9);
    g.fillStyle(0x8a8a8a).fillCircle(WELL.x, WELL.y - 1, 8);
    g.fillStyle(0x0e2236).fillCircle(WELL.x, WELL.y, 6);
    g.fillStyle(0x1e4f7a).fillCircle(WELL.x, WELL.y + 1, 4);
    g.fillStyle(0x6b4a2b).fillRect(WELL.x - 10, WELL.y - 12, 2, 12).fillRect(WELL.x + 8, WELL.y - 12, 2, 12).fillRect(WELL.x - 10, WELL.y - 13, 20, 2);
    g.fillStyle(0xc8a86a).fillRect(WELL.x, WELL.y - 11, 1, 6);

    const solids = this.physics.add.staticGroup();
    const block = (x: number, y: number, w: number, h: number) => solids.add(this.add.zone(x, y, w, h));
    block(WELL.x - 9, WELL.y - 6, 2, 10);                   // the well's posts; the hole itself is open: you can fall in
    block(WELL.x + 9, WELL.y - 6, 2, 10);
    block(CATAPULT.x - 2, CATAPULT.y + 10, 24, 6);         // the catapult frame
    solids.refresh();
    return solids;
  }
}
