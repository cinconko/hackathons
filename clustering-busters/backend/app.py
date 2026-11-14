"""Scam checker API.

POST /check            incoming message -> verdict (rules + model)
POST /check-image      screenshot (base64) -> on-device OCR -> verdict + read text
POST /check-outgoing   text about to be sent -> allow / confirm (local only)
POST /feedback         "you were right/wrong" -> stored as a learned example
GET  /rules            current signals + examples (for the on-screen rules panel)
GET  /health
GET  /                 redirects to the demo page (/app/demo.html)

Run:  .venv/bin/uvicorn backend.app:app --reload --port 8000
"""

import backend.env  # noqa: F401  (must be first: loads .env)

import base64
import binascii
import os
import shutil
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend import ocr
from backend.checks_out import check_outgoing
from backend.verdict import DEFAULT_RULES_PATH, RuleStore, check_incoming

MAX_LEN = 5000
MAX_IMAGE_B64 = 14 * 1024 * 1024  # ~10 MB image after decoding

ROOT = Path(__file__).resolve().parent.parent
LOCAL_RULES = ROOT / "data" / "rules.local.json"


def _rules_path() -> Path:
    """Learned feedback goes to data/rules.local.json (git-ignored), seeded from
    the committed backend/rules.json. Each teammate learns locally without
    merge conflicts. Reset = delete data/rules.local.json."""
    if os.environ.get("RULES_PATH"):
        return Path(os.environ["RULES_PATH"])
    if not LOCAL_RULES.exists():
        LOCAL_RULES.parent.mkdir(exist_ok=True)
        shutil.copy(DEFAULT_RULES_PATH, LOCAL_RULES)
    return LOCAL_RULES


store = RuleStore(_rules_path())


@asynccontextmanager
async def lifespan(_app):
    if os.environ.get("OCR_WARMUP", "1") == "1":
        threading.Thread(target=ocr.warm_up, daemon=True).start()
    yield


app = FastAPI(title="Clustering Busters scam checker", lifespan=lifespan)
app.add_middleware(  # the demo page may be served from another port
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


class IncomingIn(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_LEN)
    sender: str | None = Field(default=None, max_length=200)
    use_model: bool = True


class ImageIn(BaseModel):
    image_base64: str = Field(min_length=1, max_length=MAX_IMAGE_B64)
    sender: str | None = Field(default=None, max_length=200)
    use_model: bool = True


class OutgoingIn(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_LEN)
    recipient: str | None = Field(default=None, max_length=200)


class FeedbackIn(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_LEN)
    correct_label: str = Field(pattern="^(scam|safe)$")


FRONTEND_DIR = ROOT / "frontend"
app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/app/demo.html")


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "model_configured": bool(os.environ.get("FEATHERLESS_API_KEY") and os.environ.get("FEATHERLESS_MODEL")),
        "examples": len(store.data["examples"]),
    }


@app.post("/check")
def check(body: IncomingIn) -> dict:
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "text is empty")
    return check_incoming(store, text, sender=body.sender, use_model=body.use_model)


@app.post("/check-image")
def check_image(body: ImageIn) -> dict:
    """Screenshot of a message -> text (Apple Vision, on-device) -> normal /check."""
    raw = body.image_base64
    if raw.startswith("data:"):  # accept data URLs from a browser file input
        raw = raw.split(",", 1)[-1]
    try:
        data = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "image_base64 is not valid base64")
    try:
        read = ocr.image_to_text(data)
    except ocr.OcrError as exc:
        raise HTTPException(422, str(exc))
    text = read["text"].strip()
    if not text:
        raise HTTPException(422, "Na obrázku jsme nenašli žádný text.")
    result = check_incoming(store, text[:MAX_LEN], sender=body.sender, use_model=body.use_model)
    return dict(result, ocr={"text": text, "confidence": round(read["confidence"], 2)})


@app.post("/check-outgoing")
def check_out(body: OutgoingIn) -> dict:
    flagged = bool(body.recipient and body.recipient in store.flagged_senders)
    return check_outgoing(body.text, recipient_flagged=flagged)


@app.post("/feedback")
def feedback(body: FeedbackIn) -> dict:
    example = store.add_example(body.text.strip(), body.correct_label)
    return {"stored": example, "examples": len(store.data["examples"])}


@app.get("/rules")
def rules() -> dict:
    return store.data
