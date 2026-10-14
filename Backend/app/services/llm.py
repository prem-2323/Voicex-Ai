import logging
import time

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are VoiceX AI, a helpful multilingual voice assistant.
Rules:
- Answer clearly and naturally.
- Prefer concise answers suitable for spoken conversation.
- Reply in the user's language when reasonably identifiable.
- Do not claim to have performed actions you did not perform.
- If you are uncertain, say so."""


def get_ollama_config():
    settings = get_settings()
    base_url = settings.ollama_base_url.rstrip("/")
    model = settings.ollama_model
    timeout_seconds = float(settings.ollama_timeout_seconds)
    return base_url, model, timeout_seconds


async def generate_response(message: str, history: list[dict] | None = None) -> dict:
    base_url, model, timeout_seconds = get_ollama_config()

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
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
