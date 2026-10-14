from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "success": True,
        "service": "VoiceX AI Backend",
        "status": "running",
    }
