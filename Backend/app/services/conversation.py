"""In-memory per-session conversation store.

Phase 3 requires history to persist per ``session_id`` on the backend
instead of blindly trusting whatever the frontend sends each time.
This module is intentionally small: a thread-safe dict with trimming.
"""

import threading
import time

MAX_SESSION_MESSAGES = 20
MAX_SESSIONS = 1000

_lock = threading.Lock()
_sessions: dict[str, list[dict]] = {}
_session_metadata: dict[str, dict] = {}


def list_sessions() -> list[dict]:
    """Return summary of all active sessions sorted by last updated."""
    with _lock:
        results = []
        for sid, messages in _sessions.items():
            meta = _session_metadata.get(sid, {})
            title = meta.get("title")
            if not title:
                first_msg = next((m for m in messages if m.get("role") == "user"), None)
                title = (first_msg["content"][:32] + "...") if first_msg else f"Session {sid[:8]}"
            results.append({
                "id": sid,
                "title": title,
                "message_count": len(messages),
                "created_at": meta.get("created_at", int(time.time() * 1000)),
                "updated_at": meta.get("updated_at", int(time.time() * 1000)),
                "primary_language": meta.get("primary_language", "en"),
                "messages": [dict(m) for m in messages],
            })
        results.sort(key=lambda x: x["updated_at"], reverse=True)
        return results


def get_history(session_id: str) -> list[dict]:
    """Return a copy of the stored history for a session."""
    with _lock:
        return [dict(m) for m in _sessions.get(session_id, [])]


def get_combined_history(
    session_id: str | None, client_history: list[dict]
) -> list[dict]:
    """Return the history for the next LLM turn without duplicates.

    The server store is the source of truth once a session has messages.
    Client history is only used to seed a new/empty session (for example
    after a backend restart). Concatenating both on every turn duplicates
    earlier messages and quickly confuses small local models.
    """
    if not session_id:
        return [dict(m) for m in client_history[-MAX_SESSION_MESSAGES:]]
    with _lock:
        stored = _sessions.get(session_id) or []
        source = stored if stored else client_history
        return [dict(m) for m in source[-MAX_SESSION_MESSAGES:]]


def save_turn(
    session_id: str | None,
    user_message: str,
    assistant_message: str,
    base_history: list[dict],
) -> list[dict]:
    """Append the completed turn to the session store (trimmed)."""
    if not session_id:
        return list(base_history)
    updated = [
        *base_history,
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": assistant_message},
    ][-MAX_SESSION_MESSAGES:]
    now_ms = int(time.time() * 1000)
    with _lock:
        if len(_sessions) >= MAX_SESSIONS and session_id not in _sessions:
            oldest = next(iter(_sessions))
            _sessions.pop(oldest, None)
            _session_metadata.pop(oldest, None)

        _sessions[session_id] = [dict(m) for m in updated]
        meta = _session_metadata.setdefault(session_id, {
            "created_at": now_ms,
            "title": user_message[:36] + ("..." if len(user_message) > 36 else ""),
            "primary_language": "hi" if any("\u0900" <= ch <= "\u097F" for ch in user_message) else "en",
        })
        meta["updated_at"] = now_ms
        return [dict(m) for m in updated]


def create_session(session_id: str, title: str | None = None) -> dict:
    now_ms = int(time.time() * 1000)
    with _lock:
        _sessions.setdefault(session_id, [])
        meta = _session_metadata.setdefault(session_id, {
            "created_at": now_ms,
            "updated_at": now_ms,
            "title": title or f"Session {session_id[:8]}",
            "primary_language": "en",
        })
        if title:
            meta["title"] = title
        return {
            "id": session_id,
            "title": meta["title"],
            "messages": [],
            "created_at": meta["created_at"],
            "updated_at": meta["updated_at"],
            "primary_language": meta["primary_language"],
        }


def rename_session(session_id: str, new_title: str) -> bool:
    with _lock:
        if session_id in _sessions or session_id in _session_metadata:
            meta = _session_metadata.setdefault(session_id, {
                "created_at": int(time.time() * 1000),
                "primary_language": "en",
            })
            meta["title"] = new_title
            meta["updated_at"] = int(time.time() * 1000)
            return True
        return False


def clear_session(session_id: str) -> None:
    with _lock:
        _sessions.pop(session_id, None)
        _session_metadata.pop(session_id, None)


def clear_all_sessions() -> None:
    with _lock:
        _sessions.clear()
        _session_metadata.clear()

