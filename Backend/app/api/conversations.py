import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.conversation import (
    clear_all_sessions,
    clear_session,
    create_session,
    get_history,
    list_sessions,
    rename_session,
)

router = APIRouter(prefix="/conversations", tags=["Conversations"])
logger = logging.getLogger(__name__)


class CreateSessionRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    title: Optional[str] = Field(default=None, max_length=200)


class RenameSessionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@router.get("")
async def get_conversations():
    """Return all active conversations/sessions."""
    return {"conversations": list_sessions()}


@router.post("")
async def create_new_conversation(request: CreateSessionRequest):
    """Create or initialize a conversation session."""
    session = create_session(request.session_id, request.title)
    return {"success": True, "conversation": session}


@router.get("/{session_id}")
async def get_conversation(session_id: str):
    """Get message history for a specific conversation session."""
    history = get_history(session_id)
    return {"session_id": session_id, "messages": history}


@router.patch("/{session_id}")
async def rename_conversation(session_id: str, request: RenameSessionRequest):
    """Rename a conversation title."""
    ok = rename_session(session_id, request.title)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation session not found")
    return {"success": True, "session_id": session_id, "title": request.title}


@router.delete("/{session_id}")
async def delete_conversation(session_id: str):
    """Delete a conversation session."""
    clear_session(session_id)
    return {"success": True, "deleted_session_id": session_id}


@router.delete("")
async def delete_all_conversations():
    """Clear all conversation history."""
    clear_all_sessions()
    return {"success": True, "cleared_all": True}
