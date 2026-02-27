"""Health check endpoint."""

from fastapi import APIRouter
from app.config import settings
from app.models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        adapter_mode=settings.ADAPTER_MODE,
        version="1.0.0",
        circle_configured=bool(settings.CIRCLE_API_KEY),
        arc_configured=bool(settings.ARC_API_KEY or settings.CIRCLE_API_KEY),
        circle_sandbox=settings.CIRCLE_SANDBOX,
    )
