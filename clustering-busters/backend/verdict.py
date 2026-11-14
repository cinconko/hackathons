"""Incoming check: is this message a scam?

Two layers:
1. Rules + learned examples (always available, works offline, fully explainable).
2. An open model on Featherless (used when FEATHERLESS_API_KEY is set). The
   model gets the current rules and examples in its prompt, so feedback
   improves both layers.

Learning loop: /feedback stores the message with the correct label in
rules.json. Similar future messages are pulled toward that label (nearest
example), and the model sees them as examples. No fine-tuning.

    message ──► normalize ──► rule signals ──┐
                         └─► nearest example ─┼─► score ─► verdict (rules)
                                              │
                 rules + examples in prompt ──┴─► model ─► verdict (model)
                                                    │ error / bad JSON
                                                    └──► fall back to rules
"""

import json
import os
import re
import threading
import unicodedata
from pathlib import Path

import httpx

DEFAULT_RULES_PATH = Path(__file__).with_name("rules.json")


def _model_settings() -> tuple[str, str, str, float]:
    """Read at call time, so .env changes apply after a reload without code edits."""
    return (
        os.environ.get("FEATHERLESS_API_KEY", ""),
        os.environ.get("FEATHERLESS_MODEL", ""),
        os.environ.get("FEATHERLESS_BASE_URL") or "https://api.featherless.ai/v1",
        float(os.environ.get("MODEL_TIMEOUT_S") or 20),
    )

SIMILARITY_THRESHOLD = 0.35
EXAMPLE_WEIGHT = 4
SCAM_AT = 5
SUSPICIOUS_AT = 2

WHAT_TO_DO = {
    "scam": "Na nic neklikejte a neodpovídejte. Nic neplaťte a nikomu neposílejte kódy. "
            "Pokud jde o banku, zavolejte na číslo uvedené na vaší kartě. Zprávu můžete nahlásit Policii ČR.",
    "suspicious": "Buďte opatrní. Neklikejte na odkazy. Ověřte si to přímo u odesílatele, "
                  "ale jiným kanálem, například zavolejte na číslo, které znáte.",
    "safe": "Vypadá to v pořádku. Pokud vás ale zpráva žádá o peníze nebo kódy, raději se zeptejte.",
}


def normalize(text: str) -> str:
    """Lowercase and strip diacritics so 'Zásilka' and 'zasilka' match the same rules."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower()


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", normalize(text)) if len(t) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


class RuleStore:
    """rules.json on disk plus in-memory flagged senders. Thread-safe."""

    def __init__(self, path: Path = DEFAULT_RULES_PATH):
        self.path = Path(path)
        self._lock = threading.Lock()
        self.flagged_senders: set[str] = set()
        self._data = json.loads(self.path.read_text(encoding="utf-8"))
        self._compile()

    def _compile(self) -> None:
        self._signals = [
            (s, re.compile(normalize(s["pattern"]))) for s in self._data["signals"]
        ]

    @property
    def data(self) -> dict:
        with self._lock:
            return json.loads(json.dumps(self._data))  # deep copy

    def add_example(self, text: str, label: str) -> dict:
        if label not in ("scam", "safe"):
            raise ValueError("label must be 'scam' or 'safe'")
        example = {"text": text, "label": label, "source": "feedback"}
        with self._lock:
            self._data["examples"].append(example)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self._data, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp.replace(self.path)  # atomic write: no half-written rules file
        return example

    def score(self, text: str) -> dict:
        norm = normalize(text)
        hits = [s for s, rx in self._signals if rx.search(norm)]
        score = sum(s["weight"] for s in hits)
        reasons = [s["reason"] for s in hits]

        msg_tokens = _tokens(text)
        best, best_sim = None, 0.0
        with self._lock:
            examples = list(self._data["examples"])
        for ex in examples:
            sim = _jaccard(msg_tokens, _tokens(ex["text"]))
            if sim > best_sim:
                best, best_sim = ex, sim
        matched = None
        if best and best_sim >= SIMILARITY_THRESHOLD:
            matched = {"label": best["label"], "similarity": round(best_sim, 2), "source": best["source"]}
            if best["label"] == "scam":
                score += EXAMPLE_WEIGHT
                reasons.append("Je velmi podobná zprávě, která už byla označena jako podvod.")
            else:
                score -= EXAMPLE_WEIGHT
                reasons.append("Je velmi podobná zprávě, která byla označena jako bezpečná.")
        return {"score": score, "signals": [s["id"] for s in hits], "reasons": reasons, "matched_example": matched}


def _rules_verdict(store: RuleStore, text: str) -> dict:
    s = store.score(text)
    if s["score"] >= SCAM_AT:
        verdict = "scam"
    elif s["score"] >= SUSPICIOUS_AT:
        verdict = "suspicious"
    else:
        verdict = "safe"
    confidence = round(min(0.95, 0.5 + abs(s["score"]) / 12), 2)
    reasons = s["reasons"] or ["Nenašli jsme žádné typické znaky podvodu."]
    return {
        "verdict": verdict,
        "confidence": confidence,
        "reasons": reasons,
        "what_to_do": WHAT_TO_DO[verdict],
        "source": "rules",
        "signals": s["signals"],
        "matched_example": s["matched_example"],
    }


_SYSTEM_PROMPT = """You check whether a message a person received is a scam.
The person is not technical. Answer in Czech, short and plain.
Return ONLY a JSON object with keys:
  "verdict": "scam" | "suspicious" | "safe",
  "confidence": number 0..1,
  "reasons": list of 1-3 short Czech sentences,
  "what_to_do": one short Czech sentence of advice.
