import Phaser from 'phaser';
import { PLAY, WIDTH } from '../config';
import { drawFrame } from '../frame';
import { bounce, dustPuff } from '../fx';
import {
  addRings, buyItem, DRINK_ORDER, DRINKS, equip, item, KIND_NAMES, pay, rollCards, walletValue, WELL_RING_CHANCE,
  type CatalogId, type CatalogItem, type ItemKind, type Rarity,
} from '../game/rules';
import { addKeys, near, steer, type Keys } from '../player';
import { loadSave, updateSave } from '../save';
import { banner, floatText, FONT, walletHud } from '../ui';

// The hub between fights:
//   ring merchant  three random cards from the weapons chart, dealt again after every run
//   bar            one drink at a time, drunk at the start of the next fight
//   well           step into it and you fall in (sometimes there is a ring at the bottom)
//   catapult       flies you into Mossback's arena

type Sprite = Phaser.Physics.Arcade.Sprite;
type Panel = 'cards' | 'gear' | 'bar';

const STALL = { x: PLAY.x + 120, y: PLAY.y + 46 };
const MERCHANT = { x: STALL.x, y: STALL.y - 6 };
const BAR = { x: PLAY.x + 222, y: PLAY.y + 38 };
const BAR_DOOR = { x: BAR.x, y: BAR.y + 20 };
const WELL = { x: PLAY.x + 70, y: PLAY.y + 142 };
const CATAPULT = { x: PLAY.x + PLAY.width - 40, y: PLAY.y + 104 };   // pivot of the arm
const ARM_REST = Math.PI * 0.92;     // arm lying back, bucket near the ground
const ARM_FIRE = -Math.PI * 0.35;    // arm after the throw
const ARM_LEN = 24;
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

  constructor() { super('village'); }

  create(data: VillageData = {}) {
    this.panel = null;
    this.locked = false;
    this.note = '';
    this.sel = 0;
    this.wellLooted = false;

    // the merchant deals new cards every time you come back from the arena (and on a first visit)
    const save = loadSave();
    if (data.bouncedBack || data.fromRun || save.merchantCards.length === 0) {
      const cards = rollCards(Math.random, save.inventory.owned);
      updateSave((s) => ({ ...s, merchantCards: cards }));
    }

    this.physics.world.setBounds(PLAY.x, PLAY.y, PLAY.width, PLAY.height);
    const solids = this.drawVillage();

    this.add.image(MERCHANT.x, MERCHANT.y, 'merchant').setDepth(6);
    this.add.image(STALL.x, STALL.y + 4, 'stall').setDepth(7);
    this.add.text(STALL.x, STALL.y - 22, 'RING MERCHANT', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(8);
    this.add.image(BAR.x, BAR.y, 'bar').setDepth(5);
    this.add.text(BAR.x, BAR.y - 24, 'BAR', { ...FONT, color: '#ffd27a' }).setOrigin(0.5).setDepth(8);
    this.add.image(BAR.x + 30, BAR.y - 4, 'mug').setDepth(8);                 // the hanging sign
    this.add.image(CATAPULT.x - 2, CATAPULT.y + 6, 'catapult_base').setDepth(6);
    this.arm = this.add.image(CATAPULT.x, CATAPULT.y, 'catapult_arm').setOrigin(0, 0.5).setRotation(ARM_REST).setDepth(7);
    this.add.text(PLAY.x + PLAY.width - 52, CATAPULT.y - 30, "TO MOSSBACK'S LAIR", { ...FONT, color: '#ff8888' }).setOrigin(0.5).setDepth(8);

    this.player = this.physics.add.sprite(PLAY.x + 30, PLAY.y + 112, 'player').setCollideWorldBounds(true).setDepth(10);
    this.physics.add.collider(this.player, solids);
    this.keys = addKeys(this);

    this.prompt = this.add.text(0, 0, '', { ...FONT, color: '#ffcc44' }).setOrigin(0.5).setDepth(950);
    this.wallet = walletHud(this, PLAY.x + 4, PLAY.y + 4);
    this.wallet.update(loadSave().wallet);
    this.add.text(PLAY.x + PLAY.width - 4, PLAY.y + 3, 'WASD move   E use', { ...FONT, color: '#556655' }).setOrigin(1, 0).setDepth(950);

    drawFrame(this);
    if (data.bouncedBack) {
      this.bounceIn(data.kept ?? 0);
    } else {
      this.cameras.main.fadeIn(data.fromIntro ? 900 : 500);
      banner(this, 'RINGFALL VILLAGE', data.fromRun ? 'The merchant has new cards.' : 'Merchant, bar, well. The catapult is east.');
    }
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
    this.render();
  }

  private closePanel() { this.panel?.destroy(); this.panel = null; this.prompt.setVisible(false); }

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
        updateSave((x) => ({ ...x, wallet: r.wallet, inventory: r.inventory }));
        this.wallet.update(r.wallet);
        this.note = it.kind === 'special' ? `Bought ${it.name}: a number key in the fight.` : `Bought and equipped: ${it.name}.`;
      }
    } else if (this.mode === 'gear') {
      const id = s.inventory.owned[this.sel];
      if (!id) return;
      const it = item(id);
      if (it.kind === 'special') this.note = `${it.name} is always ready: a number key in the fight.`;
      else { updateSave((x) => ({ ...x, inventory: equip(x.inventory, id) })); this.note = `Equipped: ${it.name}.`; }
    } else {
      const id = DRINK_ORDER[this.sel];
      const d = DRINKS[id];
      const paid = pay(s.wallet, d.price);
      if (!paid) this.note = `${d.name} is ${d.price} rings.`;
      else {
        updateSave((x) => ({ ...x, wallet: paid, drink: id }));
        this.wallet.update(paid);
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
    c.add(this.add.image(x + 11, y + 11, npc));
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

  /** Three cards on the merchant's table. */
  private renderCards() {
    const s = loadSave();
    const { c, bg, x, y, w, h } = this.frame('THE RING MERCHANT', '"Three today. New ones when you come back."', 'merchant', 0x8a5fc0, 272, 164);
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
      const px = cx0 + i * (cw + gap);
      const py = cy - (picked ? 4 : 0);                  // the picked card lifts up
      const col = KIND_COLORS[it.kind];
      bg.fillStyle(sold ? 0x1e1e24 : 0x2a2238).fillRect(px, py, cw, ch);
      bg.fillStyle(picked ? 0xffffff : col).fillRect(px, py, cw, 2).fillRect(px, py + ch - 2, cw, 2).fillRect(px, py, 2, ch).fillRect(px + cw - 2, py, 2, ch);
      bg.fillStyle(col, 0.85).fillRect(px + 2, py + 2, cw - 4, 10);
      c.add(this.add.text(px + cw / 2, py + 3, KIND_NAMES[it.kind], { ...FONT, color: '#ffffff' }).setOrigin(0.5, 0));
      const ic = this.add.image(px + cw / 2, py + 28, it.kind === 'melee' || it.kind === 'range' ? `held_${id}` : `icon_${id}`);
      ic.setScale(Math.min(2, 30 / Math.max(ic.width, ic.height)));
      if (sold) ic.setAlpha(0.35);
      c.add(ic);
      c.add(this.add.text(px + cw / 2, py + 44, it.name, { ...FONT, color: sold ? '#666666' : '#ffffff' }).setOrigin(0.5, 0));
      c.add(this.add.text(px + 5, py + 56, this.cardStats(it), { ...FONT, color: sold ? '#555555' : '#c8b8e8', wordWrap: { width: cw - 10 }, lineSpacing: 1 }));
      const price = sold ? 'SOLD' : `${it.price} rings`;
      c.add(this.add.text(px + cw / 2, py + ch - 12, price, { ...FONT, color: sold ? '#6fd13a' : money >= it.price ? '#ffcc44' : '#ff6a6a' }).setOrigin(0.5, 0));
    });
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

  /** The bar: one drink, drunk at the start of the next fight. */
  private renderBar() {
    const s = loadSave();
    const { c, bg, x, y, h } = this.frame('THE BAR', '"One drink each. It kicks in at the fight."', 'barkeeper', 0xc89a3a, 240, 108);
    DRINK_ORDER.forEach((id, i) => {
      const d = DRINKS[id];
      const ry = y + 30 + i * 13;
      if (i === this.sel) bg.fillStyle(0x3a2a18).fillRect(x + 3, ry - 2, 234, 12);
      c.add(this.add.image(x + 12, ry + 3, 'mug'));
      c.add(this.add.text(x + 22, ry, `${i === this.sel ? '>' : ' '}${d.name}`, FONT));
      c.add(this.add.text(x + 84, ry, d.desc, { ...FONT, color: '#e8c890' }));
      c.add(this.add.text(x + 232, ry, s.drink === id ? 'IN HAND' : `${d.price} rings`, { ...FONT, color: s.drink === id ? '#6fd13a' : walletValue(s.wallet) >= d.price ? '#ffcc44' : '#ff6a6a' }).setOrigin(1, 0));
    });
    if (this.note) c.add(this.add.text(x + 8, y + h - 21, this.note, { ...FONT, color: '#ffcc44' }));
    c.add(this.add.text(x + 8, y + h - 11, 'W/S choose  Enter buy  E leave', { ...FONT, color: '#888888' }));
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
    this.add.image(PLAY.x + 34, PLAY.y + 40, 'house').setDepth(5);
    block(PLAY.x + 34, PLAY.y + 45, 26, 14);
    for (const [x, y] of [[PLAY.x + 80, PLAY.y + 24], [PLAY.x + 160, PLAY.y + 150], [PLAY.x + 14, PLAY.y + 82], [PLAY.x + 280, PLAY.y + 150], [PLAY.x + 170, PLAY.y + 20]] as const) {
      this.add.image(x, y, 'tree').setDepth(5);
      block(x, y + 6, 6, 6);
    }
    block(STALL.x, STALL.y + 10, 40, 8);                    // the counter
    block(BAR.x, BAR.y + 4, 46, 16);                        // the bar (its door stays open below)
    block(WELL.x - 9, WELL.y - 6, 2, 10);                   // the well's posts; the hole itself is open: you can fall in
    block(WELL.x + 9, WELL.y - 6, 2, 10);
    block(CATAPULT.x - 2, CATAPULT.y + 10, 24, 6);         // the catapult frame
    solids.refresh();
    return solids;
  }
}
