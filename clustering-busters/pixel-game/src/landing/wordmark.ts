// The hero's wordmark: RINGFALL built from square tiles (5x7 pixel letters), RING in gold, FALL in
// night. Our farmer follows the mouse (or finger) through the letters and knocks tiles out: they
// fly off, spin, fall, then slide back home. Every tile knocked counts in the "Rings knocked" tag.
// With nobody steering, he walks through the word on his own now and then.
// prefers-reduced-motion: the word is drawn once, nobody walks, nothing flies.

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
const COLS = WORD.length * 6;                            // 5 wide + a gap each, one more between RING and FALL, minus the last gap
const ROWS = 7;
const PAD = 0.6;                                         // cells of room around the word (shadows, the hero's head)

interface Tile {
  hx: number; hy: number;          // home, in cells
  x: number; y: number; r: number; // now, in cells / radians
  vx: number; vy: number; vr: number;
  gold: boolean;
  state: 'home' | 'fly' | 'back';
  t: number;                       // seconds in the current state
}

const C = { gold: '#ffcc44', goldDark: '#b8862a', ink: '#1a1424', night: '#1d1729', edge: '#3a2f52', hi: '#fff3c4' };

export function wordmark(canvas: HTMLCanvasElement, counter: HTMLElement | null, heroImg: HTMLImageElement | null, still: boolean) {
  const ctx = canvas.getContext('2d')!;
  // ---- the hero ----
  const hero = { x: -3, px: -3, y: 4, tx: -3, ty: 4, face: 1, on: false, step: 0 };
  // On wide screens one line, RING FALL; on phones two lines, RING over FALL, so the tiles stay big.
  const tiles: Tile[] = [];
  let W = 0, H = 0, stacked: boolean | null = null;
  function layout(two: boolean) {
    if (two === stacked) return;
    stacked = two;
    tiles.length = 0;
    let col = 0, top = 0;
    for (const [i, ch] of Array.from(WORD).entries()) {
      if (i === 4) { if (two) { col = 0; top = ROWS + 1; } else col += 1; }   // RING and FALL: a gap, or a new line
      GLYPHS[ch].forEach((row, y) => Array.from(row).forEach((c, x) => {
        if (c !== '1') return;
        const hx = col + x + PAD, hy = top + y + PAD;
        tiles.push({ hx, hy, x: hx, y: hy, r: 0, vx: 0, vy: 0, vr: 0, gold: i < 4, state: 'home', t: 0 });
      }));
      col += 6;
    }
    W = (two ? 4 * 6 - 1 : COLS) + PAD * 2;
    H = (two ? ROWS * 2 + 1 : ROWS) + PAD * 2 + 0.6;
    hero.y = hero.ty = H / 2;
  }
  let cell = 20;                                        // CSS pixels per cell, set by fit()
  let knocked = 0;

  function fit() {
    const cssW = canvas.clientWidth || canvas.parentElement!.clientWidth;
    layout(cssW < 640);
    cell = cssW / W;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(H * cell * dpr);
    canvas.style.height = `${H * cell}px`;
    ctx.setTransform(dpr * cell, 0, 0, dpr * cell, 0, 0); // draw in cells from here on
    ctx.imageSmoothingEnabled = false;
    draw();
  }

  let steered = 0;                                      // when a person last moved him (performance.now)
  let auto = -1;                                        // seconds into a walk-through, -1 = none
  const HERO_H = 3.4;                                   // cells tall

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
      const push = (hero.x - hero.px) * 6;                // faster swipes throw further
      t.state = 'fly'; t.t = 0;
      t.vx = Math.sign(dx || hero.face) * (3 + Math.random() * 5) + push;
      t.vy = -(8 + Math.random() * 7);
      t.vr = (Math.random() - 0.5) * 18;
      knocked++;
    }
    if (counter) counter.textContent = String(knocked);
  }

  // ---- drawing ----
  function tile(t: Tile) {
    ctx.save();
    ctx.translate(t.x + 0.5, t.y + 0.5);
    ctx.rotate(t.r);
    const s = 0.92, h = s / 2, sh = 0.16;
    ctx.fillStyle = t.gold ? C.ink : C.goldDark;          // the hard offset shadow
    ctx.fillRect(-h + sh, -h + sh, s, s);
    ctx.fillStyle = t.gold ? C.gold : C.night;
    ctx.fillRect(-h, -h, s, s);
    ctx.fillStyle = t.gold ? C.hi : C.edge;               // a lit top-left edge, like the game's tiles
    ctx.fillRect(-h, -h, s, 0.12);
    ctx.fillRect(-h, -h, 0.12, s);
    ctx.lineWidth = 0.07;
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(-h, -h, s, s);
    ctx.restore();
  }
  function drawHero() {
    if (!(hero.on || auto >= 0)) return;
    const img = heroImg && heroImg.complete && heroImg.naturalWidth ? heroImg : null;
    const h = HERO_H, w = img ? h * img.naturalWidth / img.naturalHeight : h * 0.55;
    const bob = Math.abs(Math.sin(hero.step)) * 0.25;
    ctx.save();
    ctx.translate(hero.x, hero.y - bob);
    ctx.fillStyle = 'rgba(26,20,36,0.25)';                // his shadow stays on the ground
    ctx.fillRect(-w * 0.45, h / 2 + bob - 0.12, w * 0.9, 0.22);
    ctx.scale(hero.face, 1);
    if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
    else { ctx.fillStyle = C.ink; ctx.fillRect(-w / 2, -h / 2, w, h); }
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const t of tiles) if (t.state === 'home') tile(t);
    drawHero();
    for (const t of tiles) if (t.state !== 'home') tile(t); // flying tiles go over him
  }

  // ---- the loop: runs only while something moves and the word is on screen ----
  let raf = 0, last = 0, visible = true;
  function wake() { if (!raf && visible && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // the walk-through when nobody steers: left to right along the word, a little wave in it
    if (!hero.on && auto < 0 && now - steered > 4000) { auto = 0; hero.x = -3; hero.y = H / 2; }
    if (auto >= 0) {
      auto += dt;
      hero.tx = -3 + auto * 9;
      hero.ty = H / 2 + Math.sin(auto * 2.2) * (H / 2 - 1.2);   // weaves through both lines on phones
      if (hero.tx > W + 3) { auto = -1; steered = now; }
    }
    hero.px = hero.x;
    const k = 1 - Math.pow(0.0005, dt);                   // eased follow, framerate-independent
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
        if (t.t > 1.3) { t.state = 'back'; t.t = 0; t.vx = t.x; t.vy = t.y; t.vr = t.r; } // remember where it started back from
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
    else setTimeout(wake, 4200);                           // idle: come back for the next walk-through
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(canvas);
  new ResizeObserver(() => fit()).observe(canvas.parentElement!);
  heroImg?.addEventListener('load', () => { draw(); wake(); });
  fit();
  steered = performance.now() - 3000;                       // the first walk-through comes a second after load
  wake();
}
