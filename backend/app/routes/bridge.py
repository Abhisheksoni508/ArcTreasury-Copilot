"""CCTP Bridge routes — Cross-chain transfer protocol endpoints."""

from fastapi import APIRouter
from app.database import get_db
from app.services.cctp_bridge import (
    get_cctp_domains,
    get_supported_routes,
    plan_bridge_route,
    get_bridge_transactions,
)
from pydantic import BaseModel

router = APIRouter()


class BridgeRouteRequest(BaseModel):
    source_chain: str
    destination_chain: str
    amount: float


@router.get("/bridge/domains")
async def cctp_domains():
    """Get CCTP domain registry for all supported chains."""
    return get_cctp_domains()


@router.get("/bridge/routes")
async def bridge_routes():
    """Get all supported cross-chain bridge routes with fees and times."""
    return get_supported_routes()


@router.post("/bridge/plan")
async def plan_route(req: BridgeRouteRequest):
    """Plan optimal bridge route for a cross-chain USDC transfer."""
    return plan_bridge_route(req.source_chain, req.destination_chain, req.amount)


@router.get("/bridge/transactions")
async def bridge_transactions(limit: int = 50):
    """Get recent cross-chain bridge transactions with CCTP routing info."""
    db = await get_db()
    try:
        return await get_bridge_transactions(db, limit)
    finally:
        await db.close()
