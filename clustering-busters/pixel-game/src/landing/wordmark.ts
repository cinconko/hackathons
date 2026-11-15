import { paintRing, RING_LOOKS, RING_SIZE, type RingLook } from '../ringArt';

const GLYPHS: Record<string, string[]> = {
  R: ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
  I: ['11111', '..1..', '..1..', '..1..', '..1..', '..1..', '11111'],
  N: ['1...1', '11..1', '1.1.1', '1.1.1', '1..11', '1...1', '1...1'],
  G: ['.111.', '1...1', '1....', '1.111', '1...1', '1...1', '.1111'],
  F: ['11111', '1....', '1....', '1111.', '1....', '1....', '1....'],
  A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
  L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
};
const WORD = 'RINGFALL';
const COLS = WORD.length * 6;
const ROWS = 7;
const PAD = 0.6;

interface Tile {
  hx: number; hy: number;
  x: number; y: number; r: number;
  vx: number; vy: number; vr: number;
  kind: Kind;
  state: 'home' | 'fly' | 'back';
  t: number;
}

type Kind = 'gold' | 'dark' | 'rare' | 'super';
const LOOKS: Record<Kind, { look: RingLook; shadow: string }> = {
  gold: { look: { H: 0xfff3c4, B: 0xffcc44, D: 0xb8862a, w: 0xffffff, g: 0xf4f4f8, d: 0xc8c8d0 }, shadow: '#111111' },
  dark: { look: { H: 0xffffff, B: 0xc8c8d0, D: 0x8a8a96, w: 0xfff3c4, g: 0xffcc44, d: 0xb8862a }, shadow: '#000000' },
  rare: { look: RING_LOOKS.rare, shadow: '#111111' },
  super: { look: RING_LOOKS.superRare, shadow: '#111111' },
};
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
function ringSprite(k: Kind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = RING_SIZE + 1;
  const g = c.getContext('2d')!;
  g.fillStyle = LOOKS[k].shadow;
  paintRing(LOOKS[k].look, (_, x, y) => g.fillRect(x + 1, y + 1, 1, 1));
  paintRing(LOOKS[k].look, (color, x, y) => { g.fillStyle = hex(color); g.fillRect(x, y, 1, 1); });
  return c;
}
const luck = (n: number, word: number): Kind => (n === 17 || n === 71) ? 'super' : ((n * 37) % 19 === 4 ? 'rare' : (word === 0 ? 'gold' : 'dark'));

