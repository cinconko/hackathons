import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { Combat, SPELL_SPEED } from '../combat';
import { bounce, dustPuff } from '../fx';
import {
  addRings, buyItem, SPECIAL, DRINK_ORDER, DRINKS, equip, item, KIND_NAMES, loadout, pay, ringLuck, dealFits, dealMerchant, MERCHANT_NAMES, MERCHANT_SELLS, villageLevel, villageProgress, walletValue, WELL_RING_CHANCE,
  type CatalogId, type CatalogItem, type ItemKind, type MerchantKind, type Rarity, type SpecialId,
} from '../game/rules';
import { handHud, hasWeapon } from '../hand';
import { hideHandArt, showHandArt } from '../handArt';
import { MERCHANT_ROBES, playMusic, sfx } from '../media';
import { bouncedBackLines, GRANDPA, NPCS, talk, type NpcId } from '../game/npcs';
import { addKeys, near, steer, type Keys, dress, heroLook } from '../player';
import { loadSave, updateSave } from '../save';
import { banner, floatText, FONT, hex, TITLE_FONT, walletHud } from '../ui';
import { drawRope, placeCatapult, seat, type Catapult } from '../catapult';
import { BOOK_H, BOOK_PAGE, clearSpot, clothColor, clothPatch, crisp, priceTag, shopBook, wareArt } from '../shopArt';
import { Tutorial } from '../tutorial';
import { FLOOR_PATCH, makeShopTextures, shopFloor, shopFloorArt } from '../merchantShops';
import { CHIMNEYS, villageGround } from '../villageArt';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Body = Phaser.Physics.Arcade.Body;
type Panel = 'cards' | 'gear' | 'bar';

const STALL = { x: PLAY.x + 120, y: PLAY.y + 46 };
const BAR = { x: PLAY.x + 222, y: PLAY.y + 38 };
const BAR_DOOR = { x: BAR.x, y: BAR.y + 20 };
const WELL = { x: PLAY.x + 70, y: PLAY.y + 142 };
const CATAPULT = { x: PLAY.x + PLAY.width - 24, y: PLAY.y + 82 };
const CAT_SCALE = 2;
const YARD = { x: PLAY.x + 132, y: PLAY.y + 128, width: 80, height: 34 };
const YARD_GAP = { x: YARD.x + 22, width: 18 };
const DUMMY = { x: YARD.x + 58, y: YARD.y + 16 };
const SPECIAL_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'] as const;
const ROAD_Y = PLAY.y + 112;
const SHOPS = [
  { id: 'merchant', x: STALL.x, stopY: PLAY.y + 76, minLvl: 1 },
  { id: 'bar', x: BAR_DOOR.x, stopY: PLAY.y + 66, minLvl: 1 },
  { id: 'fruit', x: PLAY.x + 40, stopY: PLAY.y + 132, minLvl: 4 },
];
const ARM_REST = Math.PI * 0.92;
const ARM_FIRE = Math.PI * 1.65;
interface Part { lvl: number; until?: number; key: string; x: number; y: number; solid?: [number, number, number]; anim?: string; depth?: number; swing?: boolean }
const forest = (until: number, pts: [number, number][]): Part[] => pts.map(([x, y]) => ({ lvl: 1, until, key: 'tree', x, y, solid: [6, 6, 6] }));
const PARTS: readonly Part[] = [
  ...forest(99, [[62, 32], [170, 20], [14, 82], [280, 150]]),
  ...forest(2, [[60, 66], [80, 78], [184, 64], [196, 80], [232, 140], [246, 152], [28, 36], [44, 46]]),
  ...forest(3, [[42, 92], [250, 86], [150, 68]]),
  ...forest(4, [[100, 150], [36, 150]]),
  ...forest(5, [[300, 140]]),
  ...forest(6, [[205, 86]]),
  { lvl: 1, key: 'bush_big_berry', x: 20, y: 62, depth: 4 },
  { lvl: 1, key: 'bush_mid', x: 300, y: 120, depth: 4 },
  { lvl: 1, key: 'bush_mid_berry', x: 292, y: 58, depth: 4 },
  { lvl: 1, until: 2, key: 'campfire_wood_0', anim: 'campfire_wood', x: 158, y: 86, solid: [12, 6, 4] },
  { lvl: 2, until: 4, key: 'campfire_stone_0', anim: 'campfire_stone', x: 158, y: 86, solid: [12, 6, 4] },
  { lvl: 1, until: 3, key: 'blanket', x: 120, y: 56, solid: [34, 6, 2] },
  { lvl: 1, until: 3, key: 'barrel', x: 236, y: 50, solid: [10, 6, 3] },
  { lvl: 1, until: 3, key: 'beerguy_0', anim: 'beerguy', x: 222, y: 47, depth: 6, solid: [16, 6, 4] },
  { lvl: 1, until: 3, key: 'merchant_0', anim: 'merchant', x: 120, y: 42, depth: 6 },
  { lvl: 2, until: 3, key: 'tent_a', x: 70, y: 72, solid: [20, 8, 4] },
  { lvl: 2, until: 3, key: 'tent_b', x: 188, y: 68, solid: [20, 8, 4] },
  { lvl: 2, until: 3, key: 'tent_a', x: 232, y: 146, solid: [20, 8, 4] },
  { lvl: 2, until: 3, key: 'hut', x: 34, y: 40, solid: [20, 10, 5] },
  { lvl: 3, key: 'house', x: 70, y: 72, solid: [26, 14, 5] },
  { lvl: 3, key: 'house', x: 188, y: 68, solid: [26, 14, 5] },
  { lvl: 3, key: 'house', x: 232, y: 146, solid: [26, 14, 5] },
  { lvl: 3, until: 5, key: 'house', x: 34, y: 40, solid: [26, 14, 5] },
  { lvl: 3, key: 'bar', x: 222, y: 38, solid: [46, 16, 4] },
  { lvl: 3, key: 'mug', x: 252, y: 30, depth: 8, swing: true },
  { lvl: 3, key: 'barkeeper_0', anim: 'barkeeper', x: 241, y: 58, depth: 6 },
  { lvl: 3, until: 4, key: 'stall', x: 120, y: 50, depth: 7, solid: [40, 8, 6] },
  { lvl: 3, until: 4, key: 'merchant_0', anim: 'merchant', x: 91, y: 52, depth: 6 },
  { lvl: 4, until: 5, key: 'shop_booth', x: 120, y: 50, depth: 7, solid: [44, 8, 6] },
  { lvl: 5, until: 6, key: 'shop_house', x: 120, y: 47, depth: 7, solid: [46, 10, 8] },
  { lvl: 6, key: 'shop_emporium', x: 120, y: 47, depth: 7, solid: [52, 10, 8] },
  { lvl: 4, key: 'merchant_0', anim: 'merchant', x: 87, y: 53, depth: 6 },
  ...[60, 92, 136, 195, 250].map((x): Part => ({ lvl: 3, key: 'lantern_0', anim: 'lantern', x, y: 97 })),
  { lvl: 3, key: 'flowers', x: 70, y: 89 },
  { lvl: 3, key: 'flowers', x: 188, y: 85 },
  { lvl: 4, key: 'fountain_0', anim: 'fountain', x: 158, y: 84, solid: [22, 8, 5] },
  { lvl: 4, key: 'fountain_0', anim: 'fountain', x: 100, y: 150, solid: [22, 8, 5] },
  { lvl: 4, key: 'fruitstall', x: 36, y: 146, solid: [26, 6, 4] },
  { lvl: 4, key: 'well_roof', x: 70, y: 127, depth: 8 },
  { lvl: 4, key: 'flowers', x: 34, y: 57 },
  { lvl: 5, key: 'house_big', x: 34, y: 42, solid: [28, 14, 9] },
  { lvl: 5, key: 'tower', x: 12, y: 150, solid: [16, 8, 12] },
  { lvl: 5, key: 'tower', x: 300, y: 150, solid: [16, 8, 12] },
  { lvl: 6, key: 'statue', x: 205, y: 90, solid: [14, 6, 8] },
  { lvl: 6, key: 'flag_0', anim: 'flag', x: 16, y: 127, depth: 8 },
  { lvl: 6, key: 'flag_0', anim: 'flag', x: 304, y: 127, depth: 8 },
];

