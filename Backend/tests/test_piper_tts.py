"""Automated tests for Phase 7: Local Piper TTS Integration."""

import os
import time
import wave
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.piper_tts import (
    PIPER_ALLOWED_VOICES,
    get_model_file_paths,
    get_piper_models_dir,
    is_model_available,
    is_piper_installed,
    resolve_piper_voice,
    synthesize_piper_to_file,
)
from app.services.tts import (
    ALLOWED_VOICES,
    purge_stale_files,
    resolve_voice,
    synthesize_to_file,
)

client = TestClient(app)


def test_piper_service_initialization():
    """Verify that piper package is installed and models directory is configured."""
    assert is_piper_installed() is True
    models_dir = get_piper_models_dir()
    assert isinstance(models_dir, Path)


def test_piper_voice_resolution_hindi():
    """Verify Hindi voice resolution for Devanagari text, aliases, and explicit Hindi codes."""
    # Devanagari text triggers Hindi model
    voice = resolve_piper_voice(text="नमस्ते, आप कैसे हैं?")
    assert voice == "hi_IN-pratham-medium"

    # Hindi language code triggers Hindi model
    assert resolve_piper_voice(voice="hi") == "hi_IN-pratham-medium"
    assert resolve_piper_voice(voice="hindi") == "hi_IN-pratham-medium"

    # Legacy voice alias triggers Hindi model
    assert resolve_piper_voice(voice="voice-priya") == "hi_IN-pratham-medium"
    assert resolve_piper_voice(voice="hi-IN-SwaraNeural") == "hi_IN-pratham-medium"


def test_piper_voice_resolution_english():
    """Verify English voice resolution for Latin text and aliases."""
    voice = resolve_piper_voice(text="Hello world")
    assert voice == "en_US-lessac-medium"

    assert resolve_piper_voice(voice="en") == "en_US-lessac-medium"
    assert resolve_piper_voice(voice="voice-aura") == "en_US-lessac-medium"
    assert resolve_piper_voice(voice="en-US-AriaNeural") == "en_US-lessac-medium"


def test_piper_missing_model_files(tmp_path, monkeypatch):
    """Verify that attempting to load a missing model raises FileNotFoundError."""
    from app.services import piper_tts

    monkeypatch.setattr(piper_tts, "get_piper_models_dir", lambda: tmp_path / "empty")
    with pytest.raises(FileNotFoundError, match="not found"):
        piper_tts.get_piper_voice("missing_model")


def test_piper_rejects_blank_text():
    """Verify that blank or whitespace-only text raises ValueError."""
    with pytest.raises(ValueError, match="blank"):
        synthesize_piper_to_file("   ")


def test_piper_local_audio_generation_mocked(tmp_path, monkeypatch):
    """Verify Piper audio generation with a mocked PiperVoice."""
    from app.services import piper_tts

    mock_voice = MagicMock()

    def fake_synthesize_wav(text, wav_file):
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(22050)
        wav_file.writeframes(b"\x00\x00" * 2205)

    mock_voice.synthesize_wav = fake_synthesize_wav

    monkeypatch.setattr(piper_tts, "get_piper_voice", lambda model: mock_voice)
    monkeypatch.setattr(piper_tts, "get_audio_dir", lambda: tmp_path)

    out_file = synthesize_piper_to_file("Hello from mocked Piper", voice="en_US-lessac-medium")
    assert out_file.exists()
    assert out_file.suffix == ".wav"
    assert out_file.stat().st_size > 0

    with wave.open(str(out_file), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getframerate() == 22050


def test_piper_api_audio_response_compatibility(tmp_path, monkeypatch):
    """Verify /api/tts endpoint returns correct audio/wav headers when Piper is active."""
    fake_wav = tmp_path / "test.wav"
    with wave.open(str(fake_wav), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(22050)
        wf.writeframes(b"\x00\x00" * 1000)

    async def fake_synthesize(text: str, voice: str):
        return fake_wav

    monkeypatch.setattr("app.api.tts.synthesize_to_file", fake_synthesize)

    response = client.post(
        "/api/tts",
        json={"text": "Testing API compatibility", "voice": "en_US-lessac-medium"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert "voice_response.wav" in response.headers["content-disposition"]
    assert len(response.content) > 0


def test_piper_edge_tts_fallback_when_piper_fails(tmp_path, monkeypatch):
    """Verify fallback to Edge-TTS when Piper fails and fallback is enabled."""
    from app.core.config import get_settings
    settings = get_settings()

    fake_mp3 = tmp_path / "fallback.mp3"
    fake_mp3.write_bytes(b"ID3" + b"\x00" * 50)

    # Force piper provider with edge fallback
    monkeypatch.setattr(settings, "tts_provider", "piper")
    monkeypatch.setattr(settings, "tts_fallback_provider", "edge")

    # Simulate Piper failure
    def failing_piper(text, voice):
        raise RuntimeError("Piper engine crash")

    async def fake_edge(text, voice):
        return fake_mp3

    monkeypatch.setattr("app.services.tts.synthesize_piper_to_file", failing_piper)
    monkeypatch.setattr("app.services.tts.synthesize_edge_to_file", fake_edge)

    import asyncio
    result_path = asyncio.run(synthesize_to_file("Hello", "en-US-AriaNeural"))
    assert result_path == fake_mp3
    assert result_path.suffix == ".mp3"


def test_temporary_file_cleanup_wav_and_mp3(tmp_path, monkeypatch):
    """Verify purge_stale_files deletes both .mp3 and .wav files older than the retention threshold."""
    from app.services import tts

    monkeypatch.setattr(tts, "get_audio_dir", lambda: tmp_path)

    old_mp3 = tmp_path / "old.mp3"
    old_mp3.write_bytes(b"old-mp3")
    old_wav = tmp_path / "old.wav"
    old_wav.write_bytes(b"old-wav")
    fresh_wav = tmp_path / "fresh.wav"
    fresh_wav.write_bytes(b"fresh-wav")

    # Set file modification times: 100 seconds ago for old files
    now = time.time()
    os.utime(old_mp3, (now - 100, now - 100))
    os.utime(old_wav, (now - 100, now - 100))
    os.utime(fresh_wav, (now, now))

    removed = purge_stale_files(max_age_seconds=60)
    assert removed == 2
    assert not old_mp3.exists()
    assert not old_wav.exists()
    assert fresh_wav.exists()


@pytest.mark.real
def test_real_piper_generation():
    """Verify real local CPU generation with actual downloaded Piper models."""
    if not (is_model_available("hi_IN-pratham-medium") and is_model_available("en_US-lessac-medium")):
        pytest.skip("Piper models not present locally")

    # Real Hindi synthesis
    t0 = time.perf_counter()
    hi_file = synthesize_piper_to_file("नमस्ते, आपका स्वागत है।", voice="hi_IN-pratham-medium")
    hi_elapsed = time.perf_counter() - t0
    assert hi_file.exists()
    assert hi_file.stat().st_size > 1000

    with wave.open(str(hi_file), "rb") as wf:
        hi_dur = wf.getnframes() / wf.getframerate()
        assert hi_dur > 0.5
    hi_file.unlink(missing_ok=True)

    # Real English synthesis
    t1 = time.perf_counter()
    en_file = synthesize_piper_to_file("Welcome to VoiceX AI assistant.", voice="en_US-lessac-medium")
    en_elapsed = time.perf_counter() - t1
    assert en_file.exists()
    assert en_file.stat().st_size > 1000

    with wave.open(str(en_file), "rb") as wf:
        en_dur = wf.getnframes() / wf.getframerate()
        assert en_dur > 0.5
    en_file.unlink(missing_ok=True)
