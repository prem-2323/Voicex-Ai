from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "Welcome to VoiceX AI"


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert data["status"] in ("ok", "running")
    assert data["service"] == "VoiceX AI Backend"


def test_models_endpoint():
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "stt" in data
    assert "llm" in data
    assert "tts" in data
    assert "vad" in data
