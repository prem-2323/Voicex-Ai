import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from starlette.background import BackgroundTask

from app.services.tts import (
    ALLOWED_VOICES,
    DEFAULT_VOICE,
    MAX_TEXT_LENGTH,
    delete_file_quietly,
    purge_stale_files,
    resolve_voice,
    synthesize_to_file,
)

router = APIRouter(tags=["Text-to-Speech"])
logger = logging.getLogger(__name__)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    voice: str = DEFAULT_VOICE

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text cannot be blank")
        return value.strip()


@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    voice = resolve_voice(request.voice)
    if voice not in ALLOWED_VOICES:
        raise HTTPException(status_code=400, detail="Unsupported voice")
    try:
        purge_stale_files()
        filepath = await synthesize_to_file(request.text, voice)
        return FileResponse(
            path=str(filepath),
            media_type="audio/mpeg",
            filename="voice_response.mp3",
            background=BackgroundTask(delete_file_quietly, str(filepath)),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.exception("TTS request failed")
        raise HTTPException(
            status_code=502,
            detail="Unable to generate speech audio. Check the TTS "
            "service and internet connection.",
        ) from exc


@router.get("/tts/voices")
async def list_voices():
    return {"voices": sorted(ALLOWED_VOICES), "default": DEFAULT_VOICE}
