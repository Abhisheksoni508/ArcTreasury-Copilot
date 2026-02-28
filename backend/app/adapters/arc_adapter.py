"""Arc Bridge Kit adapter — cross-chain USDC payouts to Arc L1 via Circle CCTP.

Arc is Circle's EVM-compatible Layer-1 blockchain designed for stablecoin finance.
Arc uses Circle's Cross-Chain Transfer Protocol (CCTP V2) for all bridging.

This adapter executes Arc transfers using Circle's Programmable Wallets
createTransaction API with the ARC-TESTNET blockchain and tokenAddress.

Docs:
  - Arc Network: https://docs.arc.network
  - Circle Dev-Controlled Wallets: https://developers.circle.com/wallets/dev-controlled
  - Arc Testnet: chainId=5042002, CCTP domain=26, gas token=USDC

Configuration:
  ARC_API_KEY       — Circle API key (same as CIRCLE_API_KEY, both work)
  ARC_SOURCE_WALLET — Source wallet 0x address on Arc Testnet
  ARC_CHAIN         — Arc chain identifier ("ARC-TESTNET" or "ARC")
  CIRCLE_ENTITY_SECRET — 32-byte hex entity secret registered on Circle
"""

import httpx
import uuid
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from app.adapters.base import LegResult
from app.config import settings


# Arc chain details
ARC_TESTNET_CHAIN_ID = 5042002
ARC_CCTP_DOMAIN = 26  # Circle CCTP domain for Arc
ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000"  # Arc testnet USDC


class ArcAdapter:
    """
    Executes USDC payouts to Arc L1 blockchain via Circle's createTransaction API.

    Uses the same developer-controlled wallets API as CircleAdapter but
    always targets the Arc blockchain. Transfers to non-Arc destinations
    are routed through Arc regardless (single-chain demo).
    """

    def __init__(self):
        self.api_key = settings.ARC_API_KEY or settings.CIRCLE_API_KEY
        self.wallet_address = settings.ARC_SOURCE_WALLET
        self.entity_secret = settings.CIRCLE_ENTITY_SECRET
        self.arc_chain = settings.ARC_CHAIN  # "ARC-TESTNET" or "ARC"

    @property
    def base_url(self) -> str:
        # Circle unified API: TEST_API_KEY prefix auto-routes to testnet
        return "https://api.circle.com/v1/w3s"

    def name(self) -> str:
        return "arc"

    def is_simulated(self) -> bool:
        return not bool(self.api_key)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _get_entity_secret_ciphertext(self) -> str:
        """Encrypt the entity secret with Circle's RSA public key."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/config/entity/publicKey",
                headers=self._headers(),
                timeout=15.0,
            )
            resp.raise_for_status()
            public_key_pem = resp.json()["data"]["publicKey"]

        entity_secret_bytes = bytes.fromhex(self.entity_secret)
        public_key = serialization.load_pem_public_key(public_key_pem.encode())
        ciphertext = public_key.encrypt(
            entity_secret_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        return base64.b64encode(ciphertext).decode()

    async def execute(self, leg_id: str, recipient_address: str, amount: float,
                      destination_chain: str) -> LegResult:
        if not self.api_key:
            return LegResult(
                status="FAILED",
                error_message=(
                    "Arc/Circle API key not configured. "
                    "Set ARC_API_KEY (or CIRCLE_API_KEY) env var. "
                    "Get your key at: https://console.circle.com"
                ),
                is_simulated=True,
            )

        if not self.wallet_address:
            return LegResult(
                status="FAILED",
                error_message=(
                    "Arc source wallet not configured. "
                    "Set ARC_SOURCE_WALLET in .env (run scripts/create-wallet.ts first)."
                ),
                is_simulated=False,
            )

        if not self.entity_secret:
            return LegResult(
                status="FAILED",
                error_message="CIRCLE_ENTITY_SECRET not configured in .env.",
                is_simulated=False,
            )

        try:
            entity_secret_ciphertext = await self._get_entity_secret_ciphertext()

            # All transfers go through Arc Testnet (our wallet's blockchain)
            payload = {
                "idempotencyKey": str(uuid.uuid4()),
                "entitySecretCiphertext": entity_secret_ciphertext,
                "blockchain": self.arc_chain,
                "walletAddress": self.wallet_address,
                "amounts": [f"{amount:.2f}"],
                "destinationAddress": recipient_address,
                "tokenAddress": ARC_USDC_ADDRESS,
                "feeLevel": "MEDIUM",
            }

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}/developer/transactions/transfer",
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
                error_message="Arc API timeout — transfer may be in progress.",
                is_simulated=False,
            )
        except Exception as e:
            return LegResult(
                status="FAILED",
                error_message=f"Arc API error: {str(e)[:200]}",
                is_simulated=True,
            )

    async def check_status(self, tx_hash: str) -> LegResult:
        """Check transfer status via GET /v1/w3s/transactions/{id}"""
        if not self.api_key:
            return LegResult(status="FAILED", error_message="No Arc/Circle API key configured", is_simulated=True)

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/transactions/{tx_hash}",
                    headers=self._headers(),
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("transaction", {})
                    state = data.get("state", "INITIATED")
                    if state == "COMPLETE":
                        return LegResult(status="CONFIRMED", tx_hash=tx_hash, is_simulated=False)
                    elif state in ("FAILED", "DENIED"):
                        error_reason = data.get("errorReason", "Unknown error")
                        return LegResult(
                            status="FAILED", tx_hash=tx_hash, is_simulated=False,
                            error_message=f"Transfer failed: {error_reason}",
                        )
                    else:
                        return LegResult(status="SUBMITTED", tx_hash=tx_hash, is_simulated=False)
                return LegResult(
                    status="FAILED",
                    error_message=f"Arc status check failed: HTTP {resp.status_code}",
                    is_simulated=False,
                )
        except Exception as e:
            return LegResult(status="FAILED", error_message=str(e)[:200], is_simulated=True)
