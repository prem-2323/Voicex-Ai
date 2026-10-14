from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_models_returns_all_components():
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    for component in ("stt", "llm", "tts", "vad"):
        assert component in data
        assert "name" in data[component]
        assert "status" in data[component]


def test_models_stt_reports_ready_when_model_loads():
    # Faster-Whisper base is cached locally, so the load check is fast.
    data = client.get("/api/models").json()
    assert data["stt"]["status"] == "ready"
    assert data["stt"]["model"] == "base"


def test_models_llm_reports_ready_when_tag_installed():
    # Requires Ollama running with the configured OLLAMA_MODEL pulled.
    data = client.get("/api/models").json()
    assert data["llm"]["status"] == "ready"
    assert data["llm"]["name"] == "qwen2.5:3b"


def test_models_tts_reports_ready_when_package_installed():
    data = client.get("/api/models").json()
    assert data["tts"]["status"] == "ready"
    assert data["tts"]["name"] == "Edge-TTS"
    assert "en-US-AriaNeural" in data["tts"]["voices"]


def test_models_pending_integrations_stay_placeholder():
    data = client.get("/api/models").json()
    assert data["vad"]["status"] == "not_integrated"
