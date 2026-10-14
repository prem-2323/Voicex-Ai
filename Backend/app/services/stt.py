import logging
import threading
import time
from functools import lru_cache

from faster_whisper import WhisperModel

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_model_lock = threading.Lock()


@lru_cache(maxsize=1)
def get_whisper_model() -> WhisperModel:
    settings = get_settings()
    model_size = settings.whisper_model
    device = settings.whisper_device
    compute_type = settings.whisper_compute_type
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
        return WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            local_files_only=False,
        )


def transcribe_audio(audio_path: str) -> dict:
    started = time.perf_counter()
    model = get_whisper_model()
    with _model_lock:
        segments_iter, info = model.transcribe(audio_path, beam_size=5)
        segments = list(segments_iter)

    text = " ".join(seg.text.strip() for seg in segments).strip()
    elapsed_ms = (time.perf_counter() - started) * 1000.0

    return {
        "text": text,
        "language": info.language,
        "language_probability": round(float(info.language_probability), 4) if info.language_probability is not None else 1.0,
        "duration_seconds": round(float(info.duration), 2) if info.duration is not None else 0.0,
        "segments": [
            {"start": round(float(seg.start), 2), "end": round(float(seg.end), 2), "text": seg.text.strip()}
            for seg in segments
        ],
        "processing_time_ms": round(elapsed_ms, 2),
    }
