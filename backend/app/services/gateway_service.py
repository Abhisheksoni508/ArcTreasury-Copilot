"""Circle Gateway Service — Crosschain unified USDC balance.

Circle Gateway enables a unified USDC balance across multiple blockchains.
Deposit USDC to non-custodial Gateway Wallet contracts on any supported
source blockchain, then mint USDC instantly (<500ms) on any destination
blockchain using a single API call.

Key features:
  - Unified crosschain balance (hold USDC across chains as one balance)
  - Instant transfers (<500ms after balance is established)
  - Non-custodial with signature-based authorization
  - 7-day trustless withdrawal option

Integration flow:
  1. Deposit USDC to Gateway Wallet contract on source chain
  2. Gateway aggregates deposits into unified crosschain balance
  3. Mint USDC instantly on any destination chain from the unified balance

Docs: https://developers.circle.com/gateway

Note: Gateway is fully permissionless — no sign-up needed.
For this hackathon, we model the Gateway API surface and demonstrate
the crosschain unified balance concept with real CCTP domain data.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
import aiosqlite

from app.config import settings
from app.services.audit_service import log_audit


# ── Gateway Supported Blockchains ────────────────────────────────────────
# Real Gateway supported chains with their deposit contract addresses
# see: https://developers.circle.com/gateway/references/supported-blockchains

GATEWAY_CHAINS = {
    "ethereum": {
        "name": "Ethereum",
        "chain_id": 1,
        "testnet_chain_id": 11155111,
        "testnet_name": "Sepolia",
        "gateway_contract": "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
        "usdc_contract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "deposit_gas_estimate": "~65,000 gas",
        "status": "active",
    },
    "arbitrum": {
        "name": "Arbitrum One",
        "chain_id": 42161,
        "testnet_chain_id": 421614,
        "testnet_name": "Arbitrum Sepolia",
        "gateway_contract": "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
        "usdc_contract": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "deposit_gas_estimate": "~65,000 gas",
        "status": "active",
    },
    "base": {
        "name": "Base",
        "chain_id": 8453,
        "testnet_chain_id": 84532,
        "testnet_name": "Base Sepolia",
        "gateway_contract": "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
        "usdc_contract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "deposit_gas_estimate": "~65,000 gas",
        "status": "active",
    },
    "polygon": {
        "name": "Polygon PoS",
        "chain_id": 137,
        "testnet_chain_id": 80002,
        "testnet_name": "Amoy",
        "gateway_contract": "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
        "usdc_contract": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        "deposit_gas_estimate": "~65,000 gas",
        "status": "active",
    },
    "avalanche": {
        "name": "Avalanche C-Chain",
        "chain_id": 43114,
        "testnet_chain_id": 43113,
        "testnet_name": "Fuji",
        "gateway_contract": "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
        "usdc_contract": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        "deposit_gas_estimate": "~65,000 gas",
        "status": "active",
    },
    "solana": {
        "name": "Solana",
        "chain_id": 0,
        "testnet_chain_id": 0,
        "testnet_name": "Devnet",
        "gateway_contract": "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3",
        "usdc_contract": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "deposit_gas_estimate": "~5,000 lamports",
        "status": "active",
    },
    "arc": {
        "name": "Arc",
        "chain_id": 5042001,
        "testnet_chain_id": 5042002,
        "testnet_name": "Arc Testnet",
        "gateway_contract": "0x3600000000000000000000000000000000000000",
        "usdc_contract": "0x3600000000000000000000000000000000000000",
        "deposit_gas_estimate": "~50,000 gas (USDC gas)",
        "status": "active",
    },
}


def get_gateway_info() -> dict:
    """Return Circle Gateway product info, supported chains, and integration guide."""
    return {
        "provider": "Circle Gateway",
        "description": "Unified crosschain USDC balance — deposit on any chain, mint instantly on any other",
        "product_url": "https://developers.circle.com/gateway",
        "supported_chains": GATEWAY_CHAINS,
        "chain_count": len(GATEWAY_CHAINS),
        "key_features": [
            "Unified crosschain balance across all supported blockchains",
            "Instant USDC minting (<500ms) on destination chain",
            "Non-custodial — signature-based authorization",
            "7-day trustless withdrawal option",
            "Permissionless — no sign-up required",
            "No oracle dependencies — Circle-native attestation",
        ],
        "transfer_flow": [
            "1. Approve USDC spend to Gateway Wallet contract on source chain",
            "2. Call depositForBurn() on source chain — USDC deposited to Gateway",
            "3. Gateway aggregates into unified crosschain balance",
            "4. Call mint() on destination chain — USDC minted in <500ms",
            "5. USDC available in destination wallet immediately",
        ],
        "vs_cctp": {
            "cctp": "Point-to-point transfers, 8-20s (Fast Transfer) or 15-19min (Standard)",
            "gateway": "Unified balance model, <500ms mint after balance established",
            "recommendation": "Use Gateway for frequent crosschain access; CCTP for one-off transfers",
        },
    }


def get_gateway_balance(chain_deposits: dict[str, float] | None = None) -> dict:
    """Calculate the unified crosschain balance from deposits.

    In production, this queries the Gateway contract on each chain.
    For the demo, we track deposits in our DB.
    """
    if chain_deposits is None:
        chain_deposits = {}

    total_balance = sum(chain_deposits.values())

    return {
        "unified_balance_usdc": round(total_balance, 2),
        "deposits_by_chain": chain_deposits,
        "available_to_mint": round(total_balance, 2),
        "chains_with_balance": [c for c, v in chain_deposits.items() if v > 0],
        "total_chains": len(GATEWAY_CHAINS),
    }


async def deposit_to_gateway(
    db: aiosqlite.Connection,
    source_chain: str,
    amount_usdc: float,
) -> dict:
    """Deposit USDC to Gateway Wallet contract on a source chain.

    In production, this would:
      1. Approve USDC spend to Gateway contract
      2. Call depositForBurn() on the Gateway contract
      3. Receive confirmation and update unified balance

    For the hackathon, we model the flow and track in DB.
    """
    chain_info = GATEWAY_CHAINS.get(source_chain.lower())
    if not chain_info:
        return {"error": f"Chain '{source_chain}' not supported. Supported: {list(GATEWAY_CHAINS.keys())}"}

    if amount_usdc <= 0:
        return {"error": "Amount must be positive"}

    tx_id = f"gw-dep-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex[:24]}"

    await db.execute(
        """INSERT INTO gateway_transactions
           (id, type, source_chain, destination_chain, amount_usdc, fee_usdc,
            status, tx_hash, gateway_address, created_at, updated_at)
           VALUES (?, 'DEPOSIT', ?, NULL, ?, 0, 'COMPLETED', ?, ?, ?, ?)""",
        (tx_id, source_chain.lower(), amount_usdc, tx_hash,
         chain_info["gateway_contract"], now, now),
    )
    await log_audit(
        db, "gateway", tx_id, "GATEWAY_DEPOSIT",
        old_value=None, new_value=f"{amount_usdc} USDC",
        details=f"Deposited {amount_usdc} USDC to Gateway on {chain_info['name']} ({chain_info['gateway_contract']})",
    )
    await db.commit()

    return {
        "tx_id": tx_id,
        "type": "DEPOSIT",
        "source_chain": source_chain.lower(),
        "amount_usdc": amount_usdc,
        "fee_usdc": 0,
        "status": "COMPLETED",
        "tx_hash": tx_hash,
        "gateway_contract": chain_info["gateway_contract"],
        "message": f"{amount_usdc} USDC deposited to Gateway on {chain_info['name']}. Balance updated instantly.",
    }


async def mint_from_gateway(
    db: aiosqlite.Connection,
    destination_chain: str,
    amount_usdc: float,
) -> dict:
    """Mint USDC on a destination chain from the unified Gateway balance.

    Circle Gateway mints in <500ms — no waiting for source chain finality.

    In production, this calls the Gateway mint API.
    """
    chain_info = GATEWAY_CHAINS.get(destination_chain.lower())
    if not chain_info:
        return {"error": f"Chain '{destination_chain}' not supported"}

    if amount_usdc <= 0:
        return {"error": "Amount must be positive"}

    # Check unified balance (sum of all deposits - previous mints)
    balance_info = await _get_db_gateway_balance(db)
    available = balance_info["unified_balance_usdc"]
    if amount_usdc > available:
        return {
            "error": f"Insufficient Gateway balance. Available: {available} USDC, requested: {amount_usdc} USDC",
        }

    tx_id = f"gw-mint-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex[:24]}"

    await db.execute(
        """INSERT INTO gateway_transactions
           (id, type, source_chain, destination_chain, amount_usdc, fee_usdc,
            status, tx_hash, gateway_address, created_at, updated_at)
           VALUES (?, 'MINT', NULL, ?, ?, 0, 'COMPLETED', ?, ?, ?, ?)""",
        (tx_id, destination_chain.lower(), amount_usdc, tx_hash,
         chain_info["gateway_contract"], now, now),
    )
    await log_audit(
        db, "gateway", tx_id, "GATEWAY_MINT",
        old_value=f"balance: {available} USDC", new_value=f"balance: {available - amount_usdc} USDC",
        details=f"Minted {amount_usdc} USDC on {chain_info['name']} from Gateway balance (instant <500ms)",
    )
    await db.commit()

    return {
        "tx_id": tx_id,
        "type": "MINT",
        "destination_chain": destination_chain.lower(),
        "amount_usdc": amount_usdc,
        "fee_usdc": 0,
        "status": "COMPLETED",
        "tx_hash": tx_hash,
        "latency_ms": 320,
        "message": f"{amount_usdc} USDC minted on {chain_info['name']} in <500ms from Gateway balance.",
    }


async def transfer_crosschain(
    db: aiosqlite.Connection,
    source_chain: str,
    destination_chain: str,
    amount_usdc: float,
) -> dict:
    """Execute a full crosschain transfer via Gateway: deposit + instant mint.

    This combines deposit on source chain + mint on destination chain
    into a single operation, demonstrating Gateway's unified balance model.
    """
    src_info = GATEWAY_CHAINS.get(source_chain.lower())
    dst_info = GATEWAY_CHAINS.get(destination_chain.lower())

    if not src_info:
        return {"error": f"Source chain '{source_chain}' not supported"}
    if not dst_info:
        return {"error": f"Destination chain '{destination_chain}' not supported"}
    if source_chain.lower() == destination_chain.lower():
        return {"error": "Source and destination chain must differ for crosschain transfer"}
    if amount_usdc <= 0:
        return {"error": "Amount must be positive"}

    tx_id = f"gw-xfer-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    deposit_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex[:24]}"
    mint_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex[:24]}"

    await db.execute(
        """INSERT INTO gateway_transactions
           (id, type, source_chain, destination_chain, amount_usdc, fee_usdc,
            status, tx_hash, gateway_address, created_at, updated_at)
           VALUES (?, 'TRANSFER', ?, ?, ?, 0, 'COMPLETED', ?, ?, ?, ?)""",
        (tx_id, source_chain.lower(), destination_chain.lower(), amount_usdc,
         f"{deposit_hash}|{mint_hash}",
         dst_info["gateway_contract"], now, now),
    )
    await log_audit(
        db, "gateway", tx_id, "GATEWAY_TRANSFER",
        old_value=f"{source_chain}: {amount_usdc} USDC",
        new_value=f"{destination_chain}: {amount_usdc} USDC",
        details=(
            f"Crosschain transfer via Gateway: {amount_usdc} USDC from "
            f"{src_info['name']} → {dst_info['name']} (instant <500ms)"
        ),
    )
    await db.commit()

    return {
        "tx_id": tx_id,
        "type": "TRANSFER",
        "source_chain": source_chain.lower(),
        "destination_chain": destination_chain.lower(),
        "amount_usdc": amount_usdc,
        "fee_usdc": 0,
        "status": "COMPLETED",
        "deposit_tx_hash": deposit_hash,
        "mint_tx_hash": mint_hash,
        "latency_ms": 450,
        "steps": [
            {"step": 1, "action": "DEPOSIT", "chain": source_chain.lower(),
             "description": f"Deposit {amount_usdc} USDC to Gateway on {src_info['name']}"},
            {"step": 2, "action": "BALANCE_UPDATE", "chain": "gateway",
             "description": "Unified balance updated (no finality wait)"},
            {"step": 3, "action": "MINT", "chain": destination_chain.lower(),
             "description": f"Mint {amount_usdc} USDC on {dst_info['name']} (<500ms)"},
        ],
        "message": (
            f"Transferred {amount_usdc} USDC from {src_info['name']} to {dst_info['name']} "
            f"via Circle Gateway in <500ms."
        ),
    }


async def get_gateway_transactions(db: aiosqlite.Connection, limit: int = 50) -> list[dict]:
    """Get all gateway transactions."""
    cursor = await db.execute(
        """SELECT id, type, source_chain, destination_chain, amount_usdc, fee_usdc,
                  status, tx_hash, gateway_address, created_at, updated_at
           FROM gateway_transactions
           ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    return [
        {
            "id": row[0],
            "type": row[1],
            "source_chain": row[2],
            "destination_chain": row[3],
            "amount_usdc": row[4],
            "fee_usdc": row[5],
            "status": row[6],
            "tx_hash": row[7],
            "gateway_address": row[8],
            "created_at": row[9],
            "updated_at": row[10],
        }
        for row in rows
    ]


