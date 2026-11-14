# Clustering Busters: plan

**Name:** Clustering Busters (the repo and code are still called `clusterbusters`).
**Code:** this folder (backend and demo page). The Mac app stays in [cinconko/clusterbusters](https://github.com/cinconko/clusterbusters) · local clone: `../../clusterbusters/electron`
**Full product plan:** [docs/PLAN.md](../../clusterbusters/docs/PLAN.md) · model choices: [docs/MODEL.md](../../clusterbusters/docs/MODEL.md)

## Idea

An agent that tells non-technical people, in plain Czech, whether a message is a scam, what to do about it, and warns before they send a bank code or card number. It learns from every "right / wrong" correction.

## Goal for the hackathon

- [ ] Demo a working scam check end to end (text, screenshot, outgoing-data warning)
- [ ] Show the learning loop: a user correction changes the next answer
- [ ] Mac app Clusty running live on screen capture (optional if time is short)

## Scope

**In:** the backend (`POST /check`, `/check-image`, `/check-outgoing`, `/feedback`), the demo page, and the Clusty Mac app (lives in the clusterbusters repo).
**Out:** new accounts, mobile apps, and anything that needs real bank data.

## Timeline

| When | What |
|---|---|
| Before start | Run `./scripts/setup.sh` here on the demo laptop; check `./scripts/test.sh` passes |
| Hour 1 | Fix blockers; pick the demo messages (1 scam, 1 safe, 1 bank-code message) |
| Middle | Polish the demo page and the warning copy |
| 1 hour before end | Feature freeze; rehearse the demo script twice |
| End | Demo, then write the team's lessons in `NOTES.md` |

## Demo script (3 minutes)

1. Paste a scam SMS → warning in plain Czech with the next step.
2. Drop a screenshot of a fake bank page → same check via Apple Vision OCR.
3. Type a bank account number → outgoing warning (never leaves the device).
4. Mark a result as wrong → show the learned rule changing the next answer.

## Risks

- Demo laptop missing Screen Recording permission for Clusty → test before the event.
- Model API unavailable → the rules-only path must still give answers.
- Tests failing on `main` block pushes → fix before merging anything late.

## Team

See the team table in [the repo README](../../clusterbusters/README.md#team).
