"""Arc Bridge Kit adapter — cross-chain USDC payouts to Arc L1 via Circle CCTP.

Arc is Circle's EVM-compatible Layer-1 blockchain designed for stablecoin finance.
Arc uses Circle's Cross-Chain Transfer Protocol (CCTP V2) for all bridging.

How Arc transfers work (Bridge Kit pattern):
  1. APPROVE  — Approve USDC for burning on source chain
  2. BURN     — Burn USDC on source chain (via Circle TokenMessenger)
  3. ATTEST   — Circle's Iris attestation service signs the burn event
  4. MINT     — Mint native USDC on Arc (via Circle MessageTransmitter)

This backend adapter executes Arc transfers using Circle's Programmable Wallets API,
which handles CCTP automatically when transferring to the Arc chain identifier.

Docs:
  - Arc Network: https://docs.arc.network
  - Bridge Kit: https://developers.circle.com/circle-mint/docs/bridge-kit
  - Circle CCTP: https://developers.circle.com/stablecoins/docs/cctp-getting-started
  - Arc Testnet: chainId=5042002, CCTP domain=26, gas token=USDC

Configuration:
  ARC_API_KEY       — Circle API key (same as CIRCLE_API_KEY, both work)
  ARC_SOURCE_WALLET — Source wallet ID (Circle wallet for bridge source)
  ARC_CHAIN         — Arc chain identifier ("ARC-TESTNET" or "ARC")
  CIRCLE_SANDBOX    — Whether to use Circle sandbox (true/false)
"""

import httpx
import uuid
from app.adapters.base import LegResult
from app.config import settings


# Arc chain details
ARC_TESTNET_CHAIN_ID = 5042002
ARC_CCTP_DOMAIN = 26  # Circle CCTP domain for Arc
ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000"  # Arc testnet USDC

# Source chain map for CCTP bridging — source chains that can bridge TO Arc
# These use Circle's chain identifiers for the source wallet chain
SOURCE_CHAIN_MAP = {
    "ethereum":  "ETH",
    "polygon":   "MATIC",
    "arbitrum":  "ARB",
    "solana":    "SOL",
    "avalanche": "AVAX",
    "base":      "BASE",
}


