# Clustering Busters: plan

**The project:** Ringfall, a pixel adventure game with one big boss fight. Code: [`pixel-game/`](pixel-game).

## Idea

You fight one boss in three stages. The boss drops rings, the fisherman sells you gear every 30 seconds, and you pick the weapon that fits the moment.

## What is in the game

| Part | How it works |
|---|---|
| Screen | 320x180 pixel grid, scaled in whole steps (exact 6x = full HD 1920x1080), pixel frame around the play area, F for fullscreen |
| Boss | Mossback, 3 stages by HP thirds: green fires bullet rings, orange fires aimed bursts, red fires spirals and dashes |
| Rings | Classic (70%), rare (25%), super rare (5%). One drops on every stage change, the final drop is at least rare. They boost damage, speed and hearts |
| Retailer | A fisherman comes to the pond every 30 s and stays 10 s. He shows 3 things to buy; the fight pauses while you shop |
| Weapons | Fists and sword (melee), bow (shooting), bombs (thrown). Bow and bombs are bought from the fisherman |

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