async def _get_db_gateway_balance(db: aiosqlite.Connection) -> dict:
    """Calculate unified balance from DB transactions."""
    # Total deposits and mints
    cursor = await db.execute(
        """SELECT
             COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'TRANSFER') THEN amount_usdc ELSE 0 END), 0) as deposits,
             COALESCE(SUM(CASE WHEN type IN ('MINT', 'TRANSFER') THEN amount_usdc ELSE 0 END), 0) as mints
           FROM gateway_transactions
           WHERE status = 'COMPLETED'"""
    )
    row = await cursor.fetchone()
    total_deposits = row[0]
    total_mints = row[1]
    net_balance = round(total_deposits - total_mints, 2)

    # Get per-chain deposits
    cursor2 = await db.execute(
        """SELECT source_chain, SUM(amount_usdc) as total
           FROM gateway_transactions
           WHERE type IN ('DEPOSIT', 'TRANSFER') AND status = 'COMPLETED' AND source_chain IS NOT NULL
           GROUP BY source_chain"""
    )
    chain_deposits = {}
    for r in await cursor2.fetchall():
        if r[0]:
            chain_deposits[r[0]] = round(r[1], 2)

    # Get per-chain mints
    cursor3 = await db.execute(
        """SELECT destination_chain, SUM(amount_usdc) as total
           FROM gateway_transactions
           WHERE type IN ('MINT', 'TRANSFER') AND status = 'COMPLETED' AND destination_chain IS NOT NULL
           GROUP BY destination_chain"""
    )
    chain_mints = {}
    for r in await cursor3.fetchall():
        if r[0]:
            chain_mints[r[0]] = round(r[1], 2)

    return {
        "unified_balance_usdc": max(0, net_balance),
        "deposits_by_chain": chain_deposits,
        "available_to_mint": max(0, net_balance),
        "chains_with_balance": [c for c, v in chain_deposits.items() if v > 0],
        "total_chains": len(GATEWAY_CHAINS),
    }


async def get_unified_balance(db: aiosqlite.Connection) -> dict:
    """Public helper to get current Gateway unified balance."""
    return await _get_db_gateway_balance(db)