const VEIL = 0.5;
const KIND_COLORS: Readonly<Record<ItemKind, number>> = { range: 0x4a90d9, melee: 0xd94a4a, special: 0xa04ad9, armor: 0x9a9aa8 };
const MERCHANT_LOOK: Readonly<Record<MerchantKind, { title: string; line: string; color: number }>> = {
  ranger: { title: 'THE RANGER', line: '"Bows and slings, mostly. Three today."', color: KIND_COLORS.range },
  smith: { title: 'THE SMITH', line: '"Fresh off the anvil. Three today."', color: KIND_COLORS.melee },
  armorer: { title: 'THE ARMORER', line: '"Mossback hits hard. Wear something."', color: KIND_COLORS.armor },
  alchemist: { title: 'THE ALCHEMIST', line: '"Spells and potions. Mind the green one."', color: 0x4ab84a },
  peddler: { title: 'THE PEDDLER', line: '"A bit of everything. Three today."', color: 0xd9822a },
  special: { title: 'THE SPECIAL MERCHANT', line: '"Rare to see me. Five today, one at a steal."', color: 0xc89a1a },
};

export interface VillageData { tutorial?: boolean; fromIntro?: boolean; bouncedBack?: boolean; fromRun?: boolean; kept?: number; openShop?: boolean; openBar?: boolean; inYard?: boolean }

interface Cart {
  sprite: Phaser.GameObjects.Sprite;
  dir: 1 | -1;
  state: 'road' | 'in' | 'unload' | 'out';
  shop: (typeof SHOPS)[number] | null;
  until: number;
}

export class VillageScene extends Phaser.Scene {
  private player!: Sprite;
  private keys!: Keys;
  private cat!: Catapult;
  private prompt!: Phaser.GameObjects.Text;
  private wallet!: ReturnType<typeof walletHud>;
  private panel: Phaser.GameObjects.Container | null = null;
  private mode: Panel = 'cards';
  private note = '';
  private sel = 0;
  private locked = false;
  private wellLooted = false;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private placed = new Map<Part, { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; zone?: Phaser.GameObjects.Zone }>();
  private layers = new Set<number>();
  private villagers: Phaser.GameObjects.Image[] = [];
  private nobles: Phaser.GameObjects.Image[] = [];
  private carts: Cart[] = [];
  private shopBusyUntil = new Map<string, number>();
  private npcs: { id: NpcId; sprite: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Text; walk?: Phaser.Tweens.Tween }[] = [];
  private tutorial: Tutorial | null = null;
  private dialog: { box: Phaser.GameObjects.Container; lines: string[]; i: number; typing: Phaser.Time.TimerEvent | null; text: Phaser.GameObjects.Text; onClose?: () => void } | null = null;
  private afterBounce: (() => void)[] = [];
  private dealCards = false;
  private popCard = -1;
  private bookShown = -1;
  private pour = false;
  private hand!: ReturnType<typeof handHud>;
  private revealHand = false;
  private natureSeed = 1;
  private gearTop = 0;
  private paths: Phaser.GameObjects.TileSprite[] = [];
  private levelHud!: { g: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text; next: Phaser.GameObjects.Text; luck: Phaser.GameObjects.Text };
  private pendingGrow = false;
  private combat!: Combat;
  private dummy!: Sprite;
  private inYard = false;
  private trainText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private hits: { t: number; dmg: number }[] = [];
  private totalDmg = 0;
  private bestHit = 0;

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
    this.shopBusyUntil = new Map();
    this.npcs = [];
    this.dialog = null;
    this.afterBounce = [];
    this.grandpa = null;
    this.paths = [];
    if (!loadSave().natureSeed) updateSave((x) => ({ ...x, natureSeed: Phaser.Math.Between(1, 1e9) }));
    this.natureSeed = loadSave().natureSeed;
    this.placed = new Map();
    this.layers = new Set();
    this.pendingGrow = false;
    this.dealCards = false;
    this.popCard = -1;
    this.pour = false;
    this.revealHand = false;
    this.inYard = false;
    this.hits = [];
    this.totalDmg = 0;
    this.bestHit = 0;

    const save = loadSave();
    let specialArrived = false;
    const saved = { kind: save.merchantKind, cards: save.merchantCards, special: save.merchantSpecial };
    if (data.bouncedBack || data.fromRun || !save.merchantCards.length || !dealFits(saved)) {
      const deal = dealMerchant(Math.random, save.inventory.owned);
      specialArrived = deal.kind === 'special';
      updateSave((s) => ({ ...s, merchantKind: deal.kind, merchantCards: deal.cards, merchantSpecial: deal.special }));
    }

