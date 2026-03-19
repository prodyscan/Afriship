import os
import re
import json
from typing import Optional, Dict, Any, List

from huggingface_hub import InferenceClient

# -----------------------------
# Config Qwen (gratuit)
# -----------------------------
HF_TOKEN = (os.getenv("HF_TOKEN") or "").strip()
MODEL_ID = (os.getenv("QWEN_MODEL_ID") or "Qwen/Qwen2.5-7B-Instruct").strip()

client = InferenceClient(
    model=MODEL_ID,
    token=HF_TOKEN if HF_TOKEN else None
)

# -----------------------------
# Prompt Shiplus
# -----------------------------
SYSTEM_PROMPT = """
Tu es Shiplus, l’assistante officielle de la plateforme AfriShipPlus.

Ton rôle est de qualifier rapidement une demande d’expédition avant d’autoriser la création d’expédition.

Tu dois poser seulement ces questions :
1. type d’expédition : aérien ou maritime
2. quantité :
   - aérien = poids en kg
   - maritime = volume en CBM
3. nature du colis
4. ville de destination

Règles :
- Ne pose qu’une seule question à la fois
- Réponses courtes, professionnelles et claires
- Ne demande pas de détails techniques inutiles
- Ne parle jamais comme un système interne
- Ne donne jamais directement un numéro d’agent au début

Règle spéciale :
- Si le colis contient batterie, lithium, power bank, pile ou batterie solaire
  ET que le client demande aérien :
  refuse l’aérien et propose le maritime
  en expliquant que les batteries et produits contenant du lithium
  ne sont pas acceptés en expédition aérienne à notre niveau

Qualification :
- Si aérien et poids < 10 kg → STATUS: NOT_READY
- Si maritime et volume < 0.3 CBM → STATUS: NOT_READY
- Si une information manque → STATUS: NEED_MORE_INFO
- Si les informations sont présentes et valides → STATUS: READY

Réponse obligatoire :
Tu dois terminer chaque réponse par UNE SEULE ligne exacte :
STATUS: READY
ou
STATUS: NEED_MORE_INFO
ou
STATUS: NOT_READY
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

# -----------------------------
# Public function (garder le nom)
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
        completion = client.chat_completion(
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        answer = completion.choices[0].message["content"]

        answer = sanitize_answer(answer)
        answer = _strip_repeated_greeting(answer, has_history)

        return {"answer": answer, "model": MODEL_ID}

    except Exception as e:
        try:
            prompt = system
            if history:
                hist_txt = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in history])
                prompt += "\n\n" + hist_txt
            prompt += "\n\n" + user_payload + "\n\nAssistant:"

            out = client.text_generation(
                prompt,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
                return_full_text=False,
            )

            if isinstance(out, str):
                answer = out
            elif isinstance(out, dict) and "generated_text" in out:
                answer = out["generated_text"]
            else:
                answer = str(out)

            answer = sanitize_answer(answer)
            answer = _strip_repeated_greeting(answer, has_history)

            return {"answer": answer.strip(), "model": MODEL_ID}

        except Exception as e2:
            return {
                "error": "⏳ Impossible de contacter Shiplus pour le moment. Réessaie dans quelques instants.",
                "detail": str(e),
                "detail2": str(e2),
                "model": MODEL_ID,
                "has_token": bool(HF_TOKEN),
            }
