"""Circle adapter — real USDC payouts via Circle Gateway + Circle Wallets API.

Circle Gateway (CCTP): Cross-chain USDC transfer via burn-and-mint.
Circle Wallets: Programmable wallet transfers for same-chain USDC payouts.

Docs:
  - Circle Gateway: https://developers.circle.com/circle-mint/docs/circle-gateway
  - Circle Wallets: https://developers.circle.com/w3s/docs/overview
  - CCTP: https://developers.circle.com/stablecoins/docs/cctp-getting-started

Configuration:
  CIRCLE_API_KEY       — Your Circle API key (required)
  CIRCLE_WALLET_ID     — Source treasury wallet ID in Circle (required for real transfers)
  CIRCLE_ENTITY_SECRET — Entity secret for developer-controlled wallets (optional)
  CIRCLE_SANDBOX       — "true" for sandbox (api-sandbox.circle.com), "false" for production
"""

import httpx
import uuid
from app.adapters.base import LegResult
from app.config import settings


# Circle's chain identifiers (as used in Circle API)
# Ref: https://developers.circle.com/circle-mint/circle-api-resources
CHAIN_MAP = {
    "ethereum":  "ETH",
    "polygon":   "MATIC",
    "arbitrum":  "ARB",
    "solana":    "SOL",
    "avalanche": "AVAX",
    "base":      "BASE",
    "arc":       settings.ARC_CHAIN,  # Circle's Arc L1 blockchain
}


class CircleAdapter:
    """
    Executes USDC payouts via Circle Gateway and Circle Wallets API.

    For same-chain transfers: POST /v1/transfers (wallet → blockchain address)
    For cross-chain transfers: Circle uses CCTP automatically when chain differs
                               from source wallet chain.

    Sandbox: api-sandbox.circle.com — use for testing (no real funds)
    Production: api.circle.com — requires live API key and real wallet
    """

    def __init__(self):
        self.api_key = settings.CIRCLE_API_KEY
        self.wallet_id = settings.CIRCLE_WALLET_ID or "treasury-demo"

    @property
    def base_url(self) -> str:
        return settings.CIRCLE_API_BASE

    def name(self) -> str:
        return "circle"

    def is_simulated(self) -> bool:
        # Simulated if no API key configured
        return not bool(self.api_key)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def execute(self, leg_id: str, recipient_address: str, amount: float,
                      destination_chain: str) -> LegResult:
        if not self.api_key:
            return LegResult(
                status="FAILED",
                error_message=(
                    "Circle API key not configured. "
                    "Set CIRCLE_API_KEY env var. "
                    "Get your key at: https://console.circle.com"
                ),
                is_simulated=True,
            )

        circle_chain = CHAIN_MAP.get(destination_chain.lower(), "ETH")

        # POST /v1/transfers — Circle Wallets API transfer
        # Source: Circle Programmable Wallet (CIRCLE_WALLET_ID)
        # Destination: blockchain address on target chain
        # Circle automatically routes cross-chain via CCTP/Gateway when needed
        payload = {
            "idempotencyKey": str(uuid.uuid4()),
            "source": {
                "type": "wallet",
                "id": self.wallet_id,
            },
            "destination": {
                "type": "blockchain",
                "address": recipient_address,
                "chain": circle_chain,
            },
            "amount": {
                "amount": f"{amount:.2f}",
                "currency": "USD",  # Circle represents USDC as "USD" in transfers API
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}/transfers",
                    headers=self._headers(),
                    json=payload,
                    timeout=30.0,
                )
                if resp.status_code in (200, 201):
                    data = resp.json().get("data", {})
                    transfer_id = data.get("id", f"circle-{uuid.uuid4().hex[:12]}")
                    return LegResult(
                        status="SUBMITTED",
                        tx_hash=transfer_id,
                        is_simulated=False,
                    )
                else:
                    error_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                    error_msg = error_body.get("message", resp.text[:200])
                    return LegResult(
                        status="FAILED",
                        error_message=f"Circle API {resp.status_code}: {error_msg}",
                        is_simulated=False,
                    )
        except httpx.TimeoutException:
            return LegResult(
                status="FAILED",
                error_message="Circle API timeout — transfer may have been submitted. Check Circle dashboard.",
                is_simulated=False,
            )
        except Exception as e:
            return LegResult(
                status="FAILED",
                error_message=f"Circle API connection error: {str(e)[:200]}",
                is_simulated=True,
            )

    async def check_status(self, tx_hash: str) -> LegResult:
        """Check transfer status via GET /v1/transfers/{id}"""
        if not self.api_key:
            return LegResult(status="FAILED", error_message="No Circle API key configured", is_simulated=True)

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/transfers/{tx_hash}",
                    headers=self._headers(),
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    status = data.get("status", "pending")
                    if status == "complete":
                        return LegResult(status="CONFIRMED", tx_hash=tx_hash, is_simulated=False)
                    elif status == "failed":
                        error_code = data.get("errorCode", "Unknown error")
                        return LegResult(
                            status="FAILED", tx_hash=tx_hash, is_simulated=False,
                            error_message=f"Transfer failed: {error_code}",
                        )
                    else:
                        # "pending" or other intermediate states
                        return LegResult(status="SUBMITTED", tx_hash=tx_hash, is_simulated=False)
                return LegResult(
                    status="FAILED",
                    error_message=f"Circle status check failed: HTTP {resp.status_code}",
                    is_simulated=False,
                )
        except Exception as e:
            return LegResult(status="FAILED", error_message=str(e)[:200], is_simulated=True)

    async def get_wallet_balance(self) -> dict:
        """Fetch treasury wallet balance from Circle Wallets API.

        GET /v1/wallets/{wallet_id}/balances
        Returns: list of token balances (USDC amount on each chain)
        """
        if not self.api_key or not self.wallet_id or self.wallet_id == "treasury-demo":
            return {"error": "Circle wallet not configured", "balances": []}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/wallets/{self.wallet_id}/balances",
                    headers=self._headers(),
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    return {
                        "wallet_id": self.wallet_id,
                        "balances": data.get("tokenBalances", []),
                    }
                return {"error": f"HTTP {resp.status_code}", "balances": []}
        except Exception as e:
            return {"error": str(e)[:200], "balances": []}
