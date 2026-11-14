#!/usr/bin/env bash
# Start the API with auto-reload. Demo page: http://127.0.0.1:8000
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use (another backend is probably running)."
  echo "  Stop it with Ctrl+C in its terminal, or start this one elsewhere:"
  echo "  PORT=8001 ./scripts/run-backend.sh"
  echo "  Already running one? Just open http://127.0.0.1:$PORT"
  exit 1
fi
exec .venv/bin/uvicorn backend.app:app --reload --port "$PORT"   # backend loads .env itself
