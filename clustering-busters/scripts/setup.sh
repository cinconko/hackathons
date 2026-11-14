#!/usr/bin/env bash
# One-time setup after cloning. Safe to run again. Backend only (the Mac app lives in clusterbusters/electron).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Python backend"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt

[ -f .env ] || { cp .env.example .env; echo "==> Created .env (fill in FEATHERLESS_* to enable the AI model)"; }

echo "==> Running tests"
./scripts/test.sh

echo
echo "Done. Next:"
echo "  ./scripts/run-backend.sh      # API + demo page on http://127.0.0.1:8000"
