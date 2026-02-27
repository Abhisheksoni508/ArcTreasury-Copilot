"""Base adapter protocol for payout execution."""

from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol, Optional


@dataclass
class LegResult:
    status: str        # "CONFIRMED" | "FAILED" | "SUBMITTED"
    tx_hash: str | None = None
    error_message: str | None = None
    is_simulated: bool = True


class PayoutAdapter(Protocol):
    """Interface all payout adapters must implement."""

    async def execute(self, leg_id: str, recipient_address: str, amount: float,
                      destination_chain: str) -> LegResult:
        """Execute a single payout leg. Returns LegResult."""
        ...

    async def check_status(self, tx_hash: str) -> LegResult:
        """Check the status of a previously submitted transaction."""
        ...

    def name(self) -> str:
        """Adapter name (e.g. 'mock', 'circle', 'arc')."""
        ...

    def is_simulated(self) -> bool:
        """Whether this adapter produces simulated results."""
        ...
