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
- **The boss has one sprite per stage** (`boss_1` green, `boss_2` orange, `boss_3` red), plus
  `boss_flash` (all white, shown for a frame when hit) and `boss_nokey` (after the key fell).
- PNG or WebP for images; OGG first for sound, with an MP3 copy if it must play in Safari.

## Weapon pictures (optional, big and detailed)

`sprites/art_<weapon>.png` (e.g. `art_sword.png`, `art_warHammer.png`, `art_handCannon.png`) is the
big picture of the weapon in hand, shown in the black space beside the game. Any size, drawn as
detailed as you like, transparent background, the weapon upright. Without it the game shows the
small sprite blown up.

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
