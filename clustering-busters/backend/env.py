"""Load the repo's .env into os.environ (without overriding real env vars).

Imported first by backend/app.py, so the API gets the same settings whether it
is started by scripts/run-backend.sh, by uvicorn directly, or by the Mac app.
"""

import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


def load_env(path: Path = ENV_FILE) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        if value:  # empty placeholders in .env must not hide real env vars
            os.environ.setdefault(key.strip(), value)


load_env()
