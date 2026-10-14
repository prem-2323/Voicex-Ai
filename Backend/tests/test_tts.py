from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_tts_rejects_unsupported_voice():
    response = client.post(
        "/api/tts",
        json={"text": "Hello", "voice": "not-a-voice"},
    )
    assert response.status_code == 400


def test_tts_rejects_blank_text():
    response = client.post(
        "/api/tts",
        json={"text": "   ", "voice": "en-US-AriaNeural"},
    )
    assert response.status_code == 422


def test_tts_lists_voices():
    response = client.get("/api/tts/voices")
    assert response.status_code == 200
    data = response.json()
    assert "en-US-AriaNeural" in data["voices"]
    assert data["default"] == "en-US-AriaNeural"


def test_tts_success_with_mocked_service(monkeypatch, tmp_path):
    fake_mp3 = tmp_path / "fake.mp3"
    fake_mp3.write_bytes(b"ID3" + b"\x00" * 100)

    async def fake_synthesize(text: str, voice: str):
        assert text == "Hello! Welcome to Voice X AI."
        assert voice == "en-US-AriaNeural"
        return fake_mp3

    monkeypatch.setattr("app.api.tts.synthesize_to_file", fake_synthesize)
    response = client.post(
        "/api/tts",
        json={
            "text": "Hello! Welcome to Voice X AI.",
            "voice": "en-US-AriaNeural",
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 0


def test_tts_failure_returns_502(monkeypatch):
    async def fake_fail(text: str, voice: str):
        raise RuntimeError(
            "Unable to generate speech audio. Check the TTS service "
            "and internet connection. (ClientError)"
        )

    monkeypatch.setattr("app.api.tts.synthesize_to_file", fake_fail)
    response = client.post(
        "/api/tts",
        json={"text": "Hello", "voice": "en-US-AriaNeural"},
    )
    assert response.status_code == 502
    assert "speech audio" in response.json()["detail"].lower()


def test_tts_real_edge_tts():
    """End-to-end check against the live Edge-TTS service.

    Skipped automatically when there is no internet access.
    """
    response = client.post(
        "/api/tts",
        json={
            "text": "Hello! Welcome to Voice X AI.",
            "voice": "en-US-AriaNeural",
        },
    )
    if response.status_code == 502:
        pytest.skip("Edge-TTS unreachable (no internet?)")
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 1000
    out = Path("test_tts_output.mp3")
    out.write_bytes(response.content)
