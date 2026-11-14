# Media

Art and sound for Ringfall. **Drop a file in the right folder with the right name and the game
uses it after a reload. No code change, no list to edit.**

```
public/media/
  sprites/<key>.png            replaces the placeholder sprite with the same key
  sheets/<key>@<w>x<h>.png     a sprite sheet: frames of w x h pixels (e.g. player@8x10.png)
  audio/music/<scene>.ogg      music for a scene (add a .mp3 with the same name for Safari)
  audio/sfx/<event>.ogg        a sound effect for a game event
```

## Drew it big? Put it in `art/` instead

Big pictures (hundreds of pixels, any name, PNG / JPG / AVIF) go in **`pixel-game/art/`**, not
here. Add one line for the file to `tools/import-art.sh` (source, sprite key, size in game
pixels, `cut` / `tile` / `cover`) and run **`npm run art`** (needs ImageMagick). It shrinks the
picture and writes `sprites/<key>.png` here. The originals stay out of the build.

Made this way so far: `tree`, `bush_big(_berry)`, `bush_mid(_berry)`, `cloud`, `grass` (village
ground), `water` (arena pond), `floor_wood` + `wall_wood` (treasury), `sky` (intro catapult shot),
and the merchant in six robe colours with a matching blanket (`merchant_<robe>_0/_1`,
`blanket_<robe>`; each deal picks a robe).

## What to draw: the checklist

Open the game with **`?scene=media`** (e.g. http://127.0.0.1:5173/?scene=media). It shows every
sprite the game uses, its size in pixels, and whether it is **ART** (your file) or still
**DRAWN** (the placeholder made in code). Hover a sprite for its exact file name. The last
page lists the music and sound effects. The browser console also prints a table of what is missing.

## Rules

- **Name = key.** `boss_1.png` replaces the sprite `boss_1`. Keys are letters, digits and `_`
  only, case matters (`held_warHammer`). Wrong names are ignored and reported in the dev
  server's terminal (`[media] ignored ...`).
- **Draw at the game's real size** (the checklist shows it). The game is a 320x180 grid and
  scales up by whole steps itself: do not pre-scale.
- **Weapons in hand point right**: the game rotates them toward the aim.
- **The boss is one picture**: `art/Boss.png` -> `npm run art` -> `sprites/boss_pose_<pose>.png`
  (40x38: idle, step_l, step_r, spread, aim). `tools/pose-boss.py` cuts his six arms and two legs out
  of the big drawing along hand-drawn outlines, turns them around the shoulders and hips, then
  shrinks each pose (needs Pillow). To fix an outline: `python3 tools/pose-boss.py --outlines out.png`.
  The game adds the rest: stage 2 orange and stage 3 red glow, the key on his chest, breathing,
  the right-facing aim, `boss_flash` (white, when hit) and `boss_nokey`. A file named like one of
  those keys (`boss_2_spread.png`) still wins over the made one.
- **Campfires**: `art/Campfire/Campfire_1.png` (wood, village level 1) and `Campfire_2.png` (stones,
  levels 2-3) -> `campfire_wood.png` / `campfire_stone.png`; the game adds the flicker frames.
- **Big source art goes in `art/`, not here**: everything in `public/` ships to players.
- PNG or WebP for images; OGG first for sound, with an MP3 copy if it must play in Safari.

## Weapons in hand

Name the file after the weapon: `dagger`, `sword`, `axe`, `mace`, `warhammer`, `spear`, `slingshot`,
`bow`, `crossbow`, `javelin`, `handcannon` (`.png`, in `sprites/`). Draw it upright or pointing right,
on any canvas: the game trims the empty border and turns it to point right in the hero's hand. It is
also the picture on the merchant's card and in the "in hand" slots.

## Weapon pictures (optional, big and detailed)

`sprites/art_<weapon>.png` (e.g. `art_sword.png`, `art_warHammer.png`, `art_handCannon.png`) is the
big picture of the weapon in hand, shown in the black space beside the game. Any size, drawn as
detailed as you like, transparent background, the weapon upright. Without it the game shows the
small sprite blown up.

## Fonts

`fonts/<name>.ttf` (or `.otf`, `.woff`, `.woff2`) is loaded before the first screen under the
family name `<name>`. Titles use `alagard` (Alagard by Hewett Tsoi, credit required, see
`CREDITS.md`). It is a pixel font drawn for 16 px: use it at 16 or 32 px only.

## Music (one per scene)

`menu`, `intro`, `village`, `arena`, `treasury`, `victory`: they loop and crossfade when the scene
changes. **M** mutes everything (remembered).

## Sound effects (one per event)

| Key | When |
|---|---|
| `swing` | a melee attack |
| `shoot` | a ranged attack |
| `hit` | you hit Mossback |
| `hurt` | he hits you |
| `block` | the shield stops a hit |
| `spell` | casting a special |
| `ring` | picking up a ring |
| `buy` | buying at the merchant, the bar or the fisherman |
| `stage` | Mossback enters a new stage |
| `victory` | Mossback falls |
| `door` | the hidden door opens, a chest opens |
| `land` | landing in the arena from the catapult |
| `launch` | the catapult throws you |
| `bounce` | bouncing back home after a defeat |
| `splash` | falling into the well |
| `levelup` | the village grows |

## How it works (for coders)

`vite.config.ts` scans this folder and serves `media/manifest.json` (fresh on every request in
dev, written into `dist/media/` by the build). The preload scene loads everything in it; the
boot scene draws a placeholder only for sprites that did not come from a file
(`src/media.ts`, `src/scenes/preload.ts`, `src/scenes/boot.ts`, rules in `tools/media-manifest.ts`).
