"""Outgoing check: spot things a scammer wants before the person sends them.

Runs fully locally (regex + checksums). Nothing here calls a model or a server,
so sensitive data never leaves the device. Matched values are masked in the
result and never stored.
"""

import re

# 13-19 digits, optionally grouped by spaces or dashes (card numbers)
_CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
# IBAN: 2 letters, 2 check digits, 10-30 alphanumerics, optional spaces
_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b")
# Czech bank account: optional prefix-, number, /bank code
_CZ_ACCOUNT_RE = re.compile(r"(?<![\d/])(?:\d{1,6}-)?\d{2,10}/\d{4}(?!\d)")
# Czech birth number: YYMMDD/XXXX or YYMMDDXXXX
_BIRTH_RE = re.compile(r"(?<!\d)(\d{6})/?(\d{3,4})(?!\d)")
# One-time code: 4-8 digits near a code word, in Czech or English
_OTP_WORDS = r"(?:k[oó]d|code|ov[eě][rř]ovac[ií]|potvrzovac[ií]|sms|otp|autoriza[cč]n[ií]|pin)"
_OTP_RE = re.compile(
    rf"{_OTP_WORDS}[^\d]{{0,30}}(?<!\d)(\d{{4,8}})(?!\d)|(?<!\d)(\d{{4,8}})(?!\d)[^\d]{{0,30}}{_OTP_WORDS}",
    re.IGNORECASE,
)
_ONLY_DIGITS_RE = re.compile(r"^\s*\d{4,8}\s*$")
_PASSWORD_RE = re.compile(
    r"\b(?:heslo|password|passwd|pin)\b\s*(?:je|is|:|=)?\s*\S+", re.IGNORECASE
)


def luhn_ok(number: str) -> bool:
    digits = [int(c) for c in number if c.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def iban_ok(raw: str) -> bool:
    iban = raw.replace(" ", "").upper()
    if not 15 <= len(iban) <= 34:
        return False
    rearranged = iban[4:] + iban[:4]
    numeric = "".join(str(int(c, 36)) for c in rearranged)
    return int(numeric) % 97 == 1


def birth_number_ok(head: str, tail: str) -> bool:
    """Czech rodne cislo: valid month (women +50, overflow +20) and mod-11 for 10 digits."""
    month = int(head[2:4])
    day = int(head[4:6])
    if month > 50:
        month -= 50
    if month > 20:
        month -= 20
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return False
    if len(tail) == 3:
        return True  # pre-1954 format has no checksum
    full = int(head + tail)
    if full % 11 == 0:
        return True
    # rare legacy rule: first 9 digits mod 11 == 10 and check digit 0
    return int(head + tail[:3]) % 11 == 10 and tail[3] == "0"


def _mask(value: str) -> str:
    v = value.strip()
    if len(v) <= 4:
        return "*" * len(v)
    return "*" * (len(v) - 4) + v[-4:]


def find_sensitive(text: str) -> list[dict]:
    """Return a list of findings: {kind, masked, label}. Values are masked."""
    findings: list[dict] = []
    seen_spans: list[tuple[int, int]] = []

    def add(kind: str, label: str, value: str, span: tuple[int, int]) -> None:
        for s, e in seen_spans:
            if span[0] < e and s < span[1]:
                return  # overlaps an earlier, stronger finding
        seen_spans.append(span)
        findings.append({"kind": kind, "label": label, "masked": _mask(value)})

    for m in _CARD_RE.finditer(text):
        if luhn_ok(m.group()):
            add("card", "číslo platební karty", m.group(), m.span())
    for m in _IBAN_RE.finditer(text):
        if iban_ok(m.group()):
            add("iban", "IBAN / číslo účtu", m.group(), m.span())
    # Birth number before account: "780123/0008" fits both shapes, but only a
    # real birth number passes the checksum, so it is the more specific match.
    for m in _BIRTH_RE.finditer(text):
        if birth_number_ok(m.group(1), m.group(2)):
            add("birth_number", "rodné číslo", m.group(), m.span())
    for m in _CZ_ACCOUNT_RE.finditer(text):
        add("account", "číslo bankovního účtu", m.group(), m.span())
    for m in _OTP_RE.finditer(text):
        code = m.group(1) or m.group(2)
        start = m.start(1) if m.group(1) else m.start(2)
        add("otp", "jednorázový / ověřovací kód", code, (start, start + len(code)))
    if _ONLY_DIGITS_RE.match(text):
        m = re.search(r"\d+", text)
        add("otp", "samotný číselný kód (možná ověřovací kód)", m.group(), m.span())
    for m in _PASSWORD_RE.finditer(text):
        add("password", "heslo nebo PIN", m.group(), m.span())
    return findings


def check_outgoing(text: str, recipient_flagged: bool = False) -> dict:
    """Decide whether to pause the send and what to tell the person."""
    findings = find_sensitive(text or "")
    if not findings:
        return {"action": "allow", "risk": "none", "findings": [], "message": None}

    kinds = {f["kind"] for f in findings}
    high = bool(kinds & {"otp", "card", "password"}) or recipient_flagged
    risk = "high" if high else "medium"
    labels = ", ".join(sorted({f["label"] for f in findings}))
    if recipient_flagged:
        message = (
            f"Pozor: chystáte se poslat {labels} kontaktu, který vám nedávno poslal "
            "pravděpodobně podvodnou zprávu. Banky ani úřady o tohle nikdy nežádají. "
            "Opravdu odeslat?"
        )
    else:
        message = (
            f"Chystáte se poslat {labels}. Banky ani úřady o tohle přes zprávy nežádají. "
            "Opravdu odeslat?"
        )
    return {"action": "confirm", "risk": risk, "findings": findings, "message": message}
