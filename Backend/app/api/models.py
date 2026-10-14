import logging

import httpx
from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings

router = APIRouter(tags=["Models"])
logger = logging.getLogger(__name__)


def _check_stt() -> dict:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return {
            "name": "Faster-Whisper",
            "status": "not_integrated",
            "detail": "faster-whisper package is not installed.",
        }
    return {"name": "Faster-Whisper", "status": "package_present"}


async def _load_stt_model() -> dict:
    """Confirm the configured Whisper model actually loads, not just
    that the package is importable."""
    from app.services.stt import get_whisper_model

    settings = get_settings()
    try:
        await run_in_threadpool(get_whisper_model)
        return {
            "name": "Faster-Whisper",
            "status": "ready",
            "model": settings.whisper_model,
            "device": settings.whisper_device,
            "compute_type": settings.whisper_compute_type,
        }
    except Exception as exc:
        logger.exception("Whisper model load check failed")
        return {
            "name": "Faster-Whisper",
            "status": "error",
            "model": settings.whisper_model,
            "detail": str(exc)[:300],
        }


async def _check_llm() -> dict:
    """Confirm the configured Ollama model tag actually exists locally."""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
    except httpx.ConnectError:
        return {
            "name": settings.ollama_model,
            "status": "unavailable",
            "detail": f"Cannot reach Ollama at {settings.ollama_base_url}.",
        }
    except Exception as exc:
        return {
            "name": settings.ollama_model,
            "status": "error",
            "detail": str(exc)[:300],
        }

    if response.status_code != 200:
        return {
            "name": settings.ollama_model,
            "status": "error",
            "detail": f"Ollama returned HTTP {response.status_code}.",
        }

    installed = [
        m.get("name")
        for m in response.json().get("models", [])
        if isinstance(m, dict)
    ]
    if settings.ollama_model in installed:
        return {
            "name": settings.ollama_model,
            "status": "ready",
            "detail": f"Model tag present in Ollama ({len(installed)} installed).",
        }
    return {
        "name": settings.ollama_model,
        "status": "missing",
        "detail": (
            f"Model '{settings.ollama_model}' not in Ollama. "
            f"Run: ollama pull {settings.ollama_model}"
        ),
    }


@router.get("/models")
async def get_model_status():
    stt = _check_stt()
    if stt["status"] == "package_present":
        stt = await _load_stt_model()

    return {
        "stt": stt,
        "llm": await _check_llm(),
        "tts": {
            "name": "Piper or Kokoro",
            "status": "not_integrated",
        },
        "vad": {
            "name": "Silero VAD",
            "status": "not_integrated",
        },
    }
