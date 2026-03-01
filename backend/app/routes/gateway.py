"""Circle Gateway routes — Crosschain unified USDC balance endpoints.

Circle Gateway enables instant crosschain USDC transfers via a unified
balance model. Deposit on any chain, mint instantly on any other.

Docs: https://developers.circle.com/gateway
"""

from fastapi import APIRouter
from app.database import get_db
from app.services.gateway_service import (
    get_gateway_info,
    deposit_to_gateway,
    mint_from_gateway,
    transfer_crosschain,
    get_gateway_transactions,
    get_unified_balance,
)
from pydantic import BaseModel

router = APIRouter()


class GatewayDepositRequest(BaseModel):
    source_chain: str
    amount_usdc: float


class GatewayMintRequest(BaseModel):
    destination_chain: str
    amount_usdc: float


class GatewayTransferRequest(BaseModel):
    source_chain: str
    destination_chain: str
    amount_usdc: float


@router.get("/gateway/info")
async def gateway_info():
    """Get Circle Gateway product info, supported chains, and integration guide."""
    return get_gateway_info()


@router.get("/gateway/balance")
async def gateway_balance():
    """Get unified crosschain Gateway balance."""
    db = await get_db()
    try:
        return await get_unified_balance(db)
    finally:
        await db.close()


@router.post("/gateway/deposit")
async def deposit(req: GatewayDepositRequest):
    """Deposit USDC to Gateway Wallet contract on a source chain."""
    db = await get_db()
    try:
        return await deposit_to_gateway(db, req.source_chain, req.amount_usdc)
    finally:
        await db.close()


@router.post("/gateway/mint")
async def mint(req: GatewayMintRequest):
    """Mint USDC on destination chain from unified Gateway balance (<500ms)."""
    db = await get_db()
    try:
        return await mint_from_gateway(db, req.destination_chain, req.amount_usdc)
    finally:
        await db.close()


@router.post("/gateway/transfer")
async def transfer(req: GatewayTransferRequest):
    """Crosschain transfer via Gateway: deposit on source + instant mint on destination."""
    db = await get_db()
    try:
        return await transfer_crosschain(
            db, req.source_chain, req.destination_chain, req.amount_usdc
        )
    finally:
        await db.close()


@router.get("/gateway/transactions")
async def transactions(limit: int = 50):
    """Get all Gateway transactions (deposits, mints, transfers)."""
    db = await get_db()
    try:
        return await get_gateway_transactions(db, limit)
    finally:
        await db.close()
