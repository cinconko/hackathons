import shutil

import pytest
from fastapi.testclient import TestClient

import backend.app as app_module
from backend.checks_out import birth_number_ok, check_outgoing, find_sensitive, iban_ok, luhn_ok
from backend.verdict import DEFAULT_RULES_PATH, RuleStore, check_incoming


@pytest.fixture
def store(tmp_path):
    path = tmp_path / "rules.json"
    shutil.copy(DEFAULT_RULES_PATH, path)  # never touch the real rules file
    return RuleStore(path)


@pytest.fixture
def client(store, monkeypatch):
    monkeypatch.setattr(app_module, "store", store)
    monkeypatch.delenv("FEATHERLESS_API_KEY", raising=False)
    return TestClient(app_module.app)


# ---------- outgoing: checksums ----------

def test_luhn():
    assert luhn_ok("4111 1111 1111 1111")
    assert not luhn_ok("4111 1111 1111 1112")
    assert not luhn_ok("1234")


def test_iban():
    assert iban_ok("CZ65 0800 0000 1920 0014 5399")
    assert not iban_ok("CZ65 0800 0000 1920 0014 5398")


def test_birth_number():
    assert birth_number_ok("780123", "0008")      # divisible by 11
    assert not birth_number_ok("780123", "0009")
    assert not birth_number_ok("781323", "0008")  # month 13 invalid
    assert birth_number_ok("785523", "123")       # woman (+50), pre-1954 3-digit tail


# ---------- outgoing: findings ----------

@pytest.mark.parametrize("text,kind", [
    ("Tady je kód: 482913", "otp"),
    ("482913", "otp"),
    ("your verification code 7731", "otp"),
    ("karta 4111 1111 1111 1111", "card"),
    ("posílám na CZ65 0800 0000 1920 0014 5399", "iban"),
    ("účet 19-2000145399/0800", "account"),
    ("moje rodné číslo je 780123/0008", "birth_number"),
    ("heslo je Tajne123", "password"),
])
def test_finds_sensitive(text, kind):
    kinds = {f["kind"] for f in find_sensitive(text)}
    assert kind in kinds


@pytest.mark.parametrize("text", [
    "Ahoj, přijdu v 5",
    "Sraz ve 14:30 u kina",
    "Mám 3 jablka a 2 hrušky",
    "Volej na 777 123 456",       # phone number is not a secret
    "karta 4111 1111 1111 1112",  # fails Luhn
])
def test_no_false_alarm(text):
    assert check_outgoing(text)["action"] == "allow"


def test_outgoing_masks_value():
    result = check_outgoing("kód 482913")
    assert result["action"] == "confirm"
    assert result["risk"] == "high"
    assert "482913" not in str(result)  # value never echoed back
    assert result["findings"][0]["masked"].endswith("2913")


def test_outgoing_flagged_recipient_raises_risk():
    result = check_outgoing("19-2000145399/0800", recipient_flagged=True)
    assert result["risk"] == "high"
    assert "podvodnou" in result["message"]


# ---------- incoming: rules ----------

@pytest.mark.parametrize("text", [
    "Vaše zásilka čeká na doplatek 49 Kč, zaplaťte ihned: bit.ly/x1",
    "Ahoj mami, mám nové číslo, potřebuju peníze",
    "Váš účet bude zablokován, ověřte údaje na https://banka-overeni.xyz",
    "Sdělte nám kód z SMS pro dokončení platby",
])
def test_scams_detected(store, text):
    assert check_incoming(store, text, use_model=False)["verdict"] == "scam"


@pytest.mark.parametrize("text", [
    "Ahoj, v sobotu ve 3 u babičky",
    "Připomínáme termín u zubaře ve čtvrtek",
    "Díky za včerejšek, bylo to super",
])
def test_safe_messages(store, text):
    assert check_incoming(store, text, use_model=False)["verdict"] == "safe"


def test_diacritics_do_not_matter(store):
    a = check_incoming(store, "Váš účet bude zablokován", use_model=False)
    b = check_incoming(store, "Vas ucet bude zablokovan", use_model=False)
    assert a["verdict"] == b["verdict"]


def test_model_missing_falls_back_to_rules(store, monkeypatch):
    monkeypatch.delenv("FEATHERLESS_API_KEY", raising=False)
    result = check_incoming(store, "Ahoj mami, mám nové číslo", use_model=True)
    assert result["source"] == "rules"
    assert "model_error" in result


# ---------- learning loop ----------

def test_feedback_teaches_new_scam(store):
    new_scam = "Dobrý den, váš elektroměr potřebuje výměnu, technik přijde zítra, potvrďte termín odpovědí ANO"
    similar = "Dobry den, vas elektromer potrebuje vymenu, technik prijde v pondeli, potvrdte termin odpovedi ANO"
    assert check_incoming(store, similar, use_model=False)["verdict"] == "safe"
    store.add_example(new_scam, "scam")
    result = check_incoming(store, similar, use_model=False)
    assert result["verdict"] == "scam"
    assert result["matched_example"]["source"] == "feedback"


def test_feedback_persists_to_disk(store):
    store.add_example("test zprava ktera se ulozi", "safe")
    reloaded = RuleStore(store.path)
    assert reloaded.data["examples"][-1]["text"] == "test zprava ktera se ulozi"


def test_bad_label_rejected(store):
    with pytest.raises(ValueError):
        store.add_example("x", "maybe")


# ---------- API ----------

def test_api_flow_in_then_out(client):
    r = client.post("/check", json={"text": "Ahoj mami, mám nové číslo, pošli peníze", "sender": "+420700000001", "use_model": False})
    assert r.status_code == 200 and r.json()["verdict"] == "scam"
    r = client.post("/check-outgoing", json={"text": "19-2000145399/0800", "recipient": "+420700000001"})
    assert r.json()["action"] == "confirm"
    assert r.json()["risk"] == "high"


def test_api_feedback_and_rules(client):
    before = len(client.get("/rules").json()["examples"])
    r = client.post("/feedback", json={"text": "nová podvodná zpráva", "correct_label": "scam"})
    assert r.status_code == 200
    assert len(client.get("/rules").json()["examples"]) == before + 1


@pytest.mark.parametrize("path,body", [
    ("/check", {"text": ""}),
    ("/check", {"text": "x" * 5001}),
    ("/check-outgoing", {}),
    ("/feedback", {"text": "x", "correct_label": "maybe"}),
])
def test_api_rejects_bad_input(client, path, body):
    assert client.post(path, json=body).status_code == 422


def test_api_whitespace_only(client):
    assert client.post("/check", json={"text": "   "}).status_code == 422


def test_health(client):
    body = client.get("/health").json()
    assert body["ok"] and body["model_configured"] is False


def test_learned_verdict_explains_itself(store):
    # A learned answer must say why, even when no rule matched the text.
    new_scam = "Dobrý den, váš elektroměr potřebuje výměnu, technik přijde zítra, potvrďte termín odpovědí ANO"
    similar = "Dobry den, vas elektromer potrebuje vymenu, technik prijde v pondeli, potvrdte termin odpovedi ANO"
    store.add_example(new_scam, "scam")
    result = check_incoming(store, similar, use_model=False)
    assert result["source"] == "learned"
    assert result["reasons"], "learned verdict has no reasons"
    assert any("označili" in r for r in result["reasons"])
