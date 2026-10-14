import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, health, models, transcribe, tts
from app.core.config import get_settings
from app.core.rate_limit import RateLimitMiddleware

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("voicex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("%s starting", settings.app_name)
    yield
    logger.info("%s shutting down", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Backend foundation for a local, multilingual "
        "real-time voice AI assistant."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)

# Phase 1 canonical routes (used by tests and Step 10 frontend snippet)
app.include_router(health.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(transcribe.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(tts.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Welcome to VoiceX AI"}


# Compatibility shims for the existing React frontend (voiceClient.ts):
# it calls GET {base}/health and WS {base}/ws/voice (no /api prefix).
@app.get("/health", include_in_schema=False)
async def health_compat():
    data = health.health_check()
    if hasattr(data, "__await__"):
        data = await data
    try:
        import edge_tts  # noqa: F401

        tts_ready = True
    except ImportError:
        tts_ready = False
    return {
        **data,
        "version": settings.app_version,
        "models": {"whisper": True, "llm": True, "tts": tts_ready},
        "compute": None,
    }


@app.get("/models", include_in_schema=False)
async def models_compat():
    return await models.get_model_status()


@app.websocket("/ws/voice")
async def websocket_voice_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Voice WebSocket client connected (Phase 1 placeholder)")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                import json

                payload = json.loads(data)
            except Exception:
                payload = {}
            action = payload.get("action")
            if action == "audio_stream":
                # Phase 1: no STT/LLM/TTS yet; acknowledge honestly.
                await websocket.send_json(
                    {
                        "type": "transcript",
                        "text": "Backend Phase 1: STT not integrated yet.",
                        "language": "English",
                        "is_final": True,
                    }
                )
            elif action == "cancel":
                logger.info("Voice WebSocket cancel received")
    except WebSocketDisconnect:
        logger.info("Voice WebSocket client disconnected")
