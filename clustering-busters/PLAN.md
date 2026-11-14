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
| Village | Walk around; the ring merchant sells permanent upgrades; the catapult throws you into the arena |
| Rings = money | Classic 1, rare 5, super rare 20. Paying uses the cheapest rings first and gives change in classic rings. Kept between runs |
| Upgrades | Bow, bombs, heart charm (+1 heart, x3), sharp edge (+15% damage, x3), swift boots (+10% speed, x2) |
| Boss | Mossback, 3 stages by HP thirds: green fires bullet rings, orange fires aimed bursts, red fires spirals and dashes. Drops a ring on every stage change |
| Key + treasury | The key hangs on his neck and drops when he dies. Taking it reveals a hidden door in the west wall; behind it, 3 chests worth 50 rings |
| Fisherman | Comes to the arena pond every 30 s for 10 s and sells 3 things for coins (coins drop when you hit the boss); the fight pauses while you shop |
| Weapons | Fists and sword (melee), bow (shooting), bombs (thrown) |
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