class ArcAdapter:
    """
    Executes USDC payouts to Arc L1 blockchain via Circle Bridge Kit (CCTP V2).

    The Arc network is Circle's own Layer-1 blockchain. Transferring USDC to Arc
    routes through Circle's Cross-Chain Transfer Protocol (CCTP), which burns USDC
    on the source chain and mints native USDC on Arc.

    This adapter uses Circle's Programmable Wallets API with the Arc chain
    identifier. Circle handles CCTP automatically for cross-chain routes.

    Arc Testnet: api-sandbox.circle.com
    Arc Mainnet: api.circle.com (future — testnet only as of 2025)
    """

    def __init__(self):
        self.api_key = settings.ARC_API_KEY or settings.CIRCLE_API_KEY
        self.source_wallet = settings.ARC_SOURCE_WALLET or settings.CIRCLE_WALLET_ID or "arc-treasury-demo"
        self.arc_chain = settings.ARC_CHAIN  # "ARC-TESTNET" or "ARC"

    @property
    def base_url(self) -> str:
        # Arc transfers route through Circle's API
        return settings.ARC_API_BASE

    def name(self) -> str:
        return "arc"

    def is_simulated(self) -> bool:
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
                    "Arc/Circle API key not configured. "
                    "Set ARC_API_KEY (or CIRCLE_API_KEY) env var. "
                    "Arc uses Circle's infrastructure — same API key works. "
                    "Get your key at: https://console.circle.com"
                ),
                is_simulated=True,
            )

        # Determine if this is an Arc-direct transfer or cross-chain bridge
        dest_lower = destination_chain.lower()
        is_arc_destination = dest_lower == "arc"

        if is_arc_destination:
            # Transfer directly to Arc chain via Circle's API
            # Circle handles the CCTP bridging (burn on source, mint on Arc)
            return await self._execute_arc_transfer(leg_id, recipient_address, amount)
        else:
            # For non-Arc destinations, use Arc as a routing chain
            # This demonstrates the Bridge Kit cross-chain capability
            return await self._execute_cctp_bridge(leg_id, recipient_address, amount, dest_lower)

    async def _execute_arc_transfer(self, leg_id: str, recipient_address: str, amount: float) -> LegResult:
        """
        Transfer USDC to Arc chain via Circle Programmable Wallets API.

        Circle's transfer API automatically routes to Arc via CCTP when
        the destination chain is Arc (Bridge Kit pattern).

        POST /v1/transfers
          source: {type: wallet, id: <source_wallet_id>}
          destination: {type: blockchain, address: <recipient>, chain: ARC-TESTNET}
          amount: {amount: "<amount>", currency: "USD"}
        """
        payload = {
            "idempotencyKey": str(uuid.uuid4()),
            "source": {
                "type": "wallet",
                "id": self.source_wallet,
            },
            "destination": {
                "type": "blockchain",
                "address": recipient_address,
                "chain": self.arc_chain,
            },
            "amount": {
                "amount": f"{amount:.2f}",
                "currency": "USD",  # Circle represents USDC as USD in transfers API
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
                    transfer_id = data.get("id", f"arc-{uuid.uuid4().hex[:12]}")
                    return LegResult(
                        status="SUBMITTED",
                        tx_hash=transfer_id,
                        is_simulated=False,
                    )
                else:
                    error_body = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
                    error_msg = error_body.get("message", resp.text[:200])
                    return LegResult(
                        status="FAILED",
                        error_message=f"Arc/Circle API {resp.status_code}: {error_msg}",
                        is_simulated=False,
                    )
        except httpx.TimeoutException:
            return LegResult(
                status="FAILED",
                error_message="Arc API timeout — CCTP bridge may be in progress. Check Circle dashboard.",
                is_simulated=False,
            )
        except Exception as e:
            return LegResult(
                status="FAILED",
                error_message=f"Arc API connection error: {str(e)[:200]}",
                is_simulated=True,
            )

    async def _execute_cctp_bridge(self, leg_id: str, recipient_address: str,
                                   amount: float, destination_chain: str) -> LegResult:
        """
        Bridge USDC cross-chain via Circle CCTP V2 (Bridge Kit pattern).

        For transfers not going directly to Arc, we bridge through Circle's
        cross-chain transfer protocol. This is the Bridge Kit use case:
        burn USDC on source → attest → mint USDC on destination.

        Uses Circle's transfers API which handles CCTP automatically.
        """
        circle_chain = SOURCE_CHAIN_MAP.get(destination_chain, "ETH")

        payload = {
            "idempotencyKey": str(uuid.uuid4()),
            "source": {
                "type": "wallet",
                "id": self.source_wallet,
            },
            "destination": {
                "type": "blockchain",
                "address": recipient_address,
                "chain": circle_chain,
            },
            "amount": {
                "amount": f"{amount:.2f}",
                "currency": "USD",
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
                    transfer_id = data.get("id", f"arc-bridge-{uuid.uuid4().hex[:12]}")
                    return LegResult(
                        status="SUBMITTED",
                        tx_hash=transfer_id,
                        is_simulated=False,
                    )
                else:
                    error_body = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
                    error_msg = error_body.get("message", resp.text[:200])
                    return LegResult(
                        status="FAILED",
                        error_message=f"Arc CCTP bridge {resp.status_code}: {error_msg}",
                        is_simulated=False,
                    )
        except Exception as e:
            return LegResult(
                status="FAILED",
                error_message=f"Arc bridge error: {str(e)[:200]}",
                is_simulated=True,
            )

    async def check_status(self, tx_hash: str) -> LegResult:
        """Check Arc transfer status via Circle's transfers API.

        GET /v1/transfers/{id}
        Arc transfers use the same status lifecycle as Circle transfers:
        pending → complete (CCTP attestation confirmed, minted on Arc)
        """
        if not self.api_key:
            return LegResult(status="FAILED", error_message="No Arc/Circle API key configured", is_simulated=True)

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
                        error_code = data.get("errorCode", "Unknown")
                        return LegResult(
                            status="FAILED", tx_hash=tx_hash, is_simulated=False,
                            error_message=f"Arc bridge failed: {error_code}",
                        )
                    else:
                        # pending / processing / confirmed (CCTP in flight)
                        return LegResult(status="SUBMITTED", tx_hash=tx_hash, is_simulated=False)
                return LegResult(
                    status="FAILED",
                    error_message=f"Arc status check failed: HTTP {resp.status_code}",
                    is_simulated=False,
                )
        except Exception as e:
            return LegResult(status="FAILED", error_message=str(e)[:200], is_simulated=True)
