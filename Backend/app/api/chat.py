import logging

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm import generate_response

router = APIRouter(tags=["Local LLM"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        result = await generate_response(
            message=request.message,
            history=[
                item.model_dump()
                for item in request.history
            ],
        )
        return ChatResponse(
            success=True,
            response=result["text"],
            model=result["model"],
            processing_time_ms=result["processing_time_ms"],
            done=result["done"],
        )
    except RuntimeError as exc:
        error_message = str(exc)
        if "timed out" in error_message.lower():
            raise HTTPException(status_code=504, detail=error_message)
        if (
            "cannot reach" in error_message.lower()
            or "not found" in error_message.lower()
        ):
            raise HTTPException(status_code=502, detail=error_message)
        raise HTTPException(status_code=500, detail=error_message)
