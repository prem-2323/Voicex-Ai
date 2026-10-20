"""Speech synthesis service supporting local Piper TTS and Edge-TTS fallback."""

import asyncio
import logging
import os
import re
import time
import uuid
from pathlib import Path

import edge_tts

from app.core.config import get_settings
from app.services.piper_tts import synthesize_piper_to_file

logger = logging.getLogger(__name__)

ALLOWED_VOICES = frozenset(
    {
        "en-US-AriaNeural",
        "en-US-GuyNeural",
        "en-IN-NeerjaNeural",
        "en-IN-PrabhatNeural",
        "hi-IN-SwaraNeural",
        "hi-IN-MadhurNeural",
        "en_US-lessac-medium",
        "hi_IN-pratham-medium",
    }
)

VOICE_ALIASES = {
    "voice-aura": "en-US-AriaNeural",
    "voice-neel": "en-IN-PrabhatNeural",
    "voice-priya": "hi-IN-SwaraNeural",
    "voice-echo": "en-US-GuyNeural",
    "en": "en_US-lessac-medium",
    "hi": "hi_IN-pratham-medium",
}

DEFAULT_VOICE = "en-US-AriaNeural"
MAX_TEXT_LENGTH = 3000


def resolve_voice(voice: str, text: str | None = None) -> str:
    """Resolve legacy frontend voice IDs to their neural equivalents.

    Priority:
    1. If the text contains Devanagari, force a Hindi voice.
    2. If the caller already asked for a Hindi voice, honour that.
    3. Otherwise, resolve aliases and return as-is.
    """
    if text and re.search(r"[\u0900-\u097F]", text):
        return "hi-IN-SwaraNeural"
    resolved = VOICE_ALIASES.get(voice, voice)
    # Honour the caller's explicit Hindi voice even for Romanized Hindi text
    if resolved in ALLOWED_VOICES:
        return resolved
    return resolved


def get_audio_dir() -> Path:
    settings = get_settings()
    audio_dir = Path(settings.tts_audio_dir)
    audio_dir.mkdir(parents=True, exist_ok=True)
    return audio_dir


def is_voice_allowed(voice: str) -> bool:
    return voice in ALLOWED_VOICES


def purge_stale_files(max_age_seconds: int | None = None) -> int:
    """Delete generated files older than the retention window.

    Returns the number of files removed. Never raises.
    """
    try:
        settings = get_settings()
        limit = (
            max_age_seconds
            if max_age_seconds is not None
            else int(settings.tts_retention_seconds)
        )
        now = time.time()
        removed = 0
        audio_dir = get_audio_dir()
        for ext in ("*.mp3", "*.wav"):
            for path in audio_dir.glob(ext):
                try:
                    if now - path.stat().st_mtime > limit:
                        path.unlink(missing_ok=True)
                        removed += 1
                except OSError:
                    continue
        return removed
    except Exception:
        return 0


async def synthesize_edge_to_file(text: str, voice: str) -> Path:
    """Synthesize text using Edge-TTS and return the path of the generated MP3."""
    cleaned = text.strip()
    if not cleaned:
        raise RuntimeError("Text cannot be blank.")
    resolved_voice = resolve_voice(voice, text=cleaned)
    if resolved_voice not in ALLOWED_VOICES:
        raise RuntimeError(f"Unsupported voice '{voice}'.")
    if len(cleaned) > MAX_TEXT_LENGTH:
        raise RuntimeError(
            f"Text too long (max {MAX_TEXT_LENGTH} characters)."
        )

    settings = get_settings()
    audio_dir = get_audio_dir()
    filepath = audio_dir / f"{uuid.uuid4().hex}.mp3"
    try:
        communicate = edge_tts.Communicate(cleaned, resolved_voice)
        await asyncio.wait_for(
            communicate.save(str(filepath)),
            timeout=float(settings.tts_timeout_seconds),
        )
    except asyncio.TimeoutError as exc:
        if filepath.exists():
            try:
                filepath.unlink()
            except OSError:
                pass
        logger.warning("Edge-TTS synthesis timed out")
        raise RuntimeError(
            "Voice generation timed out. Please try a shorter text."
        ) from exc
    except Exception as exc:
        if filepath.exists():
            try:
                filepath.unlink()
            except OSError:
                pass
        logger.exception("Edge-TTS synthesis failed")
        raise RuntimeError(
            "Unable to generate speech audio. Check the TTS service "
            f"and internet connection. ({type(exc).__name__})"
        ) from exc

    if not filepath.exists() or filepath.stat().st_size == 0:
        if filepath.exists():
            try:
                filepath.unlink()
            except OSError:
                pass
        raise RuntimeError("TTS service returned empty audio.")
    return filepath


async def synthesize_to_file(text: str, voice: str) -> Path:
    """Synthesize text and return the path of the generated audio file."""
    settings = get_settings()
    provider = (getattr(settings, "tts_provider", "piper") or "piper").lower()
    fallback = (getattr(settings, "tts_fallback_provider", "none") or "none").lower()

    if provider == "piper":
        try:
            from starlette.concurrency import run_in_threadpool

            if callable(synthesize_piper_to_file):
                import inspect
                if inspect.iscoroutinefunction(synthesize_piper_to_file):
                    return await synthesize_piper_to_file(text, voice)
            return await run_in_threadpool(synthesize_piper_to_file, text, voice)
        except Exception as exc:
            if fallback == "edge":
                logger.warning("Piper TTS failed (%s); falling back to Edge-TTS", exc)
                return await synthesize_edge_to_file(text, voice)
            raise

    return await synthesize_edge_to_file(text, voice)


def delete_file_quietly(path: str | os.PathLike) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass
