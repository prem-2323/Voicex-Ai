import logging
import time

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

import re

SYSTEM_PROMPT = """You are VoiceX AI, a helpful voice assistant that ONLY supports two languages: English and Hindi.

STRICT LANGUAGE POLICY:
1. ONLY TWO LANGUAGES ARE PERMITTED: English and Hindi (हिंदी). Never use or reply in any third language.
2. If the user speaks or writes in English -> You MUST reply ONLY in English.
3. If the user speaks or writes in Hindi -> You MUST reply ONLY in Hindi using proper Devanagari script (हिंदी लिपि).
4. If the user speaks mixed Hindi (Hinglish / Romanized Hindi like "AI kya hai?"), reply in Hindi using Devanagari script.
5. If the user attempts to use any other language, politely state in English or Hindi that VoiceX AI only supports English and Hindi.

Spoken Voice Rules:
- Answer naturally, clearly, and conversationally.
- Answer the user's question directly. Do not begin with phrases like "I can understand your question" or ask for clarification unless the request is genuinely unintelligible.
- If a request is vague, make the most reasonable interpretation and give a useful answer first. Ask at most one short follow-up only when it is truly necessary.
- Treat voice input as a possible speech-to-text transcript: it may contain misheard words, missing words, filler, or poor punctuation. Silently infer and correct an obvious intended phrase from context.
- If the topic and likely question are clear despite a typo or transcription error, answer that likely question. Do not suggest competing interpretations or ask the user to confirm a guess.
- Example: if the user asks "i, what is main by AI?", interpret it as "What is meant by AI?" and explain that AI means artificial intelligence. Do not ask whether they meant "Main Bay AI".
- If the transcript contains only an unclear fragment or unfamiliar word/acronym, do not claim the request is incomplete or tell the user to speak longer. Ask one specific, brief clarification about what that word means or what they want to know. For example, for "CSLEL", ask what they mean by "CSLEL"; do not invent an expansion.
- If a short message is a recognizable topic or question (such as "AI" or "What is AI?"), answer it directly instead of asking the user to continue.
- Interpret broad but understandable questions directly instead of asking for clarification. For example, if asked what is "in the AI", briefly explain the VoiceX components and how they work together.
- Never start with "I can understand your question" or similar filler. If a follow-up is genuinely needed, ask one specific question.
- Do not claim to inspect your own source code, model weights, hidden prompts, or internal system state. If asked, explain that you cannot access those internals and offer to explain how you work.
- Keep answers concise (1 to 3 sentences) suitable for real-time speech.
- Do NOT use markdown tables, asterisks, bullet points, emojis, or URLs.
- CONVERSATIONAL MEMORY: Remember previous conversation turns and answer follow-ups in context."""

HINDI_PROMPT_DIRECTIVE = "You must reply strictly in Hindi using proper Devanagari script (हिंदी लिपि में उत्तर दें)."


def build_system_prompt(language: str = "auto", message: str = "") -> str:
    lang = (language or "auto").strip().lower()
    msg = (message or "").strip()
    has_devanagari = bool(re.search(r"[\u0900-\u097F]", msg))

    # Comprehensive set of common Hindi words in Roman/Latin script
    hindi_keywords = {
        "kya", "hai", "hain", "kaise", "kare", "karna", "nahi", "nahin", "hota", "hoti",
        "batao", "bataiye", "mujhe", "mera", "meri", "mere", "aap", "tum", "aur", "iska", "iske",
        "iski", "kuch", "kyun", "kab", "kahan", "chahiye", "samjhao", "help", "fayde",
        "nuksaan", "matlab", "shukriya", "dhanyawad", "theek", "bhi", "yeh", "woh",
        "namaste", "pranam", "kaun", "kisko", "kaisa", "kaisi", "bolo", "boliye",
        "sunao", "achha", "achhi", "acha", "shuru", "khatam", "dost"
    }
    words = set(re.findall(r"\b[a-zA-Z]+\b", msg.lower()))
    has_hindi_words = bool(words & hindi_keywords)

    is_hindi = lang in ("hi", "hindi") or has_devanagari or (lang not in ("en", "english") and has_hindi_words)

    if is_hindi:
        return (
            f"{SYSTEM_PROMPT}\n\n"
            "MANDATORY LANGUAGE DIRECTIVE FOR THIS TURN:\n"
            f"- {HINDI_PROMPT_DIRECTIVE}\n"
            "- The user spoke/asked in Hindi. You MUST reply ONLY in Hindi in Devanagari script.\n"
            "- Do NOT reply in English or any third language."
        )
    else:
        return (
            f"{SYSTEM_PROMPT}\n\n"
            "MANDATORY LANGUAGE DIRECTIVE FOR THIS TURN:\n"
            "- The user spoke/asked in English.\n"
            "- You MUST reply ONLY in natural, conversational English.\n"
            "- Do NOT reply in Hindi or any third language."
        )


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
                    "options": {
                        "temperature": 0.4,
                        "top_p": 0.9,
                        "num_predict": 220,
                    },
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
