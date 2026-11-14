"""Image -> text using the Apple Vision helper in tools/ocr (macOS only, offline).

The Swift helper is compiled automatically the first time it is needed, so
teammates on a Mac only need Xcode command line tools (`xcode-select --install`).
The image is written to a temp file, read, then deleted. Nothing is kept.
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tools" / "ocr" / "ocr.swift"
BINARY = ROOT / "tools" / "ocr" / "bin" / "ocr"
OCR_TIMEOUT_S = 60  # first call after boot loads Apple's model (~25 s); later calls ~0.2 s
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Magic bytes of the formats screenshots and phones produce.
_SIGNATURES = {
    b"\x89PNG": "png",
    b"\xff\xd8\xff": "jpg",
    b"GIF8": "gif",
    b"II*\x00": "tiff",
    b"MM\x00*": "tiff",
}


class OcrError(Exception):
    """Raised with a message that is safe to show to the person."""


def _kind(data: bytes) -> str | None:
    for sig, kind in _SIGNATURES.items():
        if data.startswith(sig):
            return kind
    if data[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1"):
        return "heic"  # iPhone photos
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def ensure_binary() -> Path:
    if BINARY.exists() and BINARY.stat().st_mtime >= SOURCE.stat().st_mtime:
        return BINARY
    if not Path("/usr/bin/swiftc").exists():
        raise OcrError("Čtení obrázků vyžaduje macOS s nástroji Xcode (xcode-select --install).")
    BINARY.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["/usr/bin/swiftc", "-O", str(SOURCE), "-o", str(BINARY)],
        capture_output=True, text=True, timeout=300,
    )
    if result.returncode != 0:
        raise OcrError(f"Nepodařilo se sestavit OCR: {result.stderr.strip()[:300]}")
    return BINARY


# Smallest valid PNG (1x1 white). Used only to make macOS load the text model.
_WARMUP_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de"
    "0000000c49444154789c63f8ffff3f0005fe02fe0def46b80000000049454e44ae426082"
)


def warm_up() -> None:
    """Load the OCR model in the background so the first real screenshot is fast."""
    try:
        image_to_text(_WARMUP_PNG)
    except Exception:
        pass  # not on macOS, or no Xcode tools: /check-image will explain when used


def image_to_text(data: bytes) -> dict:
    """Return {"text", "lines", "confidence"}. Raises OcrError on bad input."""
    if not data:
        raise OcrError("Obrázek je prázdný.")
    if len(data) > MAX_IMAGE_BYTES:
        raise OcrError("Obrázek je příliš velký (max 10 MB).")
    kind = _kind(data)
    if not kind:
        raise OcrError("Tohle není podporovaný obrázek (PNG, JPG, HEIC, WEBP, GIF, TIFF).")
    binary = ensure_binary()
    fd, path = tempfile.mkstemp(suffix=f".{kind}")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        result = subprocess.run([str(binary), path], capture_output=True, text=True, timeout=OCR_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        raise OcrError("Čtení obrázku trvalo příliš dlouho.")
    finally:
        os.unlink(path)  # never keep the screenshot
    if result.returncode != 0:
        raise OcrError("Obrázek se nepodařilo přečíst.")
    return json.loads(result.stdout)
