"""Circle adapter — real USDC payouts via Circle API.

This adapter attempts real payouts through Circle's API.
Falls back gracefully if API key is missing or calls fail.
"""

import httpx
import uuid
from app.adapters.base import LegResult
from app.config import settings


class CircleAdapter:
    def __init__(self):
        self.api_key = settings.CIRCLE_API_KEY
        self.base_url = settings.CIRCLE_API_BASE

    def name(self) -> str:
        return "circle"

    def is_simulated(self) -> bool:
        return not bool(self.api_key)

    async def execute(self, leg_id: str, recipient_address: str, amount: float,
                      destination_chain: str) -> LegResult:
        if not self.api_key:
            return LegResult(
                status="FAILED",
                error_message="Circle API key not configured — set CIRCLE_API_KEY env var",
                is_simulated=True,
            )

        chain_map = {
            "ethereum": "ETH",
            "polygon": "MATIC",
            "arbitrum": "ARB",
            "solana": "SOL",
            "avalanche": "AVAX",
            "base": "BASE",
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}/transfers",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "idempotencyKey": str(uuid.uuid4()),
                        "source": {"type": "wallet", "id": "treasury"},
                        "destination": {
                            "type": "blockchain",
                            "address": recipient_address,
                            "chain": chain_map.get(destination_chain, "ETH"),
                        },
                        "amount": {"amount": str(amount), "currency": "USD"},
                    },
                    timeout=30.0,
                )
                if resp.status_code in (200, 201):
                    data = resp.json().get("data", {})
                    return LegResult(
                        status="SUBMITTED",
                        tx_hash=data.get("id", f"circle-{uuid.uuid4().hex[:12]}"),
                        is_simulated=False,
                    )
                else:
                    return LegResult(
                        status="FAILED",
                        error_message=f"Circle API error {resp.status_code}: {resp.text[:200]}",
                        is_simulated=False,
                    )
        except Exception as e:
            return LegResult(
                status="FAILED",
                error_message=f"Circle API connection error: {str(e)[:200]}",
                is_simulated=True,
            )

    async def check_status(self, tx_hash: str) -> LegResult:
        if not self.api_key:
            return LegResult(status="FAILED", error_message="No API key", is_simulated=True)

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/transfers/{tx_hash}",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    status = data.get("status", "pending")
                    if status == "complete":
                        return LegResult(status="CONFIRMED", tx_hash=tx_hash, is_simulated=False)
                    elif status == "failed":
                        return LegResult(status="FAILED", tx_hash=tx_hash, is_simulated=False,
                                         error_message=data.get("errorCode", "Unknown"))
                    else:
                        return LegResult(status="SUBMITTED", tx_hash=tx_hash, is_simulated=False)
                return LegResult(status="FAILED", error_message=f"Status check failed: {resp.status_code}",
                                 is_simulated=True)
        except Exception as e:
            return LegResult(status="FAILED", error_message=str(e)[:200], is_simulated=True)
