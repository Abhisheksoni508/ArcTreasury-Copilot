"""Mock adapter with deterministic outcomes for demo.

Outcomes are based on recipient address patterns:
  - Contains "SUCCESS" → immediate CONFIRMED
  - Contains "RETRY"  → FAILED on attempt 1, CONFIRMED on attempt 2+
  - Contains "FAIL"   → always FAILED (invalid wallet)
  - Contains "QUEUE"  → SUBMITTED (pending)
  - Default           → CONFIRMED
"""

import uuid
import asyncio
from app.adapters.base import LegResult

# Track retry attempts per item for deterministic retry behavior
_attempt_tracker: dict[str, int] = {}


class MockAdapter:
    def name(self) -> str:
        return "mock"

    def is_simulated(self) -> bool:
        return True

    async def execute(self, leg_id: str, recipient_address: str, amount: float,
                      destination_chain: str) -> LegResult:
        # Simulate network delay
        await asyncio.sleep(0.3)

        addr = recipient_address.upper()

        # Track attempts for retry logic
        _attempt_tracker[leg_id] = _attempt_tracker.get(leg_id, 0) + 1
        attempt = _attempt_tracker[leg_id]

        if "FAIL" in addr:
            return LegResult(
                status="FAILED",
                error_message="Invalid wallet address: recipient not found on chain",
                is_simulated=True,
            )

        if "RETRY" in addr:
            if attempt <= 1:
                return LegResult(
                    status="FAILED",
                    error_message="Temporary network error: RPC timeout on destination chain",
                    is_simulated=True,
                )
            else:
                return LegResult(
                    status="CONFIRMED",
                    tx_hash=f"0xMOCK_RETRY_OK_{uuid.uuid4().hex[:16]}",
                    is_simulated=True,
                )

        if "QUEUE" in addr:
            return LegResult(
                status="SUBMITTED",
                tx_hash=f"0xMOCK_QUEUED_{uuid.uuid4().hex[:16]}",
                is_simulated=True,
            )

        # Default: success (includes SUCCESS pattern and any other)
        return LegResult(
            status="CONFIRMED",
            tx_hash=f"0xMOCK_OK_{uuid.uuid4().hex[:16]}",
            is_simulated=True,
        )

    async def check_status(self, tx_hash: str) -> LegResult:
        await asyncio.sleep(0.1)
        if "QUEUED" in tx_hash:
            return LegResult(status="SUBMITTED", tx_hash=tx_hash, is_simulated=True)
        return LegResult(status="CONFIRMED", tx_hash=tx_hash, is_simulated=True)

    async def get_wallet_balance(self) -> dict:
        """Simulated treasury balance for demo."""
        return {
            "wallet_id": "mock-wallet-9999",
            "balances": [
                {
                    "token": {"symbol": "USDC", "name": "USD Coin", "decimals": 6},
                    "amount": "1000000.00",
                    "updateDate": "2024-01-01T00:00:00Z"
                }
            ]
        }

def reset_attempt_tracker():
    """Reset for testing."""
    _attempt_tracker.clear()
