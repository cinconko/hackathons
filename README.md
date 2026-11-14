# Hackathons

One folder for everything from hackathons: each event gets its own subfolder with its plan, notes and the code that was built for it.

| Folder | Event / project | Code |
|---|---|---|
| [clustering-busters](clustering-busters/PLAN.md) | Clustering Busters: scam checker in plain Czech | the backend and demo page live here (`clustering-busters/backend`, `clustering-busters/frontend`); the Mac app stays in [cinconko/clusterbusters](https://github.com/cinconko/clusterbusters) (local clone: `../clusterbusters/electron`) |

## Conventions

- Each project folder has a `PLAN.md` (goal, scope, timeline, demo script) and a `NOTES.md` for running notes.
- Each event's code lives in its folder and is runnable on its own (its own `scripts/`, `requirements.txt`, tests).
- Secrets stay out of git: `.env` and `data/` are ignored (see `.gitignore`).
