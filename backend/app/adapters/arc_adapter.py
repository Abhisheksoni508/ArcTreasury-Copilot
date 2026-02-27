"""Arc adapter — multi-chain USDC payouts via Arc Bridge Kit.

This adapter attempts real payouts through Arc's API.
Falls back gracefully if API key is missing or calls fail.
"""

import httpx
import uuid
from app.adapters.base import LegResult
from app.config import settings


class ArcAdapter:
    def __init__(self):
        self.api_key = settings.ARC_API_KEY
        self.base_url = settings.ARC_API_BASE

    def name(self) -> str:
        return "arc"

    def is_simulated(self) -> bool:
        return not bool(self.api_key)

    async def execute(self, leg_id: str, recipient_address: str, amount: float,
                      destination_chain: str) -> LegResult:
        if not self.api_key:
            return LegResult(
                status="FAILED",
                error_message="Arc API key not configured — set ARC_API_KEY env var",
                is_simulated=True,
            )

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}/payouts",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "idempotencyKey": str(uuid.uuid4()),
                        "recipient": recipient_address,
                        "amount": str(amount),
                        "currency": "USDC",
                        "chain": destination_chain,
                        "source_wallet": settings.TREASURY_WALLET,
                    },
                    timeout=30.0,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return LegResult(
                        status="SUBMITTED",
                        tx_hash=data.get("tx_hash", data.get("id", f"arc-{uuid.uuid4().hex[:12]}")),
                        is_simulated=False,
                    )
                else:
                    return LegResult(
                        status="FAILED",
                        error_message=f"Arc API error {resp.status_code}: {resp.text[:200]}",
                        is_simulated=False,
                    )
        except Exception as e:
            return LegResult(
                status="FAILED",
                error_message=f"Arc API connection error: {str(e)[:200]}",
                is_simulated=True,
            )

    async def check_status(self, tx_hash: str) -> LegResult:
        if not self.api_key:
            return LegResult(status="FAILED", error_message="No API key", is_simulated=True)

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/payouts/{tx_hash}/status",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    status = data.get("status", "pending").upper()
                    if status in ("COMPLETE", "CONFIRMED", "SETTLED"):
                        return LegResult(status="CONFIRMED", tx_hash=tx_hash, is_simulated=False)
                    elif status in ("FAILED", "REJECTED"):
                        return LegResult(status="FAILED", tx_hash=tx_hash, is_simulated=False,
                                         error_message=data.get("error", "Unknown"))
                    else:
                        return LegResult(status="SUBMITTED", tx_hash=tx_hash, is_simulated=False)
                return LegResult(status="FAILED", error_message=f"Status check failed: {resp.status_code}",
                                 is_simulated=True)
        except Exception as e:
            return LegResult(status="FAILED", error_message=str(e)[:200], is_simulated=True)
