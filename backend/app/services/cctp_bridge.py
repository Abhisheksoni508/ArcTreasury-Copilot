"""CCTP Bridge Service — Cross-Chain Transfer Protocol routing for multi-chain USDC settlement.

Implements Circle's Cross-Chain Transfer Protocol (CCTP) V2 for seamless USDC
transfers across blockchains. CCTP works by:
  1. Burning USDC on the source chain
  2. Obtaining an attestation from Circle's attestation service
  3. Minting USDC on the destination chain

Arc Testnet uses CCTP domain 26 and leverages Circle's infrastructure
for cross-chain USDC movement.

Docs:
  - CCTP V2:  https://developers.circle.com/stablecoins/cctp-getting-started
  - Domains:  https://developers.circle.com/stablecoins/cctp-protocol-contract
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
import aiosqlite

from app.config import settings
from app.services.audit_service import log_audit


# ── CCTP Domain Registry ────────────────────────────────────────────────
# Each blockchain has a unique CCTP domain identifier for cross-chain attestation.

CCTP_DOMAINS = {
    "ethereum":  {"domain": 0, "chain_id": 1,       "testnet_chain_id": 11155111, "testnet_name": "ETH-SEPOLIA",  "usdc_contract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"},
    "avalanche": {"domain": 1, "chain_id": 43114,   "testnet_chain_id": 43113,    "testnet_name": "AVAX-FUJI",    "usdc_contract": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"},
    "arbitrum":  {"domain": 3, "chain_id": 42161,   "testnet_chain_id": 421614,   "testnet_name": "ARB-SEPOLIA",  "usdc_contract": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"},
    "base":      {"domain": 6, "chain_id": 8453,    "testnet_chain_id": 84532,    "testnet_name": "BASE-SEPOLIA", "usdc_contract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
    "polygon":   {"domain": 7, "chain_id": 137,     "testnet_chain_id": 80002,    "testnet_name": "MATIC-AMOY",   "usdc_contract": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"},
    "solana":    {"domain": 5, "chain_id": 0,       "testnet_chain_id": 0,        "testnet_name": "SOL-DEVNET",   "usdc_contract": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},
    "arc":       {"domain": 26, "chain_id": 5042001, "testnet_chain_id": 5042002, "testnet_name": "ARC-TESTNET",  "usdc_contract": "0x3600000000000000000000000000000000000000"},
}

# Bridge fee schedule (in USDC) — varies by route
BRIDGE_FEES = {
    "same_chain": 0.0,
    "evm_to_evm": 0.50,
    "evm_to_arc": 0.25,  # Arc-native bridging is cheaper
    "arc_to_evm": 0.25,
    "evm_to_solana": 1.00,
    "solana_to_evm": 1.00,
}


def get_cctp_domains() -> dict:
    """Return the full CCTP domain registry."""
    return CCTP_DOMAINS


def get_supported_routes() -> list[dict]:
    """Return all supported cross-chain bridge routes with fees and estimated times."""
    routes = []
    chains = list(CCTP_DOMAINS.keys())

    for src in chains:
        for dst in chains:
            if src == dst:
                continue
            fee = _calculate_bridge_fee(src, dst)
            est_time = _estimate_bridge_time(src, dst)
            routes.append({
                "source_chain": src,
                "destination_chain": dst,
                "source_domain": CCTP_DOMAINS[src]["domain"],
                "destination_domain": CCTP_DOMAINS[dst]["domain"],
                "fee_usdc": fee,
                "estimated_seconds": est_time,
                "protocol": "CCTP_V2",
                "status": "active",
            })

    return routes


def _calculate_bridge_fee(src: str, dst: str) -> float:
    """Calculate bridge fee for a given route."""
    if src == dst:
        return BRIDGE_FEES["same_chain"]
    if src == "solana" or dst == "solana":
        return BRIDGE_FEES["evm_to_solana"]
    if src == "arc":
        return BRIDGE_FEES["arc_to_evm"]
    if dst == "arc":
        return BRIDGE_FEES["evm_to_arc"]
    return BRIDGE_FEES["evm_to_evm"]


def _estimate_bridge_time(src: str, dst: str) -> int:
    """Estimate bridge completion time in seconds."""
    if src == dst:
        return 0
    if "solana" in (src, dst):
        return 120  # ~2 minutes
    if "arc" in (src, dst):
        return 30   # Arc is fast
    return 60       # ~1 minute for EVM-to-EVM via CCTP


def plan_bridge_route(
    source_chain: str,
    destination_chain: str,
    amount: float,
) -> dict:
    """Plan the optimal bridge route for a cross-chain USDC transfer.

    Returns the route plan including:
      - Steps (burn → attest → mint)
      - Fees
      - Estimated time
      - CCTP contract addresses
    """
    src = CCTP_DOMAINS.get(source_chain)
    dst = CCTP_DOMAINS.get(destination_chain)

    if not src:
        return {"error": f"Unsupported source chain: {source_chain}"}
    if not dst:
        return {"error": f"Unsupported destination chain: {destination_chain}"}

    if source_chain == destination_chain:
        return {
            "type": "DIRECT",
            "source_chain": source_chain,
            "destination_chain": destination_chain,
            "steps": [
                {"step": 1, "action": "TRANSFER", "chain": source_chain, "description": f"Direct USDC transfer on {source_chain}"}
            ],
            "fee_usdc": 0,
            "estimated_seconds": 15,
            "net_amount": amount,
        }

    fee = _calculate_bridge_fee(source_chain, destination_chain)
    est_time = _estimate_bridge_time(source_chain, destination_chain)

    return {
        "type": "CCTP_BRIDGE",
        "source_chain": source_chain,
        "source_domain": src["domain"],
        "destination_chain": destination_chain,
        "destination_domain": dst["domain"],
        "steps": [
            {
                "step": 1,
                "action": "BURN",
                "chain": source_chain,
                "contract": src["usdc_contract"],
                "description": f"Burn {amount} USDC on {source_chain} (CCTP domain {src['domain']})",
            },
            {
                "step": 2,
                "action": "ATTEST",
                "chain": "circle_attestation_service",
                "description": f"Circle attestation service verifies burn on domain {src['domain']}",
            },
            {
                "step": 3,
                "action": "MINT",
                "chain": destination_chain,
                "contract": dst["usdc_contract"],
                "description": f"Mint {amount - fee} USDC on {destination_chain} (CCTP domain {dst['domain']})",
            },
        ],
        "fee_usdc": fee,
        "estimated_seconds": est_time,
        "gross_amount": amount,
        "net_amount": round(amount - fee, 2),
        "attestation_url": f"https://iris-api.circle.com/attestations/0x{'0' * 64}",
    }


async def get_bridge_transactions(db: aiosqlite.Connection, limit: int = 50) -> list[dict]:
    """Get recent bridge (cross-chain) payout legs with CCTP routing info."""
    cursor = await db.execute(
        """SELECT pl.id, pl.item_id, pl.leg_type, pl.source_chain, pl.destination_chain,
                  pl.amount, pl.status, pl.tx_hash, pl.adapter_used, pl.attempt_number,
                  pl.error_message, pl.created_at,
                  pi.recipient_name, pi.recipient_address
           FROM payout_legs pl
           JOIN payout_items pi ON pl.item_id = pi.id
           WHERE pl.leg_type = 'bridge'
           ORDER BY pl.created_at DESC LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    results = []
    for row in rows:
        src_chain = row[3]
        dst_chain = row[4]
        src_domain = CCTP_DOMAINS.get(src_chain, {})
        dst_domain = CCTP_DOMAINS.get(dst_chain, {})

        results.append({
            "id": row[0],
            "item_id": row[1],
            "leg_type": row[2],
            "source_chain": src_chain,
            "source_cctp_domain": src_domain.get("domain"),
            "destination_chain": dst_chain,
            "destination_cctp_domain": dst_domain.get("domain"),
            "amount": row[5],
            "bridge_fee": _calculate_bridge_fee(src_chain, dst_chain),
            "net_amount": round(row[5] - _calculate_bridge_fee(src_chain, dst_chain), 2),
            "status": row[6],
            "tx_hash": row[7],
            "adapter_used": row[8],
            "attempt_number": row[9],
            "error_message": row[10],
            "created_at": row[11],
            "recipient_name": row[12],
            "recipient_address": row[13],
        })

    return results


async def log_bridge_event(
    db: aiosqlite.Connection,
    leg_id: str,
    event: str,
    details: str,
):
    """Log a CCTP bridge event to the audit trail."""
    await log_audit(db, "bridge", leg_id, event, "", "", details)
