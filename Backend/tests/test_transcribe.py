from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_transcribe_rejects_unsupported_extension():
    response = client.post(
        "/api/transcribe",
        files={"file": ("evil.txt", b"not audio", "text/plain")},
    )
    assert response.status_code == 415


def test_transcribe_rejects_empty_file():
    response = client.post(
        "/api/transcribe",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 400


def test_transcribe_requires_file():
    response = client.post("/api/transcribe", files={})
    assert response.status_code == 422


def test_transcribe_success_with_mocked_service(monkeypatch):
    def fake_transcribe(audio_path: str):
        assert audio_path.endswith(".wav")
        return {
            "text": "Hello, how are you?",
            "language": "en",
            "language_probability": 0.98,
            "duration_seconds": 2.4,
            "segments": [
                {"start": 0.0, "end": 1.8, "text": "Hello, how are you?"}
            ],
            "processing_time_ms": 1200.0,
        }

    monkeypatch.setattr(
        "app.api.transcribe.transcribe_audio", fake_transcribe
    )
    response = client.post(
        "/api/transcribe",
        files={"file": ("hello.wav", b"RIFFfake-wav-bytes", "audio/wav")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["transcription"]["text"] == "Hello, how are you?"
    assert data["transcription"]["language"] == "en"


def test_transcribe_real_audio_file():
    from pathlib import Path

    wav_path = Path("voice-test.wav")
    if not wav_path.exists():
        return
    with open(wav_path, "rb") as f:
        audio_bytes = f.read()
    response = client.post(
        "/api/transcribe",
        files={"file": ("voice-test.wav", audio_bytes, "audio/wav")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["transcription"]["text"]) > 0
    assert data["transcription"]["language"] == "en"
    assert data["transcription"]["processing_time_ms"] > 0


def test_transcribe_rejects_corrupted_audio():
    corrupted_bytes = b"RIFF\x00\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00corrupted_payload_data"
    response = client.post(
        "/api/transcribe",
        files={"file": ("corrupt.wav", corrupted_bytes, "audio/wav")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "Invalid or corrupted audio file" in data.get("detail", "")

