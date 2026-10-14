"""Edge-TTS speech synthesis service.

Edge-TTS uses the online Microsoft speech service, so an internet
connection is required. It is not a fully offline engine.
"""

import asyncio
import logging
import os
import time
import uuid
from pathlib import Path

import edge_tts

from app.core.config import get_settings

logger = logging.getLogger(__name__)

ALLOWED_VOICES = frozenset(
    {
        "en-US-AriaNeural",
        "en-US-GuyNeural",
        "en-IN-NeerjaNeural",
        "en-IN-PrabhatNeural",
        "hi-IN-SwaraNeural",
        "hi-IN-MadhurNeural",
    }
)

VOICE_ALIASES = {
    "voice-aura": "en-US-AriaNeural",
    "voice-neel": "en-IN-PrabhatNeural",
    "voice-priya": "hi-IN-SwaraNeural",
    "voice-echo": "en-US-GuyNeural",
}

DEFAULT_VOICE = "en-US-AriaNeural"
MAX_TEXT_LENGTH = 3000


def resolve_voice(voice: str) -> str:
    """Resolve legacy frontend voice IDs to their neural equivalents."""
    return VOICE_ALIASES.get(voice, voice)


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
        for path in audio_dir.glob("*.mp3"):
            try:
                if now - path.stat().st_mtime > limit:
                    path.unlink(missing_ok=True)
                    removed += 1
            except OSError:
                continue
        return removed
    except Exception:
        return 0


async def synthesize_to_file(text: str, voice: str) -> Path:
    """Synthesize text and return the path of the generated MP3.

    Raises RuntimeError with a user-friendly message on failure.
    """
    cleaned = text.strip()
    if not cleaned:
        raise RuntimeError("Text cannot be blank.")
    if voice not in ALLOWED_VOICES:
        raise RuntimeError(f"Unsupported voice '{voice}'.")
    if len(cleaned) > MAX_TEXT_LENGTH:
        raise RuntimeError(
            f"Text too long (max {MAX_TEXT_LENGTH} characters)."
        )

    settings = get_settings()
    audio_dir = get_audio_dir()
    filepath = audio_dir / f"{uuid.uuid4().hex}.mp3"
    try:
        communicate = edge_tts.Communicate(cleaned, voice)
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


def delete_file_quietly(path: str | os.PathLike) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass
