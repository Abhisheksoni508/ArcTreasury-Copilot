"""Circle Gateway routes — Fiat on/off ramp endpoints."""

from fastapi import APIRouter
from app.database import get_db
from app.services.gateway_service import (
    get_gateway_info,
    create_deposit_intent,
    create_withdrawal_intent,
    simulate_deposit_complete,
    get_gateway_transactions,
)
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class DepositRequest(BaseModel):
    amount: float
    currency: str = "USD"
    rail: str = "wire"


class WithdrawalRequest(BaseModel):
    amount_usdc: float
    currency: str = "USD"
    rail: str = "wire"
    bank_account: Optional[str] = None


@router.get("/gateway/info")
async def gateway_info():
    """Get Circle Gateway configuration, supported rails, and integration docs."""
    return get_gateway_info()


@router.post("/gateway/deposit")
async def deposit(req: DepositRequest):
    """Create a fiat-to-USDC deposit intent."""
    db = await get_db()
    try:
        return await create_deposit_intent(db, req.amount, req.currency, req.rail)
    finally:
        await db.close()


@router.post("/gateway/withdraw")
async def withdraw(req: WithdrawalRequest):
    """Create a USDC-to-fiat withdrawal intent."""
    db = await get_db()
    try:
        return await create_withdrawal_intent(db, req.amount_usdc, req.currency, req.rail, req.bank_account)
    finally:
        await db.close()


@router.post("/gateway/deposit/{intent_id}/complete")
async def complete_deposit(intent_id: str):
    """Simulate a deposit completing (demo/test use)."""
    db = await get_db()
    try:
        return await simulate_deposit_complete(db, intent_id)
    finally:
        await db.close()


@router.get("/gateway/transactions")
async def transactions(limit: int = 50):
    """Get all gateway (fiat on/off ramp) transactions."""
    db = await get_db()
    try:
        return await get_gateway_transactions(db, limit)
    finally:
        await db.close()
