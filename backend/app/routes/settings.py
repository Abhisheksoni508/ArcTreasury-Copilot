"""Settings endpoints."""

from fastapi import APIRouter
from app.config import settings
from app.models import SettingsResponse, SettingsUpdateRequest

router = APIRouter()


@router.get("/settings", response_model=SettingsResponse)
async def get_settings():
    return SettingsResponse(
        adapter_mode=settings.ADAPTER_MODE,
        policy_max_amount=settings.POLICY_MAX_AMOUNT,
        policy_velocity_limit=settings.POLICY_VELOCITY_LIMIT,
        supported_chains=settings.SUPPORTED_CHAINS,
        treasury_wallet=settings.TREASURY_WALLET,
    )


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(req: SettingsUpdateRequest):
    if req.adapter_mode is not None:
        settings.ADAPTER_MODE = req.adapter_mode
    if req.policy_max_amount is not None:
        settings.POLICY_MAX_AMOUNT = req.policy_max_amount
    if req.policy_velocity_limit is not None:
        settings.POLICY_VELOCITY_LIMIT = req.policy_velocity_limit

    return SettingsResponse(
        adapter_mode=settings.ADAPTER_MODE,
        policy_max_amount=settings.POLICY_MAX_AMOUNT,
        policy_velocity_limit=settings.POLICY_VELOCITY_LIMIT,
        supported_chains=settings.SUPPORTED_CHAINS,
        treasury_wallet=settings.TREASURY_WALLET,
    )