Never tell the person to click a link or share a code. If unsure, say "suspicious"."""


def _model_verdict(store: RuleStore, text: str, rules_result: dict) -> dict:
    api_key, model, base_url, timeout = _model_settings()
    if not api_key or not model:
        raise RuntimeError("model not configured (set FEATHERLESS_API_KEY and FEATHERLESS_MODEL)")
    data = store.data
    examples = data["examples"][-20:]  # newest feedback matters most
    context = {
        "known_scam_signals": [s["reason"] for s in data["signals"]],
        "labelled_examples": [{"text": e["text"], "label": e["label"]} for e in examples],
        "rule_engine_hint": {"verdict": rules_result["verdict"], "signals": rules_result["signals"]},
    }
    body = {
        "model": model,
        "temperature": 0,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": "Context:\n" + json.dumps(context, ensure_ascii=False)
             + "\n\nMessage to check:\n" + text},
        ],
    }
    resp = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json=body,
        timeout=timeout,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError("model did not return JSON")
    out = json.loads(match.group())
    if out.get("verdict") not in ("scam", "suspicious", "safe"):
        raise ValueError(f"bad verdict from model: {out.get('verdict')!r}")
    reasons = [str(r) for r in out.get("reasons", [])][:3] or rules_result["reasons"]
    return {
        "verdict": out["verdict"],
        "confidence": float(out.get("confidence", 0.5)),
        "reasons": reasons,
        "what_to_do": str(out.get("what_to_do") or WHAT_TO_DO[out["verdict"]]),
        "source": "model",
        "signals": rules_result["signals"],
        "matched_example": rules_result["matched_example"],
    }


def _learned_reasons(label: str, rules_result: dict) -> list[str]:
    """Why a learned answer was given: the person's own correction leads, then up to
    two of the rule reasons (the similarity sentence is kept there too)."""
    why = ("Tuto zprávu jste dříve označili jako podvod." if label == "scam"
           else "Tuto zprávu jste dříve označili jako bezpečnou.")
    return [why] + [r for r in rules_result["reasons"] if r != why][:2]


def check_incoming(store: RuleStore, text: str, sender: str | None = None, use_model: bool = True) -> dict:
    rules_result = _rules_verdict(store, text)
    result = rules_result
    if use_model:
        try:
            result = _model_verdict(store, text, rules_result)
        except Exception as exc:  # any model problem: keep the rules verdict, say why
            result = dict(rules_result, model_error=f"{type(exc).__name__}: {exc}")
    # A learned example is a direct human correction: it wins over the model.
    if rules_result["matched_example"] and rules_result["matched_example"]["source"] == "feedback":
        learned = rules_result["matched_example"]["label"]
        if learned == "scam" and result["verdict"] != "scam":
            result = dict(rules_result, verdict="scam", what_to_do=WHAT_TO_DO["scam"], source="learned",
                          reasons=_learned_reasons("scam", rules_result))
        elif learned == "safe" and result["verdict"] != "safe":
            result = dict(rules_result, verdict="safe", what_to_do=WHAT_TO_DO["safe"], source="learned",
                          reasons=_learned_reasons("safe", rules_result))
    if sender and result["verdict"] == "scam":
        store.flagged_senders.add(sender)
    return result
