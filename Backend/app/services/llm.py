import logging
import time

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

import re

SYSTEM_PROMPT = """You are VoiceX AI, a fast, helpful multilingual voice assistant.
Rules for Spoken Voice Responses:
- Answer naturally, clearly, and conversationally.
- Keep answers concise (1 to 3 sentences) suitable for real-time speech.
- Do NOT use markdown tables, asterisks, bullet points, or URLs.
- CONVERSATIONAL MEMORY: Remember previous conversation turns and answer follow-ups in context.
- LANGUAGE MATCHING:
  * English user input -> Reply in natural English.
  * Hindi user input (Devanagari) -> Reply in Hindi using Devanagari script.
  * Hinglish user input (mixed Hindi & English or Romanized Hindi like "AI kya hai aur iske benefits kya hain?") -> Reply in natural, conversational Hinglish (mixed Hindi and English)."""

HINDI_PROMPT_DIRECTIVE = "You must reply in Hindi using the Devanagari script."


def build_system_prompt(language: str = "auto", message: str = "") -> str:
    lang = (language or "auto").strip().lower()
    msg = message or ""
    has_devanagari = bool(re.search(r"[\u0900-\u097F]", msg))

    # Detect Hinglish (Hindi words written in Latin script or mixed with English)
    hinglish_keywords = {
        "kya", "hai", "hain", "kaise", "kare", "karna", "nahi", "hota", "hoti",
        "batao", "mujhe", "mera", "meri", "aap", "tum", "aur", "iska", "iske",
        "kuch", "kyun", "kab", "kahan", "chahiye", "samjhao", "help", "fayde",
        "nuksaan", "matlab", "shukriya", "dhanyawad", "theek", "bhi", "yeh", "woh"
    }
    words = set(re.findall(r"\b[a-zA-Z]+\b", msg.lower()))
    is_hinglish = bool(words & hinglish_keywords)

    if lang in ("hi", "hindi"):
        return (
            f"{SYSTEM_PROMPT}\n"
            f"- {HINDI_PROMPT_DIRECTIVE}\n"
            "- Always use proper Devanagari script for Hindi responses."
        )
    elif has_devanagari and not is_hinglish:
        return (
            f"{SYSTEM_PROMPT}\n"
            f"- {HINDI_PROMPT_DIRECTIVE}\n"
            "- Reply in pure Hindi using Devanagari script."
        )
    elif is_hinglish:
        return (
            f"{SYSTEM_PROMPT}\n"
            "- The user is speaking in Hinglish (Hindi + English mix). Reply in natural, conversational Hinglish mixing Hindi and English words smoothly."
        )
    elif lang in ("en", "english"):
        return f"{SYSTEM_PROMPT}\n- Reply in clear, conversational English."

    return SYSTEM_PROMPT


def get_ollama_config():
    settings = get_settings()
    base_url = settings.ollama_base_url.rstrip("/")
    model = settings.ollama_model
    timeout_seconds = float(settings.ollama_timeout_seconds)
    return base_url, model, timeout_seconds


async def generate_response(
    message: str,
    history: list[dict] | None = None,
    language: str | None = None,
) -> dict:
    base_url, model, timeout_seconds = get_ollama_config()
    system_prompt = build_system_prompt(language=language or "auto", message=message)

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for item in (history or [])[-20:]:
        role = item.get("role")
        content = str(item.get("content", "")).strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:5000]})
    messages.append({"role": "user", "content": message.strip()[:5000]})

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "think": False,
                    "options": {"temperature": 0.7},
                },
            )
    except httpx.TimeoutException:
        raise RuntimeError(
            f"Ollama request timed out after {timeout_seconds:g}s"
        )
    except httpx.ConnectError as exc:
        raise RuntimeError(
            f"Cannot connect to Ollama at {base_url}. Is Ollama running? ({exc})"
        )
    except httpx.RequestError as exc:
        raise RuntimeError(f"Cannot connect to Ollama at {base_url}: {exc}")

    if response.status_code == 404:
        raise RuntimeError(
            f"Ollama model '{model}' not found. Run: ollama pull {model}"
        )
    if response.status_code != 200:
        raise RuntimeError(
            f"Ollama returned HTTP {response.status_code}: {response.text[:300]}"
        )

    data = response.json()
    text = str(data.get("message", {}).get("content", "")).strip()
    if not text:
        raise RuntimeError("Ollama returned an empty response")
    elapsed_ms = (time.perf_counter() - started) * 1000.0

    return {
        "text": text,
        "model": data.get("model", model),
        "processing_time_ms": elapsed_ms,
        "done": bool(data.get("done", True)),
    }
