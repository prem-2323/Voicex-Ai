import logging
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
    kwargs = {"beam_size": 5}
    if language:
        kwargs["language"] = language
    with _model_lock:
        segments_iter, info = model.transcribe(audio_path, **kwargs)
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
