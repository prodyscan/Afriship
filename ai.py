import os
import re
import json
import requests
from typing import Optional, Dict, Any, List

# -----------------------------
# Config (Render / Github)
# -----------------------------
MISTRAL_API_KEY = (os.getenv("MISTRAL_API_KEY") or "").strip()
MODEL_ID = (os.getenv("MISTRAL_MODEL") or "mistral-small-latest").strip()
MISTRAL_URL = (os.getenv("MISTRAL_URL") or "https://api.mistral.ai/v1/chat/completions").strip()

# -----------------------------
# Prompt (optimisé Mistral)
# -----------------------------
SYSTEM_PROMPT = """
Tu es Shiplus, l’assistante officielle de la plateforme AfriShipPlus.

AfriShipPlus est une plateforme indépendante de mise en relation et de gestion de demandes d’expédition.
AfriShipPlus n’est affiliée à aucune marketplace ou compagnie de transport.

Rôle de Shiplus :
- accueillir le client
- comprendre son besoin d’expédition
- faire une discussion préliminaire
- poser les bonnes questions avant d’autoriser la création d’expédition
- éviter que les agents soient dérangés par des demandes non sérieuses
- expliquer clairement le fonctionnement de la plateforme
- guider le client vers aérien ou maritime selon son besoin

Règles obligatoires :
- Tu ne donnes jamais directement un numéro d’agent au début.
- Tu ne promets jamais un contact agent si la demande n’est pas suffisamment qualifiée.
- Tu dois d’abord vérifier que le client a un besoin sérieux et suffisamment clair.
- Tu peux expliquer les minimums :
  - aérien : minimum 10 kg
  - maritime : minimum 0.3 CBM
- Si la demande n’est pas prête, tu restes polie et tu expliques ce qu’il manque.
- Si des informations manquent, pose une seule question courte à la fois.
- Tu n’inventes jamais des prix en temps réel ni des données non fournies.

Objectif :
déterminer si le client est prêt à créer une expédition.

Tu dois chercher à obtenir :
1. type d’expédition (aérien ou maritime)
2. poids en kg ou volume en CBM
3. nature du colis / marchandise
4. destination / ville
5. niveau de préparation du client (prêt à expédier ou simple demande d’info)

Statuts obligatoires :
À la fin de chaque réponse, ajoute exactement UNE ligne parmi :

STATUS: NOT_READY
STATUS: NEED_MORE_INFO
STATUS: READY

Règles de décision :
- STATUS: NOT_READY
  si le client n’est pas prêt, ou si les minimums ne sont pas respectés, ou si la demande est trop vague / pas sérieuse
- STATUS: NEED_MORE_INFO
  si la demande semble intéressante mais qu’il manque des informations essentielles
- STATUS: READY
  seulement si la demande est suffisamment claire, sérieuse, et respecte les minimums

Style :
- réponds dans la langue du client
- si le client écrit en français, réponds uniquement en français
- réponses courtes, professionnelles, utiles
- ne répète pas "Bonjour" à chaque message si la conversation a déjà commencé
""".strip()

FORBIDDEN_PHRASES = [
    "shiplus est affiliée",
    "shiplus appartient à",
    "afrishiplus appartient à",
    "fourni par alibaba",
    "développé par alibaba",
    "créé par alibaba",
    "application alibaba",
    "outil alibaba",
]

LEGAL_CORRECTION_FR = (
    "Shiplus est l’assistante d’AfriShipPlus, une plateforme indépendante de gestion et de préqualification "
    "des demandes d’expédition. AfriShipPlus n’est pas affiliée à Alibaba ni à une compagnie de transport."
)

# -----------------------------
# Helpers
# -----------------------------
def sanitize_answer(answer: str) -> str:
    ans = (answer or "").strip()
    lower = ans.lower()

    if "shiplus" in lower or "afrishiplus" in lower:
        for phrase in FORBIDDEN_PHRASES:
            if phrase in lower:
                return LEGAL_CORRECTION_FR

    return ans


