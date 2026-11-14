#!/usr/bin/env bash
# Run the backend test suite.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "-- backend"
OCR_WARMUP=0 .venv/bin/python -m pytest backend/tests -q