    this.physics.world.setBounds(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    makeShopTextures(this);
    const solids = this.drawVillage();
    this.solids = solids;

    this.add.text(STALL.x, STALL.y - 20, 'RING MERCHANT', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(8);
    this.add.text(BAR.x, BAR.y - 10, 'TAVERN', { ...FONT, color: '#ffd27a' }).setOrigin(0.5).setDepth(8);
    this.cat = placeCatapult(this, CATAPULT.x, CATAPULT.y, ARM_REST, CAT_SCALE);
    this.add.text(PLAY.x + PLAY.width - 52, CATAPULT.y - 22, "TO MOSSBACK'S LAIR", { ...FONT, color: '#ff8888' }).setOrigin(0.5).setDepth(8);
    this.addPeople();

    const start = data.inYard ? { x: YARD.x + 20, y: YARD.y + 18 } : { x: PLAY.x + 44, y: PLAY.y + 112 };
    this.player = this.physics.add.sprite(start.x, start.y, 'player').setCollideWorldBounds(true).setDepth(10);
    this.dressHero();
    this.physics.add.collider(this.player, solids);
    this.keys = addKeys(this);
    this.addYard();

    this.prompt = this.add.text(0, 0, '', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(950);
    this.wallet = walletHud(this, PLAY.x + 4, PLAY.y + 4);
    this.wallet.update(loadSave().wallet);
    this.hint = this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + PLAY.height - 10, 'WASD move   E use', { ...FONT, color: '#2f5a2a' }).setOrigin(1, 0).setDepth(950);
    this.hand = handHud(this, PLAY.x + 4, PLAY.y + PLAY.height - 20);
    this.refreshHand();
    if (hasWeapon(loadout(save.inventory).weapons) && !save.handRevealed) this.revealHand = true;
    else if (this.hand.visible || hasWeapon(loadout(save.inventory).weapons)) { this.hand.show(); this.refreshHand(); }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hideHandArt());
    this.levelHud = {
      g: this.add.graphics().setDepth(950),
      name: this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 2, '', { ...FONT, color: '#ffffff' }).setOrigin(1, 0).setDepth(950),
      next: this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 15, '', { ...FONT, color: '#c8e8b8' }).setOrigin(1, 0).setDepth(950),
      luck: this.add.text(PLAY.x + 4, PLAY.y + 12, '', { ...FONT, color: '#ffcc44' }).setDepth(950),
    };

    const seen = Math.min(save.villageSeen, villageLevel(save.spent));
    this.applyLevel(seen, false);
    this.updateLevelHud();
    if (villageLevel(loadSave().spent) > seen) {
      if (data.bouncedBack) this.afterBounce.push(() => this.time.delayedCall(300, () => this.grow()));
      else this.time.delayedCall(900, () => this.grow());
    }

    drawFrame(this);
    playMusic(this, 'village');
    this.tutorial = null;
    const train = !!data.tutorial || (!!data.fromIntro && !loadSave().tutorialDone);
    if (data.bouncedBack) {
      this.bounceIn(data.kept ?? 0);
    } else {
      this.cameras.main.fadeIn(data.fromIntro ? 900 : 500);
      if (!train) banner(this, 'RINGFALL VILLAGE', specialArrived ? 'The special merchant is here: five cards today!'
        : data.fromRun ? this.whoCame() : 'Merchant, tavern, well. The catapult is east.');
    }
    if (specialArrived && data.bouncedBack) {
      this.afterBounce.push(() => this.time.delayedCall(700, () => banner(this, 'SPECIAL MERCHANT', 'Five cards today, one of them a best deal.')));
    }
    if (this.revealHand && !data.openShop) {
      if (data.bouncedBack) this.afterBounce.push(() => this.time.delayedCall(300, () => this.doRevealHand()));
      else this.time.delayedCall(900, () => this.doRevealHand());
    }
    if (train) this.time.delayedCall(data.fromIntro ? 1000 : 300, () => this.startTutorial());
    if (data.openShop) this.openPanel('cards');
    if (data.openBar) this.openPanel('bar');
  }

  update(_t: number, delta: number) {
    this.updateCarts(delta);
    this.updateMarks();
    this.tutorial?.update();
    if (this.tutorial?.blocking()) {
      const JD = Phaser.Input.Keyboard.JustDown;
      JD(this.keys.ENTER); JD(this.keys.E); JD(this.keys.ESC); JD(this.keys.SPACE);
      return;
    }
    if (this.dialog) { this.dialogKeys(); return; }
    if (this.locked) return;
    if (this.panel) { this.panelKeys(); return; }
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    if (this.updateYard()) return;
    steer(this.player, k, 1);
    if (near(this.player, WELL.x, WELL.y, 5)) { this.fallInWell(); return; }
    const atShop = near(this.player, STALL.x, STALL.y + 16, 22);
    const atBar = near(this.player, BAR_DOOR.x, BAR_DOOR.y, 16);
    const atCatapult = near(this.player, CATAPULT.x - 60, CATAPULT.y + 30, 18);
    const person = this.npcs.find((n) => near(this.player, n.sprite.x, n.sprite.y, 14));
    if (person) this.prompt.setText(`E: talk to ${NPCS[person.id].name}`).setPosition(person.sprite.x, person.sprite.y - 16).setVisible(true);
    else if (atShop) this.prompt.setText('E: merchant').setPosition(STALL.x, STALL.y + 26).setVisible(true);
    else if (atBar) this.prompt.setText('E: tavern').setPosition(BAR_DOOR.x, BAR_DOOR.y + 10).setVisible(true);
    else if (atCatapult) this.prompt.setText('E: launch!').setPosition(CATAPULT.x - 50, CATAPULT.y + 44).setVisible(true);
    else this.prompt.setVisible(false);
    if (JD(k.E) || JD(k.ENTER)) {
      if (person) this.startTalk(person.id);
      else if (atShop) this.openPanel('cards');
      else if (atBar) this.openPanel('bar');
      else if (atCatapult) this.launch();
    }
  }

  private openPanel(mode: Panel) {
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.mode = mode;
    this.sel = 0;
    this.note = '';
    this.bookShown = -1;
    this.dealCards = mode === 'cards' && !new URLSearchParams(window.location.search).has('nodeal');
    this.render();
  }

  private closePanel() {
    this.panel?.destroy();
    this.panel = null;
    this.showLevelHud(true);
    this.input.setDefaultCursor('default');
    this.prompt.setVisible(false);
    if (this.revealHand) this.time.delayedCall(200, () => this.doRevealHand());
    if (this.pendingGrow) { this.pendingGrow = false; this.time.delayedCall(this.revealHand ? 1800 : 250, () => this.grow()); }
  }

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
    const count = this.mode === 'cards' ? this.offers().length : this.mode === 'gear' ? loadSave().inventory.owned.length : DRINK_ORDER.length;
    const prev = JD(k.A) || JD(k.LEFT) || JD(k.W) || JD(k.UP);
    const next = JD(k.D) || JD(k.RIGHT) || JD(k.S) || JD(k.DOWN);
    if (count > 0 && (prev || next)) { this.sel = (this.sel + (next ? 1 : count - 1)) % count; this.note = ''; this.render(); }
    if (JD(k.ENTER) || JD(k.SPACE)) this.choose();
    if (this.mode !== 'bar' && JD(k.Q)) this.toggleGear();
    if (JD(k.E) || JD(k.ESC)) this.closePanel();
  }

  private toggleGear() {
    this.mode = this.mode === 'cards' ? 'gear' : 'cards';
    this.sel = 0;
    this.note = '';
    this.render();
  }

  private clickable<T extends Phaser.GameObjects.GameObject>(obj: T, click: () => void, hover?: () => void): T {
    obj.setInteractive({ useHandCursor: true });
    obj.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.leftButtonDown()) this.time.delayedCall(0, () => { if (this.panel) click(); }); });
    if (hover) obj.on('pointerover', () => this.time.delayedCall(0, () => { if (this.panel) hover(); }));
    return obj;
  }

  private hoverPick(i: number) {
    if (this.sel === i) return;
    this.sel = i;
    this.note = '';
    this.render();
  }

  private keysLine(c: Phaser.GameObjects.Container, x: number, y: number, parts: [string, (() => void)?][]) {
    let px = x;
    for (const [label, act] of parts) {
      const t = this.add.text(px, y, label, { ...FONT, color: act ? '#c8b8e8' : '#888888' });
      if (act) {
        this.clickable(t, act);
        t.on('pointerover', () => t.setColor('#ffcc44')).on('pointerout', () => t.setColor('#c8b8e8'));
      }
      c.add(t);
      px += t.width + 8;
    }
  }

  private choose() {
    const s = loadSave();
    if (this.mode === 'cards') {
      const offer = this.offers()[this.sel];
      if (!offer) return;
      const { id, price } = offer;
      const it = item(id);
      if (s.inventory.owned.includes(id)) { this.note = `${it.name} is already yours.`; this.render(); return; }
      const r = buyItem(s.wallet, s.inventory, id, price);
      if (!r.ok) this.note = `${it.name} costs ${price} rings. You have ${walletValue(s.wallet)}.`;
      else {
        sfx(this, 'buy');
        const after = updateSave((x) => ({ ...x, wallet: r.wallet, inventory: r.inventory, spent: x.spent + price }));
        this.wallet.update(r.wallet);
        this.spentChanged(after.spent, after.villageSeen);
        this.note = it.kind === 'special' ? `Bought ${it.name}: a number key in the fight.` : `Bought and equipped: ${it.name}.`;
        this.popCard = this.sel;
        this.refreshHand();
        this.dressHero();
        if ((it.kind === 'melee' || it.kind === 'range') && !after.handRevealed) {
          this.revealHand = true;
          this.note = `${it.name} bought! Look at your hand.`;
        }
      }
    } else if (this.mode === 'gear') {
      const id = s.inventory.owned[this.sel];
      if (!id) return;
      const it = item(id);
      if (it.kind === 'special') this.note = `${it.name} is always ready: a number key in the fight.`;
      else { updateSave((x) => ({ ...x, inventory: equip(x.inventory, id) })); this.note = `Equipped: ${it.name}.`; this.refreshHand(); this.dressHero(); }
    } else {
      const id = DRINK_ORDER[this.sel];
      const d = DRINKS[id];
      const paid = s.drink === id ? null : pay(s.wallet, d.price);
      if (s.drink === id) this.note = `You already have the ${d.name}. Drunk at the next fight.`;
      else if (!paid) this.note = `${d.name} is ${d.price} rings.`;
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

  private showLevelHud(on: boolean) {
    const h = this.levelHud;
    for (const o of [h.g, h.name, h.next, h.luck]) o.setVisible(on);
  }

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
    const who = npc === 'merchant' ? this.robed({ key: 'merchant_0', anim: 'merchant' }).anim ?? npc : npc;
    const face = this.anims.exists(who) ? this.add.sprite(x + 11, y + 11, `${who}_0`).play(who) : this.add.image(x + 11, y + 11, who);
    if (face.height > 20) face.setOrigin(0.5, 0).setY(y + 1).setCrop(0, 0, face.width, 20);
    c.add(face);
    c.add(this.add.text(x + 22, y + 4, title, { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 22, y + 13, sub, { ...FONT, color: '#a898c8' }));
    c.add(this.add.text(x + w - 6, y + 4, `${walletValue(loadSave().wallet)} rings`, { ...FONT, color: '#ffcc44' }).setOrigin(1, 0));
    this.panel = c;
    return { c, bg, x, y, w, h };
  }

  private render() {
    this.showLevelHud(false);
    if (this.mode === 'cards') this.renderCards();
    else if (this.mode === 'gear') this.renderGear();
    else this.renderBar();
  }

  private whoCame() {
    const kind = loadSave().merchantKind;
    const sells = MERCHANT_SELLS[kind];
    return `The ${MERCHANT_NAMES[kind]} is here: ${sells ? `mostly ${KIND_NAMES[sells].toLowerCase()}` : 'a bit of everything'}.`;
  }

  private offers(): { id: CatalogId; price: number; full: number; discount: number; special: boolean }[] {
    const s = loadSave();
    const list = s.merchantCards.map((id) => ({ id, price: item(id).price, full: item(id).price, discount: 0, special: false }));
    const sp = s.merchantSpecial;
    if (sp) list.push({ id: sp.id, price: sp.price, full: item(sp.id).price, discount: sp.discount, special: true });
    return list;
  }

  private renderCards() {
    const s = loadSave();
    const offers = this.offers();
    const who = MERCHANT_LOOK[s.merchantKind];
    const { c, x, y, w, h } = this.frame(who.title, who.line, 'merchant', who.color, 308, 170);
    const floor = shopFloor(villageLevel(s.spent));
    const robe = MERCHANT_ROBES[s.merchantKind];
    const rug = this.textures.exists(`rug_${robe}`) ? `rug_${robe}` : this.textures.exists('rug') ? 'rug' : null;
    if (floor !== 'rug') c.addAt(shopFloorArt(this, 'booth', x, y, w, h), rug ? 3 : 1);
    if (rug) {
      c.addAt(this.add.image(x + w / 2, y + h / 2, rug), 1);
      c.addAt(this.add.graphics().fillStyle(0x000000, VEIL).fillRect(x + 1, y + 22, w - 2, h - 36)
        .fillStyle(0x000000, 0.6).fillRect(x + 1, y + 1, w - 2, 21).fillRect(x + 1, y + h - 14, w - 2, 13), 2);
    }
    const money = walletValue(s.wallet);
    if (!offers.length) c.add(this.add.text(x + w / 2, y + h / 2, 'You own everything!', { ...FONT, color: '#ffffff' }).setOrigin(0.5));
    const slot = Math.min(60, (w - 20) / Math.max(1, offers.length));
    const x0 = x + w / 2 - (slot * (offers.length - 1)) / 2;
    const spots = offers.map((_, i) => {
      const want = { x: Math.round(x0 + i * slot), y: y + 110 + (i % 2 ? 3 : -3) };
      if (!rug) return want;
      const at = clearSpot(this, rug, x + w / 2, y + h / 2, want, 22, { x: Math.min(14, Math.floor((slot - 26) / 2)), y: 8 });
      return { x: at.x, y: Math.max(at.y, y + 24 + BOOK_H + 22) };
    });
    offers.forEach((o, i) => {
      const sold = s.inventory.owned.includes(o.id);
      const picked = i === this.sel;
      const { x: ix, y: iy } = spots[i];
      const ware = this.add.container(ix, iy);
      const key = this.wareKey(o.id);
      const probe = crisp(this.add.image(0, 0, key), 40);
      const zoom = probe.scaleX;
      probe.destroy();
      const ic = this.add.image(0, 0, wareArt(this, key)).setScale(zoom);
      const patch = rug ? clothColor(this, rug) : floor === 'counter' || floor === 'velvet' ? FLOOR_PATCH[floor] : null;
      if (patch !== null) ware.add(clothPatch(this, patch, (ic.displayWidth >> 1) + 3, (ic.displayHeight >> 1) + 2, rug ? VEIL : 0));
      const under = this.add.graphics();
      if (o.special && !sold) {
        under.fillStyle(0xffcc44, 0.18).fillEllipse(0, 2, 44, 30).fillStyle(0xffe27a, 0.22).fillEllipse(0, 2, 30, 20);
        this.tweens.add({ targets: under, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
      } else under.fillStyle(0x000000, 0.35).fillEllipse(0, 12, 26, 7);
      ware.add(under);
      if (sold) ic.setAlpha(0.35);
      ware.add(ic);
      if (picked && !this.dealCards) {
        ic.y = -3;
        this.tweens.add({ targets: ic, y: -5, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.easeInOut' });
        ware.add(this.add.image(10, -12, 'sparkle'));
      }
      ware.add(priceTag(this, 23, { price: o.price, canPay: money >= o.price, sold, picked, tilt: i % 2 ? 0.06 : -0.06, deal: o.special ? { full: o.full, discount: o.discount } : undefined }));
      c.add(ware);
      c.add(this.clickable(this.add.zone(ix, iy + 8, Math.min(slot, 44), 52), () => { this.sel = i; this.choose(); }, () => this.hoverPick(i)));
      if (this.dealCards) {
        ware.setY(iy - 40).setAlpha(0);
        this.tweens.add({ targets: ware, y: iy, alpha: 1, duration: 420, delay: i * 110, ease: 'Bounce.easeOut' });
      }
      if (i === this.popCard) {
        this.tweens.add({ targets: ware, scale: 1.18, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
        for (let k = 0; k < 6; k++) {
          const sp = this.add.image(ix + Phaser.Math.Between(-16, 16), iy + Phaser.Math.Between(-16, 16), 'sparkle');
          c.add(sp);
          this.tweens.add({ targets: sp, y: sp.y - 10, alpha: 0, duration: 600, delay: k * 60 });
        }
      }
    });
    const o = offers[this.sel];
    if (o) {
      const spineX = Phaser.Math.Clamp(spots[this.sel].x, x + BOOK_PAGE + 8, x + w - BOOK_PAGE - 8);
      const fresh = this.bookShown !== this.sel || this.dealCards;
      c.add(this.book(spineX, y + 24 + BOOK_H / 2, o, fresh, this.dealCards ? offers.length * 110 + 300 : 0));
      this.bookShown = this.sel;
    }
    this.dealCards = false;
    this.popCard = -1;
    if (this.note) this.noteLine(c, x, y, w, h);
    this.keysLine(c, x + 8, y + h - 11, [['Click or A/D+Enter: buy'], ['Q your gear', () => this.toggleGear()], ['E leave', () => this.closePanel()]]);
  }

  private noteLine(c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number) {
    const t = this.add.text(x + 8, y + h - 13, this.note, { ...FONT, color: '#ffcc44', wordWrap: { width: w - 16 } }).setOrigin(0, 1);
    c.add(this.add.graphics().fillStyle(0x000000, 0.6).fillRect(x + 1, t.y - t.height - 2, w - 2, t.height + 2));
    c.add(t);
  }

  private book(sx: number, cy: number, o: ReturnType<VillageScene['offers']>[number], open: boolean, delay: number) {
    const it = item(o.id);
    return shopBook(this, sx, cy, {
      name: it.name,
      kind: o.special ? 'BEST DEAL' : KIND_NAMES[it.kind],
      kindColor: o.special ? '#a0700a' : hex(KIND_COLORS[it.kind]),
      pic: this.wareKey(o.id),
      stats: this.bookStats(it),
    }, open, delay);
  }

  private wareKey(id: CatalogId): string {
    const it = item(id);
    return it.kind === 'melee' || it.kind === 'range' ? `held_${id}` : this.textures.exists(`card_${id}`) ? `card_${id}` : `icon_${id}`;
  }

  private bookStats(it: CatalogItem): string {
    const out: string[] = [];
    if (it.damage) out.push(`${it.damage} damage`);
    if (it.cooldownMs) out.push(`every ${it.cooldownMs / 1000}s`);
    if (out.length) out.push('');
    out.push(it.desc);
    if (it.kind === 'special') out.push('key 1-8');
    else if (it.kind === 'armor') out.push('always worn');
    return out.join('\n');
  }

  private renderGear() {
    const s = loadSave();
    const inv = s.inventory;
    const { c, bg, x, y, w, h } = this.frame('YOUR GEAR', 'Enter on a weapon or armor to wear it.', heroLook(this, inv.armor).down, 0x6fd13a, 240, 150);
    if (!inv.owned.length) c.add(this.add.text(x + 10, y + 34, 'Nothing yet: buy a card first.', { ...FONT, color: '#ffffff' }));
    const visible = 9;
    if (this.sel < this.gearTop) this.gearTop = this.sel;
    if (this.sel >= this.gearTop + visible) this.gearTop = this.sel - visible + 1;
    this.gearTop = Phaser.Math.Clamp(this.gearTop, 0, Math.max(0, inv.owned.length - visible));
    const start = this.gearTop;
    inv.owned.slice(start, start + visible).forEach((id: CatalogId, n) => {
      const i = start + n;
      const it = item(id);
      const ry = y + 28 + n * 11;
      if (i === this.sel) bg.fillStyle(0x2a3a2a).fillRect(x + 3, ry - 2, 234, 11);
      const worn = inv.melee === id || inv.range === id || inv.armor === id;
      c.add(this.add.text(x + 8, ry, `${i === this.sel ? '>' : ' '}${it.name}`, FONT));
      c.add(this.add.text(x + 100, ry, KIND_NAMES[it.kind].toLowerCase(), { ...FONT, color: '#8a8a8a' }));
      c.add(this.add.text(x + 232, ry, worn ? 'EQUIPPED' : it.kind === 'special' ? 'key 1-8' : '', { ...FONT, color: worn ? '#6fd13a' : '#9fd3ff' }).setOrigin(1, 0));
      c.add(this.clickable(this.add.zone(x + 3, ry - 2, 234, 11).setOrigin(0), () => { this.sel = i; this.choose(); }, () => this.hoverPick(i)));
    });
    if (this.note) this.noteLine(c, x, y, w, h);
    this.keysLine(c, x + 8, y + h - 11, [['Click or W/S+Enter: wear'], ['Q cards', () => this.toggleGear()], ['E leave', () => this.closePanel()]]);
  }

  private renderBar() {
    const s = loadSave();
    this.panel?.destroy();
    const w = 256, h = 142;
    const x = Math.round((WIDTH - w) / 2), y = Math.round(PLAY.y + (PLAY.height - h) / 2);
    const c = this.add.container(0, 0).setDepth(960);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6).fillRect(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    c.add([bg, this.add.tileSprite(x, y, w, h, 'floor_wood').setOrigin(0), this.add.rectangle(x, y, w, h, 0x1a0e06, 0.45).setOrigin(0)]);
    const fr = this.add.graphics();
    fr.fillStyle(0x3a2214).fillRect(x, y, w, 3).fillRect(x, y + h - 3, w, 3).fillRect(x, y, 3, h).fillRect(x + w - 3, y, 3, h);
    fr.fillStyle(0x8a5a2a).fillRect(x + 3, y + 3, w - 6, 1).fillRect(x + 3, y + h - 4, w - 6, 1).fillRect(x + 3, y + 3, 1, h - 6).fillRect(x + w - 4, y + 3, 1, h - 6);
    for (const [rx, ry] of [[x + 1, y + 1], [x + w - 3, y + 1], [x + 1, y + h - 3], [x + w - 3, y + h - 3], [x + w / 2 - 1, y + 1], [x + w / 2 - 1, y + h - 3]]) {
      fr.fillStyle(0x9a9aa8).fillRect(rx, ry, 2, 2).fillStyle(0xd8d8e0).fillRect(rx, ry, 1, 1);
    }
    c.add(fr);
    c.add(this.add.sprite(x + 14, y + 14, 'barkeeper_0').play('barkeeper'));
    c.add(this.add.text(x + 26, y + 3, 'The Golden Tankard', { fontFamily: TITLE_FONT, fontSize: '16px', color: '#ffcc44' }));
    c.add(this.add.text(x + 26, y + 20, '"One cup each. It warms you for the fight."', { ...FONT, color: '#e8c890' }));
    c.add(this.add.text(x + w - 7, y + 6, `${walletValue(s.wallet)} rings`, { ...FONT, color: '#ffcc44' }).setOrigin(1, 0));

    const mx0 = x + 8, my0 = y + 32, mw = w - 16, mh = 52;
    const menu = this.add.graphics();
    menu.fillStyle(0xc8a870).fillRect(mx0 - 1, my0 - 1, mw + 2, mh + 2);
    menu.fillStyle(0xe9d9ae).fillRect(mx0, my0, mw, mh);
    menu.fillStyle(0xd8c490).fillRect(mx0, my0, mw, 2).fillRect(mx0, my0 + mh - 2, mw, 2);
    c.add(menu);
    DRINK_ORDER.forEach((id, i) => {
      const d = DRINKS[id];
      const ry = my0 + 6 + i * 15;
      if (i === this.sel) menu.fillStyle(0xd2b878).fillRect(mx0 + 2, ry - 3, mw - 4, 13);
      const inHand = s.drink === id;
      const ink = inHand ? '#2f6b1f' : walletValue(s.wallet) >= d.price ? '#3a2410' : '#a03020';
      c.add(this.add.image(mx0 + 9, ry + 3, 'mug'));
      c.add(this.add.text(mx0 + 18, ry, `${i === this.sel ? '>' : ' '}${d.name}`, { ...FONT, color: '#3a2410' }));
      c.add(this.add.text(mx0 + 70, ry, d.desc, { ...FONT, color: '#6b3a1a' }));
      c.add(this.add.text(mx0 + mw - 5, ry, inHand ? 'IN HAND' : `${d.price} rings`, { ...FONT, color: ink }).setOrigin(1, 0));
    });

    const top = y + h - 18;
    const counter = this.add.graphics();
    counter.fillStyle(0x6b4a2b).fillRect(x + 168, top, w - 172, 14).fillStyle(0x8a6040).fillRect(x + 168, top, w - 172, 2).fillStyle(0x4a2e1a).fillRect(x + 168, top + 13, w - 172, 1);
    c.add([this.add.image(x + 224, top, 'barrel').setOrigin(0.5, 1).setScale(1.6), this.add.image(x + 242, top, 'barrel').setOrigin(0.5, 1).setScale(1.6), counter]);
    const mx = x + 192;
    const my = top + 1;
    const mug = this.add.image(mx, my, s.drink ? 'beer_full' : 'beer_spilled').setOrigin(0.5, 1);
    const tap = this.add.graphics();
    c.add([tap, mug]);
    if (this.pour) {
      this.pour = false;
      const st = { f: 0 };
      const draw = () => {
        if (!mug.active) return;
        mug.setTexture(st.f < 0.55 ? 'beer_half' : 'beer_full');
        tap.clear().fillStyle(0x6b4a2b).fillRect(mx - 7, my - 32, 10, 3);
        if (st.f < 1) tap.fillStyle(0xd89a2a).fillRect(mx - 3, my - 29, 2, 29 - mug.height + 4);
      };
      const tw = this.tweens.add({ targets: st, f: 1, duration: 900, ease: 'Sine.easeOut', onUpdate: draw, onComplete: draw });
      c.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
    }
    if (this.note) c.add(this.add.text(x + 8, y + h - 14, this.note, { ...FONT, color: '#ffcc44', wordWrap: { width: 150 } }).setOrigin(0, 1));
    c.add(this.add.text(x + 8, y + h - 12, 'W/S choose  Enter buy  E leave', { ...FONT, color: '#c8a878' }));
    this.panel = c;
  }

  private dressHero() { dress(this.player, heroLook(this, loadSave().inventory.armor)); }

  private refreshHand() {
    const w = loadout(loadSave().inventory).weapons;
    if (!hasWeapon(w)) return;
    this.hand.update(w, 1);
    if (this.hand.visible) showHandArt(this, w[1]);
  }

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

  private applyLevel(level: number, animate: boolean) {
    this.pave(level);
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
      const wild = this.wild(p);
      const { key, anim } = wild ?? this.robed(p);
      const obj = anim ? this.add.sprite(x, y, key).play(anim) : this.add.image(x, y, key);
      obj.setDepth(p.depth ?? 5);
      if (wild) obj.setScale(wild.scale).setY(y + Math.round((1 - wild.scale) * obj.height / 2));
      if (p.swing) {
        obj.setOrigin(0.5, 0);
        this.tweens.add({ targets: obj, angle: { from: -9, to: 9 }, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
      }
      let zone: Phaser.GameObjects.Zone | undefined;
      if (p.solid) { zone = this.add.zone(x, y + p.solid[2], p.solid[0], p.solid[1]); this.solids.add(zone); }
      this.placed.set(p, { obj, zone });
      const chim = CHIMNEYS[p.key];
      if (chim && !wild) this.smoke(obj, x + chim.x, y + chim.y);
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
      this.tweens.add({ targets: n, y: n.y - 1, yoyo: true, repeat: -1, duration: 260 });
      this.nobles.push(n);
    }
  }

  private addCarts(count: number) {
    while (this.carts.length < count) {
      const i = this.carts.length;
      const dir: 1 | -1 = i === 0 ? 1 : -1;
      const sprite = this.add.sprite(PLAY.x + (dir > 0 ? 30 : 230), ROAD_Y + (dir > 0 ? 1 : -4), 'cart_0').play('cart').setDepth(9).setFlipX(dir < 0);
      this.carts.push({ sprite, dir, state: 'road', shop: null, until: 0 });
    }
  }

  private drawCobbles(g: Phaser.GameObjects.Graphics) {
    villageGround.cobbles(g, PLAY.x, PLAY.y + 106, PLAY.width - 48);
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
    villageGround.wall(g, PLAY.x + 20, PLAY.y + PLAY.height - 6, PLAY.width - 40);
    return g;
  }

  private smoke(house: Phaser.GameObjects.GameObject, x: number, y: number) {
    const ev = this.time.addEvent({
      delay: 700, loop: true, startAt: Phaser.Math.Between(0, 600), callback: () => {
        if (!house.active) { ev.remove(); return; }
        const puff = this.add.circle(x, y, 1.5, 0xe0dcd4, 0.75).setDepth(12);
        this.tweens.add({ targets: puff, x: x + Phaser.Math.Between(2, 6), y: y - 12, scale: 2.4, alpha: 0, duration: 1700, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
      },
    });
  }

  private addPeople() {
    const spot: Record<NpcId, { x: number; y: number }> = {
      elder: { x: PLAY.x + 48, y: PLAY.y + 128 },
      kid: { x: PLAY.x + 140, y: PLAY.y + 106 },
      sergeant: { x: YARD_GAP.x + YARD_GAP.width + 7, y: YARD.y - 6 },
    };
    const talked = loadSave().talkedTo;
    (Object.keys(spot) as NpcId[]).forEach((id) => {
      const sp = this.add.image(spot[id].x, spot[id].y, NPCS[id].sprite).setDepth(9);
      const mark = this.add.text(sp.x, sp.y - 14, '!', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(12);
      this.tweens.add({ targets: mark, y: mark.y - 2, yoyo: true, repeat: -1, duration: 350 });
      mark.setVisible(!talked.includes(id));
      let walk: Phaser.Tweens.Tween | undefined;
      if (id === 'kid') {
        walk = this.tweens.add({ targets: sp, x: PLAY.x + 205, duration: 4200, yoyo: true, repeat: -1, hold: 900, repeatDelay: 900, ease: 'Sine.easeInOut',
          onYoyo: () => sp.setFlipX(true), onRepeat: () => sp.setFlipX(false) });
        this.tweens.add({ targets: sp, y: sp.y - 2, yoyo: true, repeat: -1, duration: 160 });
      } else {
        this.tweens.add({ targets: sp, scaleY: 1.04, yoyo: true, repeat: -1, duration: 900 + (id === 'elder' ? 300 : 0) });
      }
      this.npcs.push({ id, sprite: sp, mark, walk });
    });
  }

  private updateMarks() {
    const s = loadSave();
    for (const n of this.npcs) {
      n.mark.setPosition(n.sprite.x, n.mark.y);
      n.mark.setVisible(n.id === 'kid' ? !s.kidGiftGiven || !s.talkedTo.includes('kid') : !s.talkedTo.includes(n.id));
    }
  }

  private startTalk(id: NpcId) {
    const s = loadSave();
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.prompt.setVisible(false);
    const p = villageProgress(s.spent);
    const kit = loadout(s.inventory);
    const t = talk(id, {
      wins: s.wins, villageLevel: p.level, villageName: p.name, hasWeapon: hasWeapon(kit.weapons),
      ownsArmor: s.inventory.armor !== null, kidGiftGiven: s.kidGiftGiven,
    }, Math.random);
    updateSave((x) => ({ ...x, talkedTo: x.talkedTo.includes(id) ? x.talkedTo : [...x.talkedTo, id] }));
    const npc = this.npcs.find((n) => n.id === id);
    npc?.walk?.pause();
    if (npc) npc.sprite.setFlipX(npc.sprite.x > this.player.x);
    if (t.giftRing) {
      const after = updateSave((x) => ({ ...x, kidGiftGiven: true, wallet: addRings(x.wallet, ['classic']), lifetimeRings: addRings(x.lifetimeRings, ['classic']) }));
      this.time.delayedCall(1200, () => { this.wallet.update(after.wallet); sfx(this, 'ring'); floatText(this, this.player.x, this.player.y - 12, '+1 classic ring', '#c8c8d0'); });
    }
    this.openDialog(NPCS[id].sprite, NPCS[id].name, t.lines);
  }

  private openDialog(sprite: string, name: string, lines: string[], onClose?: () => void) {
    const w = PLAY.width - 8;
    const h = 38;
    const x = PLAY.x + 4;
    const y = PLAY.y + PLAY.height - h - 4;
    const box = this.add.container(0, 0).setDepth(965);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.96).fillRect(x, y, w, h).fillStyle(0xffcc44).fillRect(x, y, w, 1);
    box.add(bg);
    box.add(this.add.image(x + 14, y + h / 2, sprite).setScale(2));
    box.add(this.add.text(x + 30, y + 4, name, { ...FONT, color: '#ffcc44' }));
    const text = this.add.text(x + 30, y + 14, '', { ...FONT, color: '#ffffff', wordWrap: { width: w - 40 } });
    box.add(text);
    box.add(this.add.text(x + w - 4, y + h - 10, 'Enter', { ...FONT, color: '#666666' }).setOrigin(1, 0));
    this.dialog = { box, lines, i: 0, typing: null, text, onClose };
    this.typeLine();
  }

  private typeLine() {
    const d = this.dialog;
    if (!d) return;
    const line = d.lines[d.i];
    let n = 0;
    d.text.setText('');
    d.typing?.remove();
    d.typing = this.time.addEvent({ delay: 22, repeat: line.length - 1, callback: () => { n++; d.text.setText(line.slice(0, n)); if (n >= line.length) d.typing = null; } });
  }

  private dialogKeys() {
    const d = this.dialog;
    if (!d) return;
    const JD = Phaser.Input.Keyboard.JustDown;
    const k = this.keys;
    if (!(JD(k.ENTER) || JD(k.SPACE) || JD(k.E) || JD(k.ESC))) return;
    if (d.typing) { d.typing.remove(); d.typing = null; d.text.setText(d.lines[d.i]); return; }
    d.i++;
    if (d.i < d.lines.length) { this.typeLine(); return; }
    d.box.destroy();
    this.dialog = null;
    this.npcs.forEach((n) => n.walk?.resume());
    d.onClose?.();
  }

  private startTutorial() {
    this.tutorial = new Tutorial(this, {
      player: this.player,
      dummy: DUMMY,
      gate: { x: YARD_GAP.x + YARD_GAP.width / 2, y: YARD.y },
      inYard: () => this.insideYard(),
      busy: () => !!this.panel || !!this.dialog,
      onEnd: () => { updateSave((s) => ({ ...s, tutorialDone: true })); this.tutorial = null; },
    });
  }

  private addYard() {
    const { x, y, width: w, height: h } = YARD;
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0xb8985a, 0.55).fillRect(x, y, w, h);
    const rail = (x0: number, y0: number, len: number, across: boolean) => villageGround.fence(g, x0, y0, len, across);
    rail(x, y, YARD_GAP.x - x, true);
    rail(YARD_GAP.x + YARD_GAP.width, y, x + w - YARD_GAP.x - YARD_GAP.width, true);
    rail(x, y + h, w, true);
    rail(x, y, h, false);
    rail(x + w, y, h, false);
    const block = (bx: number, by: number, bw: number, bh: number) => this.solids.add(this.add.zone(bx + bw / 2, by + bh / 2, bw, bh));
    block(x, y - 2, YARD_GAP.x - x, 3);
    block(YARD_GAP.x + YARD_GAP.width, y - 2, x + w - YARD_GAP.x - YARD_GAP.width, 3);
    block(x, y + h - 2, w, 3);
    block(x - 2, y, 3, h);
    block(x + w - 1, y, 3, h);
    this.solids.refresh();
    this.add.text(x + 3, y + h - 9, 'TRAINING', { ...FONT, color: '#ff9a6a' }).setDepth(4);

    this.dummy = this.physics.add.sprite(DUMMY.x, DUMMY.y, 'dummy').setDepth(9).setImmovable(true);
    (this.dummy.body as Body).setCircle(8, 0, 5);
    this.physics.add.collider(this.player, this.dummy);
    this.combat = new Combat(this, {
      player: this.player,
      kit: loadout(loadSave().inventory),
      now: () => this.time.now,
      area: YARD,
      target: {
        sprite: this.dummy,
        alive: () => true,
        hit: (dmg) => this.hitDummy(dmg),
        effect: (e) => {
          if (e === 'freeze') floatText(this, DUMMY.x, DUMMY.y - 22, 'SLOWED', '#9fe8ff');
          else this.dummyTicks(SPECIAL.poisonMs / 1000, 1000, SPECIAL.poisonTickDmg, '#6fd13a', 'POISONED');
        },
      },
    });
    this.trainText = this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + PLAY.height - 10, '', { ...FONT, color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 2, y: 0 } })
      .setOrigin(1, 0).setDepth(950).setVisible(false);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor('default'));
  }

  private insideYard() {
    const p = this.player;
    return p.x > YARD.x && p.x < YARD.x + YARD.width && p.y > YARD.y && p.y < YARD.y + YARD.height;
  }

  private updateYard(): boolean {
    const inside = this.insideYard();
    if (inside !== this.inYard) {
      this.inYard = inside;
      this.input.setDefaultCursor(inside ? 'none' : 'default');
      this.trainText.setVisible(inside);
      this.hint.setVisible(!inside);
      if (inside) {
        this.combat.setKit(loadout(loadSave().inventory));
        this.prompt.setVisible(false);
      } else {
        this.combat.drawAim(false);
        this.combat.clearShots();
        this.dressHero();
        this.refreshHand();
      }
    }
    if (!inside) return false;
    const k = this.keys;
    this.combat.face(steer(this.player, k, 1));
    this.combat.keys(k);
    this.combat.kit.specials.forEach((id, i) => { if (Phaser.Input.Keyboard.JustDown(k[SPECIAL_KEYS[i]])) this.castAtDummy(id); });
    this.combat.drawAim(true);
    this.combat.cleanup();
    if (this.hand.visible) {
      const frac = this.combat.readyFrac();
      this.hand.update(this.combat.kit.weapons, this.combat.wIndex, frac);
      showHandArt(this, this.combat.kit.weapons[this.combat.wIndex], frac);
    }
    const spanMs = 5000;
    const now = this.time.now;
    this.hits = this.hits.filter((h) => now - h.t <= spanMs);
    const dps = this.hits.reduce((sum, h) => sum + h.dmg, 0) / (spanMs / 1000);
    this.trainText.setText(`${dps.toFixed(1)} dmg/s  total ${this.totalDmg}  best ${this.bestHit}`);
    return true;
  }

  private hitDummy(dmg: number) {
    this.tutorial?.event('hitDummy');
    this.hits.push({ t: this.time.now, dmg });
    this.totalDmg += dmg;
    this.bestHit = Math.max(this.bestHit, dmg);
    floatText(this, this.dummy.x, this.dummy.y - 14, `-${dmg}`, '#ffffff');
    sfx(this, 'hit');
    this.dummy.setTexture('dummy_flash');
    this.time.delayedCall(60, () => { if (this.dummy.active) this.dummy.setTexture('dummy'); });
    this.tweens.killTweensOf(this.dummy);
    this.tweens.add({ targets: this.dummy, angle: { from: dmg >= 40 ? 18 : 9, to: 0 }, duration: 380, ease: 'Elastic.easeOut' });
  }

  private dummyTicks(count: number, everyMs: number, dmg: number, color: string, label: string) {
    floatText(this, DUMMY.x, DUMMY.y - 22, label, color);
    this.time.addEvent({ delay: everyMs, repeat: count - 1, callback: () => {
      this.hits.push({ t: this.time.now, dmg });
      this.totalDmg += dmg;
      floatText(this, this.dummy.x, this.dummy.y - 14, `-${dmg}`, color);
    } });
  }

  private castAtDummy(id: SpecialId) {
    const c = this.combat;
    const it = item(id);
    const p = this.player;
    if (c.specialLeft(id) > 0) { floatText(this, p.x, p.y - 12, `${it.name} not ready`, '#888888'); return; }
    const d = c.aimDir();
    const S = SPECIAL;
    sfx(this, 'spell', 0.5);
    switch (id) {
      case 'fireball': c.projectile('proj_fireball', d, SPELL_SPEED, c.hitDamage(it.damage ?? 0)); break;
      case 'freeze': c.projectile('proj_freeze', d, SPELL_SPEED, c.hitDamage(it.damage ?? 0), 'freeze'); break;
      case 'poison': c.projectile('proj_poison', d, SPELL_SPEED - 20, c.hitDamage(it.damage ?? 0), 'poison'); break;
      case 'bomb': c.throwBomb(d, it.damage ?? 0); break;
      case 'push':
        c.ring(p.x, p.y, S.pushRadius, 0xffffff);
        if (near(p, this.dummy.x, this.dummy.y, S.pushRadius)) this.hitDummy(c.hitDamage(it.damage ?? 0));
        else floatText(this, p.x, p.y - 12, 'too far', '#888888');
        break;
      case 'healthSuck': this.dummyTicks(Math.round((S.suckMs / 1000) * 2), 500, S.suckPerSec / 2, '#e03a4a', 'DRAINED'); break;
      case 'paralysis': floatText(this, DUMMY.x, DUMMY.y - 22, 'PARALYSED', '#ffee44'); break;
      case 'shield': c.ring(p.x, p.y, 10, 0x6aa8ff); floatText(this, p.x, p.y - 12, 'SHIELD', '#6aa8ff'); break;
    }
    c.usedSpecial(id);
  }

  private freeShops() {
    const level = villageLevel(loadSave().spent);
    const now = this.time.now;
    const taken = new Set(this.carts.map((c) => c.shop?.id).filter(Boolean));
    return SHOPS.filter((s) => s.minLvl <= level && !taken.has(s.id) && (this.shopBusyUntil.get(s.id) ?? 0) <= now
      && !near(this.player, s.x, s.stopY, 34));
  }

  private updateCarts(delta: number) {
    const dt = delta / 1000;
    const speed = 28;
    const left = PLAY.x + 14;
    const right = PLAY.x + 248;
    for (const c of this.carts) {
      const sp = c.sprite;
      if (c.state === 'road') {
        if (!c.shop) {
          const ahead = this.freeShops().filter((s) => (s.x - sp.x) * c.dir > 2).sort((a, b) => Math.abs(a.x - sp.x) - Math.abs(b.x - sp.x));
          c.shop = ahead[0] ?? null;
        }
        if (c.shop && near(this.player, c.shop.x, c.shop.stopY, 34)) c.shop = null;
        sp.x += c.dir * speed * dt;
        if (c.shop && Math.abs(sp.x - c.shop.x) < 1.5) {
          sp.x = c.shop.x;
          c.state = 'in';
          sp.setFlipX(false).play(c.shop.stopY < ROAD_Y ? 'cart_up' : 'cart_down', true);
        } else if (sp.x <= left || sp.x >= right) {
          c.dir = (sp.x <= left ? 1 : -1);
          sp.x = Phaser.Math.Clamp(sp.x, left, right);
          sp.setFlipX(c.dir < 0);
        }
      } else if (c.state === 'in' && c.shop) {
        const toward = Math.sign(c.shop.stopY - sp.y);
        sp.y += toward * speed * dt;
        if (Math.abs(sp.y - c.shop.stopY) < 1.5) {
          sp.y = c.shop.stopY;
          c.state = 'unload';
          c.until = this.time.now + 2600;
          sp.anims.pause();
          this.tweens.add({ targets: sp, scaleY: 0.92, yoyo: true, repeat: 3, duration: 160 });
          floatText(this, sp.x, sp.y - 12, 'delivery!', '#ffd27a');
        }
      } else if (c.state === 'unload' && c.shop) {
        if (this.time.now >= c.until || near(this.player, c.shop.x, c.shop.stopY, 30)) {
          this.shopBusyUntil.set(c.shop.id, this.time.now + 9000);
          c.state = 'out';
          sp.anims.resume();
          sp.play(c.shop.stopY < ROAD_Y ? 'cart_down' : 'cart_up', true);
        }
      } else if (c.state === 'out' && c.shop) {
        sp.y += Math.sign(ROAD_Y + (c.dir > 0 ? 1 : -4) - sp.y) * speed * dt;
        if (Math.abs(sp.y - (ROAD_Y + (c.dir > 0 ? 1 : -4))) < 1.5) {
          sp.y = ROAD_Y + (c.dir > 0 ? 1 : -4);
          sp.play('cart', true).setFlipX(c.dir < 0);
          c.state = 'road';
          c.shop = null;
        }
      }
    }
  }

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

  private bounceIn(kept: number) {
    this.locked = true;
    this.cameras.main.fadeIn(350, 255, 255, 255);
    const roadY = PLAY.y + 112;
    const p = this.player;
    p.setPosition(PLAY.x + PLAY.width + 16, roadY - 40).setRotation(0);
    const grandpa = !loadSave().grandpaMet;
    if (grandpa) this.time.delayedCall(1800, () => this.grandpaComes(PLAY.x + 140, roadY));
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
      this.tweens.add({ targets: p, x: p.x - 8, rotation: -Math.PI / 2, duration: 260, ease: 'Quad.easeOut', onComplete: () => this.dizzy(kept) });
    });
  }

  private grandpa: Phaser.GameObjects.Image | null = null;

  private grandpaComes(x: number, y: number) {
    const g = this.add.image(PLAY.x - 8, y, GRANDPA.sprite).setDepth(9).setAlpha(0);
    this.grandpa = g;
    this.tweens.add({ targets: g, alpha: 1, duration: 200 });
    this.tweens.add({ targets: g, x: x - 2, duration: 1500, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: g, y: y - 1, yoyo: true, repeat: 6, duration: 110 });
  }

  private backOnFeet(kept: number) {
    if (this.grandpa) { this.grandpaSpeaks(kept); return; }
    this.locked = false;
    banner(this, 'BOUNCED BACK HOME', `${kept ? `You kept ${kept} ring${kept === 1 ? '' : 's'}.` : 'No rings this time.'} The merchant has new cards.`);
    const after = this.afterBounce;
    this.afterBounce = [];
    after.forEach((f) => f());
  }

  private grandpaSpeaks(kept: number) {
    updateSave((s) => ({ ...s, grandpaMet: true }));
    const g = this.grandpa;
    if (g) { this.tweens.killTweensOf(g); g.setPosition(this.player.x - 14, this.player.y).setAlpha(1).setFlipX(false); }
    this.openDialog(GRANDPA.sprite, GRANDPA.name, bouncedBackLines(kept), () => {
      this.locked = false;
      if (g) {
        g.setFlipX(true);
        this.tweens.add({ targets: g, x: PLAY.x - 10, duration: 2400, ease: 'Sine.easeIn', onComplete: () => g.destroy() });
        this.tweens.add({ targets: g, y: g.y - 1, yoyo: true, repeat: 10, duration: 110 });
      }
      this.grandpa = null;
      const after = this.afterBounce;
      this.afterBounce = [];
      after.forEach((f) => f());
    });
  }

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
          onComplete: () => this.backOnFeet(kept),
        });
      },
    });
    this.wallet.update(loadSave().wallet);
  }

  private launch() {
    this.locked = true;
    this.prompt.setVisible(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0).enable = false;
    const { arm, winch } = this.cat;
    const state = { r: ARM_REST };
    let sag = 3;
    const follow = () => {
      arm.setRotation(state.r);
      const b = seat(this.cat, state.r);
      this.player.setPosition(b.x, b.y);
      if (sag >= 0) drawRope(this.cat, state.r, sag);
    };
    const from = { x: this.player.x, y: this.player.y };
    const to = seat(this.cat, ARM_REST);
    const hop = { t: 0 };
    this.player.setDepth(8);
    this.tweens.add({
      targets: hop, t: 1, duration: 380, ease: 'Sine.easeInOut',
      onUpdate: () => this.player.setPosition(from.x + (to.x - from.x) * hop.t, from.y + (to.y - from.y) * hop.t - Math.sin(hop.t * Math.PI) * 12),
      onComplete: () => {
        sfx(this, 'land', 0.4);
        this.tweens.add({ targets: state, r: ARM_REST + 0.05, duration: 90, yoyo: true, onUpdate: follow, onComplete: windUp });
      },
    });
    const windUp = () => {
      sag = 0;
      follow();
      const click = (n: number) => {
        if (n === 3) { this.time.delayedCall(220, release); return; }
        sfx(this, 'block', 0.25);
        this.cameras.main.shake(60, 0.002);
        this.tweens.add({ targets: winch, angle: winch.angle - 60, duration: 140, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.player, scaleY: 1 - 0.07 * (n + 1), duration: 140 });
        this.tweens.add({
          targets: state, r: ARM_REST + 0.07 * (n + 1), duration: 140, ease: 'Back.easeOut',
          onUpdate: follow,
          onComplete: () => this.time.delayedCall(140, () => click(n + 1)),
        });
      };
      click(0);
    };
    const release = () => {
      sag = -1;
      this.cat.rope.clear();
      this.snapRope(winch.x, winch.y);
      this.player.setScale(1, 1.15);
      this.tweens.add({
        targets: state, r: ARM_FIRE, duration: 170, ease: 'Cubic.easeIn', onUpdate: follow,
        onComplete: () => {
          this.fly();
          this.slam();
          this.tweens.add({ targets: state, r: ARM_FIRE - 0.35, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeOut', onUpdate: () => arm.setRotation(state.r) });
        },
      });
    };
  }

  private snapRope(x: number, y: number) {
    for (const dir of [-1, 1]) {
      const bit = this.add.rectangle(x + dir * 3, y - 2, 5, 1, 0xd8c8a0).setDepth(9);
      this.tweens.add({ targets: bit, x: bit.x + dir * 14, y: bit.y - 10, angle: dir * 200, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => bit.destroy() });
    }
  }

  private slam() {
    sfx(this, 'launch');
    this.cameras.main.shake(180, 0.012);
    const { base, winch, arm, pin } = this.cat;
    for (const part of [base, winch, arm, pin]) this.tweens.add({ targets: part, y: part.y - 3, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    dustPuff(this, CATAPULT.x - 40, CATAPULT.y + 34, 5, 8);
    dustPuff(this, CATAPULT.x + 6, CATAPULT.y + 34, 5, 8);
  }

  private fly() {
    const start = { x: this.player.x, y: this.player.y };
    const end = { x: PLAY.x + PLAY.width - 18, y: PLAY.y + 14 };
    const t = { p: 0 };
    this.player.setScale(1.25);
    let lastGhost = 0;
    this.tweens.add({
      targets: t, p: 1, duration: 950, ease: 'Sine.easeOut',
      onUpdate: () => {
        const x = start.x + (end.x - start.x) * t.p;
        const y = start.y + (end.y - start.y) * t.p - Math.sin(t.p * Math.PI) * 46;
        this.player.setPosition(x, y).setScale(1.25 * (1 - 0.85 * t.p)).setRotation(t.p * Math.PI * 5);
        if (this.time.now - lastGhost > 45 && t.p < 0.9) {
          lastGhost = this.time.now;
          const ghost = this.add.image(x, y, this.player.texture.key).setScale(this.player.scaleX).setRotation(this.player.rotation).setAlpha(0.45).setDepth(8);
          this.tweens.add({ targets: ghost, alpha: 0, scale: ghost.scale * 0.6, duration: 260, onComplete: () => ghost.destroy() });
        }
      },
      onComplete: () => {
        this.player.setVisible(false);
        const star = this.add.image(end.x, end.y, 'sparkle').setDepth(20).setScale(0.5);
        sfx(this, 'ring', 0.5);
        this.tweens.add({ targets: star, scale: 3, angle: 90, duration: 220, yoyo: true, ease: 'Quad.easeOut' });
        this.time.delayedCall(380, () => {
          this.cameras.main.fadeOut(400, 255, 255, 255);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('play', { landing: true }));
        });
      },
    });
  }

  private wild(p: Part): { key: string; anim?: undefined; scale: number } | null {
    const tree = p.key === 'tree' || p.key === 'tree_apple';
    if (!tree && !p.key.startsWith('bush_')) return null;
    const rnd = new Phaser.Math.RandomDataGenerator([`${this.natureSeed}:${PARTS.indexOf(p)}`]);
    const fruit = rnd.frac() < (tree ? 0.35 : 0.5);
    const plain = tree ? 'tree' : p.key.replace('_berry', '');
    const key = !fruit ? plain : tree ? 'tree_apple' : `${plain}_berry`;
    return { key, scale: [0.8, 0.9, 1, 1, 1.1, 1.2][rnd.between(0, 5)] };
  }

  private robed(p: { key: string; anim?: string }): { key: string; anim?: string } {
    const robe = MERCHANT_ROBES[loadSave().merchantKind];
    if (p.anim === 'merchant' && this.anims.exists(`merchant_${robe}`)) return { key: `merchant_${robe}_0`, anim: `merchant_${robe}` };
    if (p.key === 'blanket' && this.textures.exists(`blanket_${robe}`)) return { key: `blanket_${robe}` };
    return p;
  }

  private pave(level: number) {
    const key = level >= 5 ? 'path_brick' : level >= 3 ? 'path_cobble' : 'path_dirt';
    for (const p of this.paths) if (p.texture.key !== key) p.setTexture(key);
  }

  private drawVillage(): Phaser.Physics.Arcade.StaticGroup {
    this.add.tileSprite(PLAY.x, PLAY.y, PLAY.width, PLAY.height, 'grass').setOrigin(0).setDepth(0);
    const path = (x: number, y: number, w: number, h: number) =>
      this.paths.push(this.add.tileSprite(x, y, w, h, 'path_dirt').setOrigin(0).setDepth(0).setTilePosition(x, y));
    path(PLAY.x, PLAY.y + 104, PLAY.width - 48, 16);
    path(STALL.x - 6, STALL.y + 14, 12, 90);
    path(BAR_DOOR.x - 6, BAR_DOOR.y - 2, 12, 104 - (BAR_DOOR.y - PLAY.y) + 2);
    this.add.image(WELL.x, WELL.y, 'well').setOrigin(0.5, 16 / 22).setDepth(2);
    const solids = this.physics.add.staticGroup();
    const block = (x: number, y: number, w: number, h: number) => solids.add(this.add.zone(x, y, w, h));
    block(WELL.x - 9, WELL.y - 6, 2, 10);
    block(WELL.x + 9, WELL.y - 6, 2, 10);
    block(CATAPULT.x - 17, CATAPULT.y + 26, 72, 8);
    solids.refresh();
    return solids;
  }
}
