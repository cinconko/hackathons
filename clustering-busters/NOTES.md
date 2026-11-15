# Clustering Busters: running notes

What the game is: [`PLAN.md`](PLAN.md). This file: how we work on it, how it ships, and the things the code no longer explains (its comments were stripped in `d1a56af`; only 7 one-line bug warnings remain).

## Deploying (Vercel project `ringfall`)

Production: **https://ringfall-gold.vercel.app** (public; the old password gate is gone).

1. Commit only your own files, by path. Never `git add -A`: other people's unfinished work sits in the same folder.
2. Tell the other sessions **"deploying <sha>"**. Wait if someone else is deploying.
3. Check the commit sits on top of what is live (`git merge-base --is-ancestor <live> <sha>`), so nothing rolls back.
4. Deploy from a clean copy of the commit, never from the working folder (it holds `.env.local` with the Supabase secrets, and other people's half-done files):
   ```bash
   D=$(mktemp -d); git archive <sha> | tar -x -C "$D"; cp -R .vercel "$D/"
   (cd "$D" && npx vercel@latest deploy --prod --yes)
   ```
5. Check: `npx vercel inspect ringfall-gold.vercel.app` points at **your** deployment (the last deploy to finish wins; two at once once rolled production back), `/` and `/api/scores` answer 200.
6. Tell the others it is live.

API changes: try a preview first (`vercel deploy` without `--prod`, then `vercel curl <preview>/api/scores`).

The GitHub integration builds every push from the repo root and fails (the app lives in `clustering-busters/pixel-game`). Those "Error" / "Blocked" entries never touch production; the CLI deploys above are what ship.

## Working with several Claude sessions

- Claim files before editing ("I'm taking village.ts"), say when you are done. Ask before touching someone's claimed or uncommitted files.
- A session never commits or deploys without its own user's go.
- Check a peer's commit before deploying on top of it: right files, right base.

## Conventions (the code's comments are gone, so they live here)

- **Media**: `/media/sprites|sheets|fonts|audio` are cached immutable for a year. Reference media only through the manifest (URLs carry `?v=<content hash>`), never by a plain path. A file `public/media/sprites/<key>.png` replaces the code-drawn placeholder with that key.
- **`index.html`**: keep the opening tag exactly `<head>`; the Vite plugin injects the media manifest right after it and starts sprite downloads early.
- **Phaser** is aliased to `phaser/dist/phaser-arcade-physics.min.js` (no Matter.js). The preload loader uses `imageLoadType: 'HTMLImageElement'`. `tools/import-art.sh` writes losslessly compressed PNGs.
- **Pure modules** (`src/game/*`, `ringArt.ts`, `heroFrames.ts`, `fireFrames.ts`) have no Phaser and are tested with `node --test`. Imports between them keep the `.ts` extension (Node runs them directly; `tsconfig` allows it).
- **`api/`** imports shared code with a **`.js`** extension (`'../src/game/leaderboard.js'`). A `.ts` path builds but crashes on Vercel with `ERR_MODULE_NOT_FOUND`.
- **Art style**: 1x on the game grid, whole-number scaling only. Village buildings follow the catapult: 1 px dark outline (`0x3a2a1a`), light from the upper left, chunky members, iron at the joints (`src/villageArt.ts` kit). Keep footprints when restyling (collisions depend on them).
- **Hero**: farmer 9x16, knights 12x16, hitbox 8x10 at the feet, one front view flipped for left/right. The held weapon's grip sits at the hand on the aiming side (`handOf` in `combat.ts`).
- **Rings**: `src/ringArt.ts` is the one source (9x9); the game's `ring_*`, the HUD and the page logo and icons all come from it.
- **Shops**: price tags, books and outlined wares come from `src/shopArt.ts`; the merchant's rug is the window background at every village level.
- **Cutscenes**: `CutsceneScene` clears all tweens and timers between shots; anything a shot spawns later must go into the array its build returned.
- **The fight's shop** pauses the fight's tweens one by one (`tweens.pauseAll()` would freeze the shop's own animations too).
- **The page** sleeps the game while its screen is scrolled away; keyboard input is off while asleep or while typing in the page's name box (Phaser's key queue is cleared, or old presses replay).
- **Reset**: only the menu's R (press twice). No dev-only shortcut.

## Leaderboard (Supabase)

- Store `ringfall-leaderboard` (Vercel Marketplace), table `public.scores` (`db/scores.sql`): nick, time_ms, run_id (unique), created_at.
- Row level security on with **no** policies: the public key can do nothing; only `api/scores.ts` (service-role key, server side) reads and writes.
- Every fight gets a signed **run ticket** (HMAC; `SCORE_TICKET_SECRET`, falling back to the service-role key). A score needs a valid, unused ticket, and the time can't be shorter than the ticket's age. Names (2-14 letters, digits, space, `_ . -`) and times (20 s to 2 h) are checked on the server.
- Env vars live in Vercel only (`vercel env pull` writes `.env.local`, gitignored). Never put a key in the repo or the browser bundle.
- Schema changes: run them in Supabase's SQL editor yourself (sessions are blocked from using production credentials from `.env.local`), **before** deploying code that needs them.

## Dev hooks (URL parameters, local dev)

| Hook | What |
|---|---|
| `?scene=intro` / `outro` / `village` / `treasury` / `menu` / `media` | jump to a scene (`media` = the art and sound checklist) |
| `?play` | start the fight at once; `&t=30500` fight clock (fisherman there), `&stage=2`/`3`, `&shop` (open his shop), `&dead` (boss beaten), `&lose` (bounce home) |
| `?scene=village&merchant` | open the merchant's shop (`&nodeal`: no deal animation); `&bar`, `&yard`, `&tutorial` |
| `&wallet=10,2,1` | rings in the wallet (classic, rare, super rare). Writes the save |
| `&kit=all`, `&armor=<id>` | own everything / wear an armour. Writes the save |
| `&spent=800&seen=6` | village level by rings spent; `seen` = levels already watched. Writes the save |

## Log

### 15 Nov

- Story: 6-shot opening with dialogue, the ending after the first win, Brann's training. Leaderboard (Supabase, nicknames, only real runs). Public one-page site with logo, preview card and SEO tags. Village restyled to match the new catapult; merchant shops that grow with the village; fisherman's shop like the merchant's; farmer hero and knights; the campfire flickers instead of strobing; full playthrough bug hunt; comments stripped and a performance pass (game ready ~30 % sooner).
- Merged into `main` (PR #1, `f096a84`). `main` also has the team's chiptune tracks, not yet in the game.

### 14 Nov

- Ringfall built in `pixel-game/`: pixel frame, boss with 3 stages, ring drops in 3 rarities, fisherman shop every 30 s, first weapons.
- Removed: a scam-checker backend moved here by mistake. It belongs to the separate repo cinconko/clusterbusters.
