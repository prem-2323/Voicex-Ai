from fastapi.testclient import TestClient
from app.main import app
from app.services.llm import build_system_prompt, HINDI_PROMPT_DIRECTIVE
from app.services.tts import resolve_voice, ALLOWED_VOICES

client = TestClient(app)


def test_hindi_system_prompt_generation():
    """Requirement 3: Qwen receives a Hindi system prompt for Hindi language."""
    # When explicit language="hi" or "hindi" is passed
    prompt_hi = build_system_prompt(language="hi", message="hello")
    assert HINDI_PROMPT_DIRECTIVE in prompt_hi
    assert "Devanagari script" in prompt_hi

    prompt_hindi = build_system_prompt(language="hindi", message="hello")
    assert HINDI_PROMPT_DIRECTIVE in prompt_hindi

    # Auto-detection when Devanagari script is present
    prompt_devanagari = build_system_prompt(language="auto", message="नमस्ते")
    assert HINDI_PROMPT_DIRECTIVE in prompt_devanagari


def test_fastapi_chat_forwards_hindi_language(monkeypatch):
    """Requirement 2: FastAPI receives and forwards language='hi'."""
    captured_args = {}

    async def fake_generate(message, history=None, language=None):
        captured_args["message"] = message
        captured_args["language"] = language
        return {
            "text": "नमस्ते! मैं आपकी क्या सहायता कर सकता हूँ?",
            "model": "qwen2.5:3b",
            "processing_time_ms": 15.0,
            "done": True,
        }

    monkeypatch.setattr("app.api.chat.generate_response", fake_generate)

    response = client.post(
        "/api/chat",
        json={"message": "नमस्ते", "history": [], "language": "hi"},
    )
    assert response.status_code == 200
    assert captured_args.get("language") == "hi"
    data = response.json()
    assert data["success"] is True
    assert "नमस्ते" in data["response"]


def test_fastapi_transcribe_forwards_hindi_language(monkeypatch):
    """Requirement 4: FastAPI transcribe endpoint accepts and passes language='hi'."""
    captured_args = {}

    def fake_transcribe(audio_path, language=None):
        captured_args["language"] = language
        return {
            "text": "नमस्ते, यह एक परीक्षण है।",
            "language": "hi",
            "language_probability": 0.99,
            "duration_seconds": 2.0,
            "segments": [{"start": 0.0, "end": 2.0, "text": "नमस्ते"}],
            "processing_time_ms": 150.0,
        }

    monkeypatch.setattr("app.api.transcribe.transcribe_audio", fake_transcribe)

    response = client.post(
        "/api/transcribe",
        files={"file": ("test.wav", b"RIFFfakebytes", "audio/wav")},
        data={"language": "hi"},
    )
    assert response.status_code == 200
    assert captured_args.get("language") == "hi"
    data = response.json()
    assert data["text"] == "नमस्ते, यह एक परीक्षण है।"
    assert data["language"] == "hi"


def test_tts_resolves_hindi_voice():
    """Requirement 5: TTS automatically chooses a Hindi neural voice for Hindi Devanagari text."""
    # When text is in Hindi Devanagari, voice must resolve to a valid Hindi voice
    voice = resolve_voice("en-US-AriaNeural", text="नमस्ते, आप कैसे हैं?")
    assert voice in ("hi-IN-SwaraNeural", "hi-IN-MadhurNeural")
    assert voice in ALLOWED_VOICES