def _normalize_language(lang: Optional[str]) -> str:
    if not lang:
        return "auto"
    lang = lang.strip().lower()
    if lang in ("auto", "detect", "autodetect"):
        return "auto"
    if "-" in lang:
        lang = lang.split("-")[0]
    return lang if lang in {"auto", "fr", "en", "ar", "es", "pt"} else "auto"


def _sanitize_history_messages(
    messages: Optional[List[Dict[str, Any]]],
    max_items: int = 12,
    max_chars_each: int = 900
) -> List[Dict[str, str]]:
    if not messages:
        return []

    cleaned: List[Dict[str, str]] = []
    for m in messages[-max_items:]:
        if not isinstance(m, dict):
            continue
        role = (m.get("role") or "").strip().lower()
        content = m.get("content")

        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str):
            continue

        content = content.strip()
        if not content:
            continue

        cleaned.append({"role": role, "content": content[:max_chars_each]})
    return cleaned


def _build_user_payload(
    message: str,
    ocr_text: Optional[str],
    cost_json: Optional[Dict[str, Any]],
    margin_json: Optional[Dict[str, Any]],
    user_memory: Optional[Dict[str, Any]],
) -> str:
    parts: List[str] = []

    if user_memory:
        parts.append("[USER_MEMORY]\n" + json.dumps(user_memory, ensure_ascii=False))

    if ocr_text:
        parts.append("[OCR_TEXT]\n" + ocr_text.strip())

    if cost_json:
        parts.append("[COST_DATA]\n" + json.dumps(cost_json, ensure_ascii=False))

    if margin_json:
        parts.append("[MARGIN_DATA]\n" + json.dumps(margin_json, ensure_ascii=False))

    parts.append("[USER_MESSAGE]\n" + (message or "").strip())
    return "\n\n".join(parts)


def _strip_repeated_greeting(answer: str, has_history: bool) -> str:
    if not has_history:
        return answer

    a = answer.lstrip()
    a = re.sub(r"^(bonjour|bonsoir|salut)\s*[!.,:–-]*\s*", "", a, flags=re.I)
    return a.strip()


def _call_mistral_chat(messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
    if not MISTRAL_API_KEY:
        raise RuntimeError("MISTRAL_API_KEY manquant (Render env var).")

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "model": MODEL_ID,
        "messages": messages,
        "temperature": float(temperature),
        "max_tokens": int(max_tokens),
    }

    r = requests.post(MISTRAL_URL, headers=headers, json=payload, timeout=60)

    if r.status_code >= 400:
        try:
            detail = r.json()
        except Exception:
            detail = {"raw": r.text}
        raise RuntimeError(f"Mistral HTTP {r.status_code}: {detail}")

    data = r.json()
    return (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "") or ""


# -----------------------------
# Public function (GARDER LE NOM)
# -----------------------------
def ask_qwen(
    message: str,
    language: str = "auto",
    messages: Optional[List[Dict[str, Any]]] = None,
    user_memory: Optional[Dict[str, Any]] = None,
    ocr_text: Optional[str] = None,
    cost_json: Optional[Dict[str, Any]] = None,
    margin_json: Optional[Dict[str, Any]] = None,
    temperature: float = 0.4,
    max_tokens: int = 800,
) -> dict:

    language_target = _normalize_language(language)
    system = f"LANGUAGE_TARGET={language_target}\n\n{SYSTEM_PROMPT}"

    history = _sanitize_history_messages(messages, max_items=12)
    has_history = len(history) > 0

    user_payload = _build_user_payload(message, ocr_text, cost_json, margin_json, user_memory)

    chat_messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
    chat_messages.extend(history)
    chat_messages.append({"role": "user", "content": user_payload})

    try:
        answer = _call_mistral_chat(chat_messages, temperature=temperature, max_tokens=max_tokens)
        answer = sanitize_answer(answer)
        answer = _strip_repeated_greeting(answer, has_history)
        return {"answer": answer, "model": MODEL_ID}

    except Exception as e:
        return {
            "error": "⏳ Impossible de contacter Shiplus pour le moment. Réessaie dans quelques instants.",
            "detail": str(e),
            "model": MODEL_ID,
            "has_key": bool(MISTRAL_API_KEY),
        }
