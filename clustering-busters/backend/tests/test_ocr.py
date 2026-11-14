import base64
import io
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import backend.app as app_module
from backend import ocr
from backend.verdict import DEFAULT_RULES_PATH, RuleStore

PIL = pytest.importorskip("PIL")
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

needs_mac = pytest.mark.skipif(
    sys.platform != "darwin" or not Path("/usr/bin/swiftc").exists(),
    reason="Apple Vision OCR needs macOS with Xcode tools",
)
FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"


def render(lines: list[str], fmt: str = "PNG") -> bytes:
    font = ImageFont.truetype(FONT, 34)
    img = Image.new("RGB", (900, 80 + 70 * len(lines)), "white")
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        draw.text((30, 40 + 70 * i), line, fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, fmt)
    return buf.getvalue()


@pytest.fixture
def client(tmp_path, monkeypatch):
    path = tmp_path / "rules.json"
    shutil.copy(DEFAULT_RULES_PATH, path)
    monkeypatch.setattr(app_module, "store", RuleStore(path))
    monkeypatch.delenv("FEATHERLESS_API_KEY", raising=False)
    return TestClient(app_module.app)


# ---------- input validation (no OCR needed) ----------

@pytest.mark.parametrize("data,msg", [
    (b"", "prázdný"),
    (b"hello, not an image", "podporovaný"),
    (b"\x89PNG" + b"0" * (ocr.MAX_IMAGE_BYTES + 1), "velký"),
])
def test_rejects_bad_images(data, msg):
    with pytest.raises(ocr.OcrError, match=msg):
        ocr.image_to_text(data)


def test_api_rejects_bad_base64(client):
    r = client.post("/check-image", json={"image_base64": "not base64!!"})
    assert r.status_code == 422


def test_api_rejects_non_image(client):
    r = client.post("/check-image", json={"image_base64": base64.b64encode(b"plain text").decode()})
    assert r.status_code == 422
    assert "podporovaný" in r.json()["detail"]


# ---------- real OCR on macOS ----------

@needs_mac
def test_ocr_reads_czech_text():
    out = ocr.image_to_text(render(["Ahoj mami, mám nové číslo"]))
    norm = out["text"].lower()
    assert "mami" in norm and "nov" in norm
    assert out["confidence"] > 0.5


@needs_mac
def test_ocr_jpeg_too():
    out = ocr.image_to_text(render(["Vaše zásilka čeká na doplatek"], fmt="JPEG"))
    assert "doplatek" in out["text"].lower()


@needs_mac
def test_api_screenshot_of_scam_is_scam(client):
    img = render(["Vaše zásilka čeká na doplatek 39 Kč.", "Zaplaťte do 24 hodin: bit.ly/posta-cz"])
    r = client.post("/check-image", json={"image_base64": base64.b64encode(img).decode(), "use_model": False})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["verdict"] == "scam"
    assert "doplatek" in body["ocr"]["text"].lower()


@needs_mac
def test_api_accepts_data_url(client):
    img = render(["Ahoj, v sobotu ve 3 u babičky"])
    url = "data:image/png;base64," + base64.b64encode(img).decode()
    r = client.post("/check-image", json={"image_base64": url, "use_model": False})
    assert r.status_code == 200
    assert r.json()["verdict"] == "safe"


@needs_mac
def test_api_blank_image_says_no_text(client):
    img = Image.new("RGB", (400, 200), "white")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    r = client.post("/check-image", json={"image_base64": base64.b64encode(buf.getvalue()).decode()})
    assert r.status_code == 422
    assert "text" in r.json()["detail"]