export function wordmark(canvas: HTMLCanvasElement, counter: HTMLElement | null, heroImg: HTMLImageElement | null, still: boolean) {
  const ctx = canvas.getContext('2d')!;
  const hero = { x: -3, px: -3, y: 4, tx: -3, ty: 4, face: 1, on: false, step: 0 };
  const tiles: Tile[] = [];
  let W = 0, H = 0, stacked: boolean | null = null;
  function layout(two: boolean) {
    if (two === stacked) return;
    stacked = two;
    tiles.length = 0;
    let col = 0, top = 0;
    for (const [i, ch] of Array.from(WORD).entries()) {
      if (i === 4) { if (two) { col = 0; top = ROWS + 1; } else col += 1; }
      GLYPHS[ch].forEach((row, y) => Array.from(row).forEach((c, x) => {
        if (c !== '1') return;
        const hx = col + x + PAD, hy = top + y + PAD;
        tiles.push({ hx, hy, x: hx, y: hy, r: 0, vx: 0, vy: 0, vr: 0, kind: luck(tiles.length, i < 4 ? 0 : 1), state: 'home', t: 0 });
      }));
      col += 6;
    }
    W = (two ? 4 * 6 - 1 : COLS) + PAD * 2;
    H = (two ? ROWS * 2 + 1 : ROWS) + PAD * 2 + 0.6;
    hero.y = hero.ty = H / 2;
  }
  let cell = 20;
  let knocked = 0;

  function fit() {
    const cssW = canvas.clientWidth || canvas.parentElement!.clientWidth;
    layout(cssW < 640);
    cell = cssW / W;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(H * cell * dpr);
    canvas.style.height = `${H * cell}px`;
    ctx.setTransform(dpr * cell, 0, 0, dpr * cell, 0, 0);
    ctx.imageSmoothingEnabled = false;
    draw();
  }

  let steered = 0;
  let auto = -1;
  const HERO_H = 3.4;

  function toCells(e: PointerEvent) {
    const b = canvas.getBoundingClientRect();
    return { x: (e.clientX - b.left) / cell, y: (e.clientY - b.top) / cell };
  }
  canvas.addEventListener('pointermove', (e) => {
    const p = toCells(e);
    hero.tx = p.x; hero.ty = p.y;
    if (!hero.on) { hero.x = p.x; hero.y = p.y; }
    hero.on = true; auto = -1; steered = performance.now();
    wake();
  });
  canvas.addEventListener('pointerdown', (e) => { canvas.dispatchEvent(new PointerEvent('pointermove', e)); });
  canvas.addEventListener('pointerleave', () => { hero.on = false; steered = performance.now(); });

  function knock() {
    const reach = 1.5;
    for (const t of tiles) {
      if (t.state !== 'home') continue;
      const dx = t.x + 0.5 - hero.x, dy = t.y + 0.5 - (hero.y);
      if (Math.abs(dx) > reach || Math.abs(dy) > HERO_H / 2 + 0.4) continue;
      const push = (hero.x - hero.px) * 6;
      t.state = 'fly'; t.t = 0;
      t.vx = Math.sign(dx || hero.face) * (3 + Math.random() * 5) + push;
      t.vy = -(8 + Math.random() * 7);
      t.vr = (Math.random() - 0.5) * 18;
      knocked++;
    }
    if (counter) counter.textContent = String(knocked);
  }

  const sprites = Object.fromEntries((Object.keys(LOOKS) as Kind[]).map((k) => [k, ringSprite(k)])) as Record<Kind, HTMLCanvasElement>;
  function tile(t: Tile) {
    ctx.save();
    ctx.translate(t.x + 0.5, t.y + 0.5);
    ctx.rotate(t.r);
    const s = 1.1, n = RING_SIZE + 1;
    ctx.drawImage(sprites[t.kind], -s / 2, -s / 2, s * n / RING_SIZE, s * n / RING_SIZE);
    ctx.restore();
  }
  function drawHero() {
    if (!(hero.on || auto >= 0)) return;
    const img = heroImg && heroImg.complete && heroImg.naturalWidth ? heroImg : null;
    const h = HERO_H, w = img ? h * img.naturalWidth / img.naturalHeight : h * 0.55;
    const bob = Math.abs(Math.sin(hero.step)) * 0.25;
    ctx.save();
    ctx.translate(hero.x, hero.y - bob);
    ctx.fillStyle = 'rgba(17,17,17,0.22)';
    ctx.fillRect(-w * 0.45, h / 2 + bob - 0.12, w * 0.9, 0.22);
    ctx.scale(hero.face, 1);
    if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
    else { ctx.fillStyle = '#111111'; ctx.fillRect(-w / 2, -h / 2, w, h); }
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const t of tiles) if (t.state === 'home') tile(t);
    drawHero();
    for (const t of tiles) if (t.state !== 'home') tile(t);
  }

  let raf = 0, last = 0, visible = true;
  function wake() { if (!raf && visible && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!hero.on && auto < 0 && now - steered > 4000) { auto = 0; hero.x = -3; hero.y = H / 2; }
    if (auto >= 0) {
      auto += dt;
      hero.tx = -3 + auto * 9;
      hero.ty = H / 2 + Math.sin(auto * 2.2) * (H / 2 - 1.2);
      if (hero.tx > W + 3) { auto = -1; steered = now; }
    }
    hero.px = hero.x;
    const k = 1 - Math.pow(0.0005, dt);
    hero.x += (hero.tx - hero.x) * k;
    hero.y += (hero.ty - hero.y) * k;
    const moved = hero.x - hero.px;
    if (Math.abs(moved) > 0.01) hero.face = moved > 0 ? 1 : -1;
    if (Math.hypot(moved, hero.ty - hero.y) > 0.02) hero.step += dt * 14;
    if (hero.on || auto >= 0) knock();

    let busy = hero.on || auto >= 0;
    for (const t of tiles) {
      if (t.state === 'home') continue;
      busy = true;
      t.t += dt;
      if (t.state === 'fly') {
        t.vy += 30 * dt;
        t.x += t.vx * dt; t.y += t.vy * dt; t.r += t.vr * dt;
        if (t.t > 1.3) { t.state = 'back'; t.t = 0; t.vx = t.x; t.vy = t.y; t.vr = t.r; }
      } else {
        const p = Math.min(1, t.t / 0.55), e = 1 - Math.pow(1 - p, 3);
        t.x = t.vx + (t.hx - t.vx) * e;
        t.y = t.vy + (t.hy - t.vy) * e;
        t.r = t.vr * (1 - e);
        if (p >= 1) { t.state = 'home'; t.x = t.hx; t.y = t.hy; t.r = 0; }
      }
    }
    draw();
    if (busy) raf = requestAnimationFrame(frame);
    else setTimeout(wake, 4200);
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(canvas);
  new ResizeObserver(() => fit()).observe(canvas.parentElement!);
  heroImg?.addEventListener('load', () => { draw(); wake(); });
  fit();
  steered = performance.now() - 3000;
  wake();
}
