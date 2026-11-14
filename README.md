# Hackathons

One folder for everything from hackathons: each event gets its own subfolder with its plan, notes and the code that was built for it.

| Folder | Event / project | Code |
|---|---|---|
| [clustering-busters](clustering-busters/PLAN.md) | Clustering Busters: Ringfall, a pixel boss-fight game | [`clustering-busters/pixel-game`](clustering-busters/pixel-game) |

## Conventions

- Each project folder has a `PLAN.md` (goal, scope, timeline, demo script) and a `NOTES.md` for running notes.
- Each event's code lives in its folder and is runnable on its own (its own `package.json` and tests).
- Secrets stay out of git: `.env` is ignored (see `.gitignore`).
