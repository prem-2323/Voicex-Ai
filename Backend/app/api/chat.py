import logging

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.conversation import get_combined_history, save_turn
from app.services.llm import generate_response

router = APIRouter(tags=["Local LLM"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    client_history = [item.model_dump() for item in request.history]
    combined = get_combined_history(request.session_id, client_history)
    try:
        result = await generate_response(
            message=request.message,
            history=combined,
        )
        stored: list[dict] = combined
        if request.session_id:
            stored = save_turn(
                request.session_id,
                request.message.strip(),
                result["text"],
                combined,
            )
        return ChatResponse(
            success=True,
            response=result["text"],
            model=result["model"],
            processing_time_ms=result["processing_time_ms"],
            done=result["done"],
            session_id=request.session_id,
            history_length=len(stored) if request.session_id else len(combined),
        )
    except RuntimeError as exc:
        error_message = str(exc)
        lowered = error_message.lower()
        if "timed out" in lowered:
            raise HTTPException(status_code=504, detail=error_message)
        if "empty response" in lowered:
            raise HTTPException(status_code=502, detail=error_message)
        if (
            "cannot connect" in lowered
            or "cannot reach" in lowered
        ):
            raise HTTPException(status_code=503, detail=error_message)
        if (
            "not found" in lowered
            or "ollama returned" in lowered
        ):
            raise HTTPException(status_code=502, detail=error_message)
        raise HTTPException(status_code=500, detail=error_message)
