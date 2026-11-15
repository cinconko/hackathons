# Clustering Busters: plan

**Ringfall**, a pixel boss-fight game, playable in the browser at **https://ringfall-gold.vercel.app** (public, free). Code: [`pixel-game/`](pixel-game). Repo: `cinconko/hackathons`, merged into `main` (PR #1); day-to-day work happens on `feat/art-training-yard`.

## The idea: bounce back

Mossback stole the village treasury and locked it in a room in his lair. The only key hangs around his neck. You, a small farmer, fly into the lair by catapult, beat him in three stages, take the key and carry the rings home.

There is no game over. Losing bounces you home along the road ("BOUNCED BACK HOME"), and you keep every ring you picked up. Spending rings rebuilds the robbed village in six stages, and each stage makes Mossback drop more rings. The village bounces back from the robbery, and so do you.

## The flow

```
Web page: your name on the leaderboard -> PLAY (the game sits in the page)
Menu -> opening cutscene (6 shots, dialogue; first start only, skippable)
     -> Sergeant Brann's training (walk in, hit the dummy, dodge; skippable, once)
Village: merchant, bar, well, training yard, catapult
Catapult -> fly -> Mossback's lair: 3 stages, the fisherman every 30 s
Key drops -> hidden door -> treasury (3 chests) -> results
     -> first win: the ending cutscene ("THE END")
     -> leaderboard (your place) -> village
Lose -> bounced home (Grandpa greets you the first time)
```

## What is in the game

| Part | How it works |
|---|---|
| Opening cutscene | "The night the hill shook": 6 shots in letterbox bars with typed lines and speaker name tags (Mira, Grandpa, Tobi, Brann). Ends at the catapult, where Brann sends you to train. Words in `src/game/introScript.ts` |
| Training | Sergeant Brann in the yard: walk in, hit the dummy 3 times, dodge 3 practice balls (a red line shows where), then the merchant and the catapult explained. Esc skips; shown once |
| Village | Grows in 6 levels as you spend rings: **Camp** (0), **Tent camp** (150), **Village** (400), **Fountain square** (800), **Rich town** (1400), **Ringfall City** (2200). Each level: +15 % boss rings (up to +75 %). Buildings drawn in the catapult's style (outlined, lit from the upper left); fountains, waving flags, flickering lanterns, chimney smoke, a flickering campfire |
| Merchant | A new one after every run; his robe tells you what he sells. Ranger, Smith, Armorer, Alchemist, Peddler (18 % each, 3 wares) or the Special merchant (10 %, 5 wares + a BEST DEAL 25-40 % off). His shop grows with the village: blanket, stall, booth (4), ring shop (5), emporium (6). The window: his painted rug, wares laid on it with price tags; hover opens a book with the stats. Q: your gear |
| Bar | One drink for the next fight: Ale (+20 max hp, 25), Mead (+15 % damage, 40), Cider (+10 % speed, 30) |
| Well, Tobi | Fall in the well: 35 % chance of a ring (once per visit). Tobi gives you a ring once |
| Rings = the only money | Classic 5, rare 25, super rare 100 (70 / 25 / 5 % of drops). A new game starts with 100 |
| Weapons chart | 5 ranged (sling to hand cannon), 6 melee (dagger to spear), 8 specials (keys 1-8), 7 armors (-5 % to -75 % damage). Buy once, equip in the gear window |
| Fight | Mouse aims; click/Space attacks; Q switches fists / melee / ranged; 1-8 specials. Crosshair red = would hit; the weapon sits in the hero's hand and sweeps / jabs / recoils |
| Mossback | 600 HP, 3 stages: a ring of balls (red circle warning), aimed throws (red lines), spirals, charges and a finale (giant ball, slam rain). Every attack is warned first |
| Fisherman | At the pond every 30 s for 10 s: 3 of 4 supplies (potion, big potion, whetstone, boots) laid on a net, same tags and book as the merchant. The fight pauses while you shop |
| Treasury | A stone vault: the door bursts open, chests on a dais, rings arc out, a big tally |
| Hero | The team's farmer (9x16), knights for copper / bronze / iron / steel / magnetite (12x16); the walk lifts only the feet. Chainmail has no art yet |
| Leaderboard | Fastest treasury recovered, by nickname. Only real runs count (a signed run ticket per fight). Top 10 in the game, top 5 live on the page |
| Screen | 320x180 pixel grid in whole-number zoom, pixel frame; F or the button for fullscreen; M mutes |

All numbers (odds, prices, timings, damage) are in [`pixel-game/src/game/rules.ts`](pixel-game/src/game/rules.ts); the page's odds are computed from them (`src/game/odds.ts`).

## The website

One public scrolling page, all black: the RINGFALL wordmark made of rings (the farmer knocks them about), the name card, the game screen with your stats and the live top 5, the story, Mossback's stages, the six merchants with their odds, the village levels, the full leaderboard and "How lucky are you?" (every chance in the game, drawn with the game's sprites). Logo and sharing: favicon and app icons from the super rare ring, a 1200x630 preview card, Open Graph / Twitter tags, JSON-LD, `robots.txt`, `sitemap.xml`.

## How it is built

| Where | What |
|---|---|
| `src/scenes/` | Phaser scenes: preload, boot (textures), menu, nick, intro, cutscene base, outro, village, play (the fight), treasury, result, board, media checklist |
| `src/game/` | Pure rules, tested in Node: `rules.ts`, `odds.ts`, `leaderboard.ts`, `ticket.ts`, `introScript.ts`, `npcs.ts`, `tutorial.ts` |
| `src/*.ts` | Art and helpers: `villageArt.ts`, `merchantShops.ts`, `shopArt.ts`, `catapult.ts`, `ringArt.ts`, `heroFrames.ts`, `fireFrames.ts`, `combat.ts`, `player.ts`, `ui.ts`, `leaderboard.ts` (client) |
| `src/landing/` | The web page around the game |
| `api/scores.ts` | Vercel Function: run tickets, the top scores, saving a win |
| `db/scores.sql` | The Supabase table (`public.scores`) |
| `public/media/` | The team's art, fonts and sound (`npm run art` imports from `art/`) |
| `middleware.ts` | Redirects old `/play` links to the page |

Stack: Vite + TypeScript + Phaser 3 (arcade physics build), Vercel (static site, one function, middleware), Supabase Postgres via the Vercel Marketplace (store `ringfall-leaderboard`).

## Run it

```bash
cd pixel-game
npm ci
npm run dev        # open the URL it prints
npm test           # rule tests (node --test)
npm run build      # tests + type check + build
npm run itch       # zip for itch.io
```

Deploying and the team's working rules: see [`NOTES.md`](NOTES.md).

## Next

- [ ] A real score from a full live run (end-to-end check of the run ticket)
- [ ] Chainmail art for the hero
- [ ] Known small bugs: the crosshair draws over Brann's box; two pickups stack their floating texts
- [ ] Use the team's uploaded chiptune tracks (on `main` under `public/media/`, not wired yet)
- [ ] Play-test and balance (boss HP, ring drops, prices)
- [ ] Optional: Vercel project Root Directory = `clustering-busters/pixel-game`, so GitHub pushes build previews instead of failing
- [ ] Submit the sitemap in Google Search Console (needs site verification)

## Team

| Name | GitHub |
|---|---|
| Simon Kubec | @cinconko |
| | TheXik |
| | bukacdan |
