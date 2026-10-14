from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_conversations_crud_lifecycle():
    # 1. Create a session
    sess_id = "test-session-crud-1"
    res = client.post(
        "/api/conversations",
        json={"session_id": sess_id, "title": "My Awesome Conversation"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["conversation"]["id"] == sess_id
    assert data["conversation"]["title"] == "My Awesome Conversation"

    # 2. Get list of sessions
    res = client.get("/api/conversations")
    assert res.status_code == 200
    sessions = res.json().get("conversations", [])
    found = next((s for s in sessions if s["id"] == sess_id), None)
    assert found is not None
    assert found["title"] == "My Awesome Conversation"

    # 3. Rename session
    res = client.patch(
        f"/api/conversations/{sess_id}",
        json={"title": "Updated Title"},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Updated Title"

    # 4. Get specific session
    res = client.get(f"/api/conversations/{sess_id}")
    assert res.status_code == 200
    assert "messages" in res.json()

    # 5. Delete session
    res = client.delete(f"/api/conversations/{sess_id}")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_performance_telemetry():
    res = client.get("/api/performance/telemetry")
    assert res.status_code == 200
    data = res.json()
    assert "compute" in data
    assert "device" in data["compute"]
    assert "ram_total_gb" in data["compute"]
    assert "models" in data
