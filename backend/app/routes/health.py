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
    )
