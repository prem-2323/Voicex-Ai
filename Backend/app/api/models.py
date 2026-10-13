from fastapi import APIRouter

router = APIRouter(tags=["Models"])


@router.get("/models")
async def get_model_status():
    return {
        "stt": {
            "name": "Faster-Whisper",
            "status": "not_integrated",
        },
        "llm": {
            "name": "Qwen3 via Ollama",
            "status": "not_integrated",
        },
        "tts": {
            "name": "Piper or Kokoro",
            "status": "not_integrated",
        },
        "vad": {
            "name": "Silero VAD",
            "status": "not_integrated",
        },
    }
