import logging
import re
import threading
import time
from functools import lru_cache

from faster_whisper import WhisperModel

from app.core.config import get_settings

from app.core.device import resolve_whisper_device, setup_cuda_dll_paths

setup_cuda_dll_paths()

logger = logging.getLogger(__name__)

_model_lock = threading.Lock()


@lru_cache(maxsize=1)
def get_whisper_model() -> WhisperModel:
    settings = get_settings()
    model_size = settings.whisper_model
    device, compute_type = resolve_whisper_device(
        settings.whisper_device, settings.whisper_compute_type
    )
    logger.info(
        "Loading Faster-Whisper: model=%s device=%s compute=%s",
        model_size,
        device,
        compute_type,
    )
    try:
        return WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            local_files_only=True,
        )
    except Exception:
        try:
            return WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                local_files_only=False,
            )
        except Exception as exc:
            if device != "cpu":
                logger.warning(
                    "Faster-Whisper failed on %s (%s). Falling back gracefully to CPU.",
                    device,
                    exc,
                )
                return WhisperModel(
                    model_size,
                    device="cpu",
                    compute_type="int8",
                    local_files_only=False,
                )
            raise


def transcribe_audio(audio_path: str, language: str | None = None) -> dict:
    started = time.perf_counter()
    model = get_whisper_model()
    kwargs = {
        "beam_size": 5,
        # Silero VAD prevents Whisper from hallucinating words such as
        # "I", "you", or punctuation on silence/background noise.
        "vad_filter": True,
        "vad_parameters": {
            "min_silence_duration_ms": 500,
            "speech_pad_ms": 200,
        },
        # Voice turns are independent utterances; carrying text context
        # into the decoder increases repetition and hallucination.
        "condition_on_previous_text": False,
        "no_speech_threshold": 0.6,
    }
    if language:
        kwargs["language"] = language
    with _model_lock:
        segments_iter, info = model.transcribe(audio_path, **kwargs)
        segments = list(segments_iter)

    text = " ".join(seg.text.strip() for seg in segments).strip()
    # Even with VAD, Whisper can occasionally return punctuation-only
    # output. Treat that as silence instead of sending it to the LLM.
    if not re.search(r"[A-Za-z0-9\u0900-\u097F]", text):
        text = ""
    elapsed_ms = (time.perf_counter() - started) * 1000.0

    raw_lang = (info.language or "en").lower() if info and info.language else "en"
    has_devanagari = bool(re.search(r"[\u0900-\u097F]", text))
    hindi_keywords = {
        "kya", "hai", "hain", "kaise", "kare", "karna", "nahi", "nahin", "hota", "hoti",
        "batao", "bataiye", "mujhe", "mera", "meri", "mere", "aap", "tum", "aur", "iska", "iske",
        "namaste", "pranam", "theek", "shukriya", "dhanyawad", "bolo"
    }
    has_hindi_words = bool(set(re.findall(r"\b[a-zA-Z]+\b", text.lower())) & hindi_keywords)

    if raw_lang == "hi" or has_devanagari or has_hindi_words or raw_lang in ("ur", "mr", "ne", "pa", "gu", "bho", "sa"):
        resolved_lang = "hi"
    else:
        resolved_lang = "en"

    return {
        "text": text,
        "language": resolved_lang,
        "language_probability": round(float(info.language_probability), 4) if info.language_probability is not None else 1.0,
        "duration_seconds": round(float(info.duration), 2) if info.duration is not None else 0.0,
        "segments": [
            {"start": round(float(seg.start), 2), "end": round(float(seg.end), 2), "text": seg.text.strip()}
            for seg in segments
        ],
        "processing_time_ms": round(elapsed_ms, 2),
    }
