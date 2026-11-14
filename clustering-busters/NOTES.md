cau

# Clustering Busters: running notes

## Status (14 Nov 2026)

Checked against [PLAN.md](PLAN.md). Code (backend, demo page) moved here on 14 Nov; the Mac app is still in `../../clusterbusters` (branch `feat/2d-logos`).

| Demo step | Status | Evidence |
|---|---|---|
| 1. Scam SMS → warning in Czech | Works | `/check` → `scam`, 0.95, rules; reasons and next step in Czech |
| 2. Screenshot → same check (Apple Vision) | Works | Rendered a scam-SMS screenshot; OCR read it on-device; `/check-image` → `scam`, 0.95 |
| 3. Bank account number → outgoing warning | Works | `/check-outgoing` → `confirm`, medium risk, masked `***2010` |
| 4. Wrong answer → learned rule changes the next answer | Works | `safe` (rules, 0.5) → `scam` (learned, 0.83) after one `/feedback` |

Tests: backend 49 passed, Electron 80 passed.

## Changes this session

- `backend/verdict.py`: a learned answer now leads with "Tuto zprávu jste dříve označili jako podvod/bezpečnou." (before, it only had the similarity sentence). Test: `test_learned_verdict_explains_itself`. Not committed.

## Gotchas

- `/feedback` takes `correct_label`, not `label`.
- `RULES_PATH` points the backend at another rules file, so demo runs can use a scratch copy and leave `data/rules.local.json` alone.
- Without `FEATHERLESS_API_KEY` the model is off; the answers above are rules only. The rules-only path works, as the plan requires.

## Open

- Demo page not clicked through in a browser yet; only the API was checked.
- Clusty Mac app not run live (optional goal).
- Pick the three demo messages (scam, safe, bank-code) for the hour-1 slot.

## Move (14 Nov)

- Backend, demo page, OCR helper source, rules copy and backend scripts moved from `clusterbusters` to this folder. Backend tests: 49 passed here. All four demo checks re-run here: same results.
- `clusterbusters` keeps only the Mac app: its `scripts/test.sh` and CI now run Electron tests only (80 passed). The backend's `.venv` and `data/rules.local.json` still exist in `clusterbusters` as leftovers and can be deleted.
- Not committed in either repo. Old copy still in `~/Projects/hackathon-team` (same old paths).
