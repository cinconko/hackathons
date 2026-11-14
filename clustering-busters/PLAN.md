# Clustering Busters: plan

**Code:** this folder.

| Folder | What |
|---|---|
| [`backend/`](backend) | Scam-check API: `POST /check`, `/check-image`, `/check-outgoing`, `/feedback` |
| [`frontend/`](frontend) | Demo page (`demo.html`), served by the backend at http://127.0.0.1:8000 |
| [`pixel-game/`](pixel-game) | Ringfall, the boss-fight pixel game |
| [`scripts/`](scripts) | `setup.sh`, `run-backend.sh`, `test.sh` |

The Mac app Clusty is separate: [cinconko/clusterbusters](https://github.com/cinconko/clusterbusters) (`electron/`). Background reading there: [product plan](https://github.com/cinconko/clusterbusters/blob/main/docs/PLAN.md), [model choices](https://github.com/cinconko/clusterbusters/blob/main/docs/MODEL.md).

## Idea

An agent that tells non-technical people, in plain Czech, whether a message is a scam, what to do about it, and warns before they send a bank code or card number. It learns from every "right / wrong" correction.

## Goal for the hackathon

- [x] Demo a working scam check end to end (text, screenshot, outgoing-data warning). Checked through the API on 14 Nov; still click through the demo page once in a browser.
- [x] Show the learning loop: a user correction changes the next answer (`safe` → `scam`, source `learned`).
- [ ] Mac app Clusty running live on screen capture (optional if time is short)

## Scope

**In:** the backend, the demo page, the Ringfall game, and the Clusty Mac app.
**Out:** new accounts, mobile apps, and anything that needs real bank data.

## Timeline

| When | What |
|---|---|
| Before start | In this folder: run `./scripts/setup.sh` on the demo laptop; check `./scripts/test.sh` passes |
| Hour 1 | Fix blockers; pick the demo messages (1 scam, 1 safe, 1 bank-code message) |
| Middle | Polish the demo page and the warning copy |
| 1 hour before end | Feature freeze; rehearse the demo script twice |
| End | Demo, then write the team's lessons in [`NOTES.md`](NOTES.md) |

## Demo script (3 minutes)

1. Paste a scam SMS → warning in plain Czech with the next step.
2. Drop a screenshot of a fake bank page → same check via Apple Vision OCR.
3. Type a bank account number → outgoing warning (never leaves the device).
4. Mark a result as wrong → show the learned rule changing the next answer.

## Ringfall (the game)

Boss fight in a full HD pixel frame: one boss with 3 stages, rings in 3 rarities, a fisherman shop every 30 s, and fists, sword, bow and bombs. Run it with `cd pixel-game && npm ci && npm run dev`. Details in the code: [`pixel-game/src/game/rules.ts`](pixel-game/src/game/rules.ts).

## Risks

- Demo laptop missing Screen Recording permission for Clusty → test before the event.
- Model API unavailable → the rules-only path must still give answers.
- No CI or push hook in this repo → run `./scripts/test.sh` (and `npm test` in `pixel-game/`) before every push.

## Team

| Name | GitHub |
|---|---|
| Simon Kubec | @cinconko |
| | TheXik |
| | bukacdan |
