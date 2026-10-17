"""Local Piper TTS service (CPU-based neural speech synthesis).

Loads and reuses Piper ONNX models locally without cloud dependencies.
Supports Hindi (hi_IN-pratham-medium) and English (en_US-lessac-medium).
"""

import logging
import os
import re
import threading
import time
import uuid
import wave
from pathlib import Path
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_model_cache: dict[str, object] = {}
_model_lock = threading.Lock()

PIPER_VOICE_ALIASES = {
    # Hindi mappings
    "voice-priya": "hi_IN-pratham-medium",
    "hi-IN-SwaraNeural": "hi_IN-pratham-medium",
    "hi-IN-MadhurNeural": "hi_IN-pratham-medium",
    "hi_IN-pratham-medium": "hi_IN-pratham-medium",
    "hi": "hi_IN-pratham-medium",
    "hindi": "hi_IN-pratham-medium",
    # English mappings
    "voice-aura": "en_US-lessac-medium",
    "voice-echo": "en_US-lessac-medium",
    "voice-neel": "en_US-lessac-medium",
    "en-US-AriaNeural": "en_US-lessac-medium",
    "en-US-GuyNeural": "en_US-lessac-medium",
    "en-IN-NeerjaNeural": "en_US-lessac-medium",
    "en-IN-PrabhatNeural": "en_US-lessac-medium",
    "en_US-lessac-medium": "en_US-lessac-medium",
    "en": "en_US-lessac-medium",
    "english": "en_US-lessac-medium",
}

PIPER_ALLOWED_VOICES = frozenset(
    {
        "hi_IN-pratham-medium",
        "en_US-lessac-medium",
    }
)


def get_audio_dir() -> Path:
    settings = get_settings()
    audio_dir = Path(settings.tts_audio_dir)
    audio_dir.mkdir(parents=True, exist_ok=True)
    return audio_dir


def get_piper_models_dir() -> Path:
    settings = get_settings()
    p = Path(settings.piper_models_dir)
    if not p.is_absolute():
        if p.exists():
            return p
        backend_dir = Path(__file__).resolve().parent.parent.parent
        candidate = backend_dir / settings.piper_models_dir
        if candidate.exists():
            return candidate
    return p


def is_piper_installed() -> bool:
    try:
        import piper  # noqa: F401
        return True
    except ImportError:
        return False


def get_model_file_paths(model_name: str) -> tuple[Path, Path]:
    models_dir = get_piper_models_dir()
    onnx_path = models_dir / f"{model_name}.onnx"
    json_path = models_dir / f"{model_name}.onnx.json"
    return onnx_path, json_path


def is_model_available(model_name: str) -> bool:
    onnx_path, json_path = get_model_file_paths(model_name)
    return onnx_path.exists() and json_path.exists() and onnx_path.stat().st_size > 0


def get_piper_voice(model_name: str):
    """Load and cache a PiperVoice model instance thread-safely."""
    from piper import PiperVoice

    settings = get_settings()
    onnx_path, json_path = get_model_file_paths(model_name)

    if not onnx_path.exists():
        raise FileNotFoundError(
            f"Piper model '{model_name}' not found at {onnx_path}. "
            "Please run 'python scripts/download_piper_models.py' to download required voice models."
        )
    if not json_path.exists():
        raise FileNotFoundError(
            f"Piper model config not found at {json_path}. "
            "Please run 'python scripts/download_piper_models.py' to download required voice models."
        )

    with _model_lock:
        if model_name in _model_cache:
            return _model_cache[model_name]

        from app.core.device import resolve_piper_cuda

        use_cuda = resolve_piper_cuda(settings.piper_use_cuda)
        logger.info(
            "Loading Piper TTS voice: model=%s cuda=%s (configured=%s)",
            model_name,
            use_cuda,
            settings.piper_use_cuda,
        )
        started = time.perf_counter()
        try:
            voice = PiperVoice.load(
                onnx_path,
                config_path=json_path,
                use_cuda=use_cuda,
            )
        except Exception as exc:
            if use_cuda:
                logger.warning(
                    "Piper failed to initialize on CUDA (%s). Falling back gracefully to CPU.",
                    exc,
                )
                voice = PiperVoice.load(
                    onnx_path,
                    config_path=json_path,
                    use_cuda=False,
                )
            else:
                raise
        elapsed = time.perf_counter() - started
        logger.info("Piper voice '%s' loaded in %.2fs", model_name, elapsed)
        _model_cache[model_name] = voice
        return voice


def resolve_piper_voice(voice: str | None = None, text: str | None = None) -> str:
    """Resolve requested voice or language to a supported Piper voice model."""
    settings = get_settings()
    has_devanagari = bool(text and re.search(r"[\u0900-\u097F]", text))

    cleaned_voice = (voice or "").strip()
    resolved = PIPER_VOICE_ALIASES.get(cleaned_voice, cleaned_voice)

    # If text is Hindi or user requested Hindi
    if has_devanagari or resolved in ("hi", "hindi", "hi_IN-pratham-medium"):
        return settings.piper_hindi_model

    if resolved in PIPER_ALLOWED_VOICES:
        return resolved

    return settings.piper_english_model


def synthesize_piper_to_file(text: str, voice: str | None = None) -> Path:
    """Synthesize text using local Piper CPU TTS and save as a standard WAV file.

    Synchronous function meant to be executed via run_in_threadpool.
    """
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Text cannot be blank.")

    has_devanagari = bool(re.search(r"[\u0900-\u097F]", cleaned))
    resolved_model = resolve_piper_voice(voice, cleaned)

    # Guard: Never send Hindi text to an English-only voice
    if has_devanagari and "hi" not in resolved_model.lower():
        raise ValueError(
            f"Voice '{resolved_model}' does not support Hindi text. "
            "A Hindi-compatible voice model (e.g. hi_IN-pratham-medium) is required."
        )

    piper_voice = get_piper_voice(resolved_model)

    audio_dir = get_audio_dir()
    filepath = audio_dir / f"{uuid.uuid4().hex}.wav"

    try:
        with wave.open(str(filepath), "wb") as wav_file:
            piper_voice.synthesize_wav(cleaned, wav_file)
    except Exception as exc:
        if filepath.exists():
            try:
                filepath.unlink()
            except OSError:
                pass
        logger.exception("Piper synthesis failed for model %s", resolved_model)
        raise RuntimeError(f"Local Piper TTS synthesis failed: {exc}") from exc

    if not filepath.exists() or filepath.stat().st_size == 0:
        if filepath.exists():
            try:
                filepath.unlink()
            except OSError:
                pass
        raise RuntimeError("Piper TTS returned empty audio.")

    return filepath
