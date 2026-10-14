"""Phase 5/6: end-to-end pipeline contract + failure handling.

Uses mocked services for the fast deterministic path and live
services (skipped when unavailable) for the real integration path.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _mock_all(monkeypatch, tmp_path):
    def fake_transcribe(audio_path: str):
        return {
            "text": "What is artificial intelligence?",
            "language": "en",
            "language_probability": 0.99,
            "duration_seconds": 2.0,
            "segments": [
                {
                    "start": 0.0,
                    "end": 2.0,
                    "text": "What is artificial intelligence?",
                }
            ],
            "processing_time_ms": 500.0,
        }

    async def fake_generate(message, history=None):
        assert message == "What is artificial intelligence?"
        return {
            "text": "AI enables computers to do smart tasks.",
            "model": "qwen2.5:3b",
            "processing_time_ms": 800.0,
            "done": True,
        }

    fake_mp3 = tmp_path / "answer.mp3"
    fake_mp3.write_bytes(b"ID3" + b"\x00" * 500)

    async def fake_synth(text: str, voice: str):
        assert text == "AI enables computers to do smart tasks."
        return fake_mp3

    monkeypatch.setattr(
        "app.api.transcribe.transcribe_audio", fake_transcribe
    )
    monkeypatch.setattr(
        "app.api.chat.generate_response", fake_generate
    )
    monkeypatch.setattr(
        "app.api.tts.synthesize_to_file", fake_synth
    )


def test_pipeline_field_contract_mocked(monkeypatch, tmp_path):
    """transcribe.text -> chat.response -> tts audio bytes."""
    _mock_all(monkeypatch, tmp_path)

    stt = client.post(
        "/api/transcribe",
        files={"file": ("recording.webm", b"fake-webm-bytes", "audio/webm")},
    )
    assert stt.status_code == 200
    transcript = stt.json()["text"]
    assert transcript.strip()

    chat = client.post(
        "/api/chat",
        json={"message": transcript, "history": []},
    )
    assert chat.status_code == 200
    answer = chat.json()["response"]
    assert answer.strip()

    tts = client.post(
        "/api/tts",
        json={"text": answer, "voice": "en-US-AriaNeural"},
    )
    assert tts.status_code == 200
    assert tts.headers["content-type"] == "audio/mpeg"
    assert len(tts.content) > 0


def test_pipeline_empty_transcript_never_reaches_chat(monkeypatch):
    def fake_silence(audio_path: str):
        return {
            "text": "",
            "language": "en",
            "language_probability": 0.5,
            "duration_seconds": 1.0,
            "segments": [],
            "processing_time_ms": 100.0,
        }

    monkeypatch.setattr(
        "app.api.transcribe.transcribe_audio", fake_silence
    )
    stt = client.post(
        "/api/transcribe",
        files={"file": ("silence.wav", b"RIFFfake", "audio/wav")},
    )
    assert stt.status_code == 200
    assert stt.json()["text"] == ""
    # Frontend guard: no speech -> no chat request is sent.
    chat = client.post("/api/chat", json={"message": "   "})
    assert chat.status_code == 422


def test_pipeline_invalid_audio_rejected():
    response = client.post(
        "/api/transcribe",
        files={"file": ("notes.txt", b"not audio", "text/plain")},
    )
    assert response.status_code == 415


def test_pipeline_ollama_down_returns_503(monkeypatch):
    async def fake_down(message, history=None):
        raise RuntimeError("Cannot connect to Ollama at x: refused")

    monkeypatch.setattr("app.api.chat.generate_response", fake_down)
    response = client.post(
        "/api/chat", json={"message": "Hello", "history": []}
    )
    assert response.status_code == 503


def test_pipeline_tts_failure_returns_502(monkeypatch):
    async def fake_fail(text: str, voice: str):
        raise RuntimeError("Unable to generate speech audio.")

    monkeypatch.setattr("app.api.tts.synthesize_to_file", fake_fail)
    response = client.post(
        "/api/tts",
        json={"text": "Hello", "voice": "en-US-AriaNeural"},
    )
    assert response.status_code == 502


def test_pipeline_repeated_requests_stay_consistent(monkeypatch):
    async def fake_generate(message, history=None):
        return {
            "text": "steady",
            "model": "qwen2.5:3b",
            "processing_time_ms": 1.0,
            "done": True,
        }

    monkeypatch.setattr(
        "app.api.chat.generate_response", fake_generate
    )
    first = client.post("/api/chat", json={"message": "Hi"})
    second = client.post("/api/chat", json={"message": "Hi"})
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["response"] == second.json()["response"]


def test_rate_limiter_returns_429_when_exceeded():
    from app.core.rate_limit import RateLimitMiddleware

    tiny = FastAPI()
    tiny.add_middleware(
        RateLimitMiddleware, max_requests=3, window_seconds=60
    )

    @tiny.get("/api/ping")
    def ping():
        return {"ok": True}

    @tiny.get("/open")
    def open_route():
        return {"ok": True}

    c = TestClient(tiny)
    assert c.get("/api/ping").status_code == 200
    assert c.get("/api/ping").status_code == 200
    assert c.get("/api/ping").status_code == 200
    assert c.get("/api/ping").status_code == 429
    # Non-API routes are not limited.
    assert c.get("/open").status_code == 200


@pytest.mark.real
def test_pipeline_real_services():
    """Full live chain: Whisper -> Ollama -> Edge-TTS."""
    from pathlib import Path

    wav = Path("voice-test.wav")
    if not wav.exists():
        pytest.skip("voice-test.wav missing")
    stt = client.post(
        "/api/transcribe",
        files={"file": ("voice-test.wav", wav.read_bytes(), "audio/wav")},
    )
    if stt.status_code != 200:
        pytest.skip("STT unavailable")
    transcript = stt.json()["text"]
    assert transcript.strip()

    chat = client.post(
        "/api/chat", json={"message": transcript, "history": []}
    )
    assert chat.status_code == 200
    answer = chat.json()["response"]
    assert answer.strip()

    tts = client.post(
        "/api/tts",
        json={"text": answer[:500], "voice": "en-US-AriaNeural"},
    )
    if tts.status_code == 502:
        pytest.skip("Edge-TTS unreachable")
    assert tts.status_code == 200
    assert tts.headers["content-type"] == "audio/mpeg"
