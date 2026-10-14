from fastapi import APIRouter

from app.services.telemetry import get_compute_telemetry

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "success": True,
        "service": "VoiceX AI Backend",
        "status": "running",
        "compute": get_compute_telemetry(),
    }

