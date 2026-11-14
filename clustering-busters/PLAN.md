# Clustering Busters: plan

**The project:** Ringfall, a pixel adventure game with one big boss fight. Code: [`pixel-game/`](pixel-game).

## Idea

Mossback stole the village treasury and hid it in a locked room in his lair. The only key hangs around his neck. You fly in by catapult, beat him in three stages, take the key, empty the treasury, and spend the rings back home.

## The flow

```
Menu -> cutscene (first start, skippable) == letterbox + title card + fade ==> Village
Village: ring merchant, catapult -> fly -> land in the arena
Arena: boss in 3 stages -> key drops from his neck -> hidden door opens -> Treasury (3 chests) -> results -> Village
```

## What is in the game

| Part | How it works |
|---|---|
| Cutscene | 4 shots with typed captions in letterbox bars; the bars slide away into a title card and a fade to the village |
| Village | Ring merchant: 3 random cards from the weapons chart (never something you own), dealt again every time you come back from the arena; Q shows your gear to equip. Bar: one drink for the next fight (Ale +20 max hp, Mead +15% damage, Cider +10% speed). Well: step in and you fall in, climb out soaked, sometimes with a ring (once per visit). Catapult: into the arena |
| Rings = the only money | Classic 5, rare 25, super rare 100 (every chart price is a multiple of 5, so change always works). One wallet for the village and the fight. A new game starts with 100 |
| Weapons chart | From the team's chart: 5 ranged (sling to hand cannon), 6 melee (dagger to spear), 8 specials, 7 armors (-5% to -75% damage). Buy once, equip; melee ~15 dmg/s and ranged ~10 dmg/s across the board |
| Fight controls | Mouse aims; click/Space attacks; Q switches fists / melee / ranged; 1-8 cast the specials you own (each with its own cooldown) |
| Boss | Mossback, 600 HP, 3 stages: green fires a bullet ring (red circle warning), orange fires aimed bursts (red line warning), red fires fast spirals and dashes (thick red line warning) |
| Key + treasury | The key hangs on his neck and drops when he dies. Taking it reveals a hidden door in the west wall; behind it, 3 chests worth 330 rings |
| Fisherman | Comes to the arena pond every 30 s for 10 s and sells 3 supplies for rings (potion, big potion, whetstone, boots); the fight pauses while you shop |
| Feel | Crosshair (red = would hit), held weapon points at it and sweeps / jabs / recoils, reach drawn on the ground, hit-stop on hits, hero faces up / down / sideways |
| Losing | No death screen: Mossback smashes you, you bounce back into the village and get up. You keep the rings you picked up |
| Screen | 320x180 pixel grid scaled in whole steps (exact 6x = full HD), pixel frame, F for fullscreen |

All numbers (odds, prices, timings, damage) are in [`pixel-game/src/game/rules.ts`](pixel-game/src/game/rules.ts).

## Next

- [ ] Real art and sound in [`pixel-game/public/media/`](pixel-game/public/media) (sprites, audio), replacing the placeholders drawn in code
- [ ] Play-test and balance (boss HP, coin drops, prices)
- [ ] Decide the final game and boss names (Ringfall and Mossback are placeholders)
- [ ] Build for itch.io: `npm run itch` in `pixel-game/`

## Run it

```bash
cd pixel-game
npm ci
npm run dev        # open the URL it prints
npm test           # game rule tests
```

## Team

| Name | GitHub |
|---|---|
| Simon Kubec | @cinconko |
| | TheXik |
| | bukacdan |
