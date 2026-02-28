"""Treasury routes — RWA-backed treasury management endpoints."""

from fastapi import APIRouter
from app.database import get_db
from app.services.treasury_service import (
    get_treasury_overview,
    get_rwa_catalog,
    get_treasury_positions,
    allocate_to_rwa,
    redeem_rwa,
    auto_rebalance,
    get_rebalance_history,
    get_treasury_config,
    update_treasury_config,
    seed_treasury_positions,
)
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class AllocateRequest(BaseModel):
    asset_symbol: str
    amount_usdc: float


class TreasuryConfigRequest(BaseModel):
    min_reserve_ratio: Optional[float] = None
    target_reserve_ratio: Optional[float] = None
    rebalance_threshold: Optional[float] = None


@router.get("/treasury/overview")
async def treasury_overview():
    """Get comprehensive treasury overview: liquid USDC + RWA + health."""
    db = await get_db()
    try:
        return await get_treasury_overview(db)
    finally:
        await db.close()


@router.get("/treasury/catalog")
async def rwa_catalog():
    """Get available RWA assets for treasury allocation."""
    return await get_rwa_catalog()


@router.get("/treasury/positions")
async def treasury_positions():
    """Get all active RWA positions."""
    db = await get_db()
    try:
        return await get_treasury_positions(db)
    finally:
        await db.close()


@router.post("/treasury/allocate")
async def allocate(req: AllocateRequest):
    """Allocate USDC to an RWA position."""
    db = await get_db()
    try:
        return await allocate_to_rwa(db, req.asset_symbol, req.amount_usdc)
    finally:
        await db.close()


@router.post("/treasury/redeem/{position_id}")
async def redeem(position_id: str):
    """Redeem an RWA position back to USDC."""
    db = await get_db()
    try:
        return await redeem_rwa(db, position_id)
    finally:
        await db.close()


@router.post("/treasury/rebalance")
async def rebalance():
    """Trigger agent-driven treasury rebalancing."""
    db = await get_db()
    try:
        return await auto_rebalance(db)
    finally:
        await db.close()


@router.get("/treasury/rebalance-history")
async def rebalance_history(limit: int = 20):
    """Get treasury rebalance history."""
    db = await get_db()
    try:
        return await get_rebalance_history(db, limit)
    finally:
        await db.close()


@router.get("/treasury/config")
async def get_config():
    """Get treasury configuration."""
    db = await get_db()
    try:
        return await get_treasury_config(db)
    finally:
        await db.close()


@router.put("/treasury/config")
async def set_config(req: TreasuryConfigRequest):
    """Update treasury configuration."""
    db = await get_db()
    try:
        update = {k: v for k, v in req.model_dump().items() if v is not None}
        return await update_treasury_config(db, update)
    finally:
        await db.close()


@router.post("/treasury/seed")
async def seed_treasury():
    """Seed demo RWA positions for showcase."""
    db = await get_db()
    try:
        results = await seed_treasury_positions(db)
        return {"message": f"Seeded {len(results)} RWA positions", "positions": results}
    finally:
        await db.close()
