"""In-memory per-session conversation store.

Phase 3 requires history to persist per ``session_id`` on the backend
instead of blindly trusting whatever the frontend sends each time.
This module is intentionally small: a thread-safe dict with trimming.
"""

import threading

MAX_SESSION_MESSAGES = 20
MAX_SESSIONS = 1000

_lock = threading.Lock()
_sessions: dict[str, list[dict]] = {}


def get_history(session_id: str) -> list[dict]:
    """Return a copy of the stored history for a session."""
    with _lock:
        return [dict(m) for m in _sessions.get(session_id, [])]


def get_combined_history(
    session_id: str | None, client_history: list[dict]
) -> list[dict]:
    """Merge server-stored history with client-sent history.

    Server store is the source of truth; client history seeds new
    sessions or fills gaps. Result is trimmed to the last N messages.
    """
    if not session_id:
        return list(client_history)[-MAX_SESSION_MESSAGES:]
    with _lock:
        stored = _sessions.get(session_id, [])
        combined = [*stored, *client_history]
        return [dict(m) for m in combined[-MAX_SESSION_MESSAGES:]]


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
    with _lock:
        if len(_sessions) >= MAX_SESSIONS and session_id not in _sessions:
            # Evict oldest session to bound memory.
            oldest = next(iter(_sessions))
            del _sessions[oldest]
        _sessions[session_id] = [dict(m) for m in updated]
        return [dict(m) for m in updated]


def clear_session(session_id: str) -> None:
    with _lock:
        _sessions.pop(session_id, None)
