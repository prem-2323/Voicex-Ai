import logging
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.services.stt import transcribe_audio

router = APIRouter(tags=["Speech-to-Text"])
logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"
}


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio extension.",
        )

    temp_path = None
    try:
        # Read at most the allowed size plus one byte so oversize
        # uploads are detected without buffering unbounded data.
        contents = await file.read(MAX_AUDIO_BYTES + 1)
        if len(contents) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Audio file too large (max 20 MB).",
            )
        if len(contents) == 0:
            raise HTTPException(
                status_code=400,
                detail="Empty audio file.",
            )

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=extension or ".wav"
        ) as tmp:
            tmp.write(contents)
            temp_path = tmp.name

        result = await run_in_threadpool(transcribe_audio, temp_path)
        return {
            "success": True,
            "text": result["text"],
            "language": result["language"],
            "language_probability": result.get("language_probability"),
            "duration_seconds": result.get("duration_seconds"),
            "processing_time_ms": result.get("processing_time_ms"),
            "segments": result.get("segments", []),
            "transcription": result,
        }
    except HTTPException:
        raise
    except RuntimeError as exc:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("Transcription failed")
        raise HTTPException(
            status_code=500, detail=f"Transcription failed: {exc}"
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
