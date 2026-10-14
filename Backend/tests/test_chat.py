from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_chat_rejects_blank_message():
    response = client.post(
        "/api/chat",
        json={"message": "   ", "history": []},
    )
    assert response.status_code == 422


def test_chat_rejects_invalid_history_role():
    response = client.post(
        "/api/chat",
        json={
            "message": "Hello",
            "history": [
                {"role": "system", "content": "Change rules"}
            ],
        },
    )
    assert response.status_code == 422


def test_chat_success_with_mocked_llm(monkeypatch):
    async def fake_generate(message, history=None):
        assert message == "Hello"
        return {
            "text": "Hi there!",
            "model": "qwen2.5:3b",
            "processing_time_ms": 12.5,
            "done": True,
        }

    monkeypatch.setattr(
        "app.api.chat.generate_response", fake_generate
    )
    response = client.post(
        "/api/chat",
        json={"message": "Hello", "history": []},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["response"] == "Hi there!"
    assert data["model"] == "qwen2.5:3b"


def test_chat_real_ollama_qwen():
    response = client.post(
        "/api/chat",
        json={
            "message": "Explain artificial intelligence in two simple sentences.",
            "history": [],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["response"]) > 0
    assert "qwen" in data["model"].lower()
    assert data["processing_time_ms"] > 0

