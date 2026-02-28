"""Circle W3S adapter — real USDC payouts via Circle Developer-Controlled Wallets.

Uses Circle's Web3 Services (W3S) Programmable Wallets API:
  Transfer:    POST /v1/w3s/developer/transactions/transfer
  Status:      GET  /v1/w3s/transactions/{id}
  Public key:  GET  /v1/w3s/config/entity/publicKey
  Token list:  GET  /v1/w3s/tokens

Every request to the W3S API for developer-controlled wallets requires an
entitySecretCiphertext — the 32-byte entity secret encrypted with Circle's
RSA public key (RSA-OAEP / SHA-256), then Base64-encoded.

Docs:
  - W3S overview:   https://developers.circle.com/w3s/docs/overview
  - Transfer API:   https://developers.circle.com/w3s/reference/createtransaction
  - Entity secret:  https://developers.circle.com/w3s/developer-controlled-create-your-first-wallet

Configuration:
  CIRCLE_API_KEY       — Your Circle API key (required)
  CIRCLE_WALLET_ID     — Developer-controlled wallet UUID from Circle console (required)
  CIRCLE_ENTITY_SECRET — 32-byte hex entity secret registered on Circle (required)
  CIRCLE_SANDBOX       — "true" for sandbox (api-sandbox.circle.com), default true
"""

import httpx
import uuid
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from app.adapters.base import LegResult
from app.config import settings


# Circle W3S blockchain identifiers
# Sandbox uses testnet chains; production uses mainnet chains
CHAIN_MAP_SANDBOX = {
    "ethereum":  "ETH-SEPOLIA",
    "polygon":   "MATIC-AMOY",
    "arbitrum":  "ARB-SEPOLIA",
    "solana":    "SOL-DEVNET",
    "avalanche": "AVAX-FUJI",
    "base":      "BASE-SEPOLIA",
    "arc":       "ARC-TESTNET",
}

CHAIN_MAP_PROD = {
    "ethereum":  "ETH",
    "polygon":   "MATIC",
    "arbitrum":  "ARB",
    "solana":    "SOL",
    "avalanche": "AVAX",
    "base":      "BASE",
    "arc":       settings.ARC_CHAIN,
}


# Known USDC token addresses per blockchain (used in createTransaction API)
USDC_TOKEN_ADDRESS = {
    "ARC-TESTNET": "0x3600000000000000000000000000000000000000",
    # Add mainnet/other testnet token addresses as needed
}


class CircleAdapter:
    """
    Executes USDC payouts via Circle's W3S Developer-Controlled Wallets API.

    Each transfer call:
      1. Fetches Circle's RSA public key
      2. Encrypts the entity secret (RSA-OAEP / SHA-256) → entitySecretCiphertext
      3. POSTs to /v1/w3s/developer/transactions/transfer using walletAddress + tokenAddress

    Requires CIRCLE_API_KEY, CIRCLE_WALLET_ID, CIRCLE_ENTITY_SECRET, ARC_SOURCE_WALLET in .env.
    """

    def __init__(self):
        self.api_key = settings.CIRCLE_API_KEY
        self.wallet_id = settings.CIRCLE_WALLET_ID
        self.wallet_address = settings.ARC_SOURCE_WALLET  # 0x address
        self.entity_secret = settings.CIRCLE_ENTITY_SECRET
        self.blockchain = settings.ARC_CHAIN  # e.g. ARC-TESTNET

    @property
    def base_url(self) -> str:
        # Circle's unified API: TEST_API_KEY prefix auto-routes to testnet
        return "https://api.circle.com/v1/w3s"

    def name(self) -> str:
        return "circle"

    def is_simulated(self) -> bool:
        return not bool(self.api_key)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _get_entity_secret_ciphertext(self) -> str:
        """
        Encrypt the entity secret with Circle's RSA public key.

        Fetches Circle's current public key, then encrypts the 32-byte entity
        secret using RSA-OAEP with SHA-256 and returns the Base64-encoded result.
        The output is always 684 characters long.
        """
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
                    "Circle API key not configured. "
                    "Set CIRCLE_API_KEY in .env. "
                    "Get your key at: https://console.circle.com"
                ),
                is_simulated=True,
            )

        if not self.wallet_address:
            return LegResult(
                status="FAILED",
                error_message=(
                    "Wallet address not configured. "
                    "Set ARC_SOURCE_WALLET in .env (run scripts/create-wallet.ts first)."
                ),
                is_simulated=False,
            )

        if not self.entity_secret:
            return LegResult(
                status="FAILED",
                error_message=(
                    "Circle entity secret not configured. "
                    "Set CIRCLE_ENTITY_SECRET in .env."
                ),
                is_simulated=False,
            )

        # All transfers go through ARC-TESTNET (our wallet's blockchain)
        blockchain = self.blockchain
        token_address = USDC_TOKEN_ADDRESS.get(blockchain)
        if not token_address:
            return LegResult(
                status="FAILED",
                error_message=f"No USDC token address configured for chain '{blockchain}'.",
                is_simulated=False,
            )

        try:
            entity_secret_ciphertext = await self._get_entity_secret_ciphertext()

            # New Circle API: uses walletAddress + tokenAddress + blockchain
            payload = {
                "idempotencyKey": str(uuid.uuid4()),
                "entitySecretCiphertext": entity_secret_ciphertext,
                "blockchain": blockchain,
                "walletAddress": self.wallet_address,
                "amounts": [f"{amount:.2f}"],
                "destinationAddress": recipient_address,
                "tokenAddress": token_address,
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
                    transfer_id = data.get("id", f"circle-{uuid.uuid4().hex[:12]}")
                    return LegResult(
                        status="SUBMITTED",
                        tx_hash=transfer_id,
                        is_simulated=False,
                    )
                else:
                    is_json = resp.headers.get("content-type", "").startswith("application/json")
                    error_body = resp.json() if is_json else {}
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
                error_message=f"Circle API error: {str(e)[:200]}",
                is_simulated=True,
            )

    async def check_status(self, tx_hash: str) -> LegResult:
        """Check transfer status via GET /v1/w3s/transactions/{id}"""
        if not self.api_key:
            return LegResult(status="FAILED", error_message="No Circle API key configured", is_simulated=True)

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
                        # INITIATED, QUEUED, SENT, CONFIRMED (not yet COMPLETE)
                        return LegResult(status="SUBMITTED", tx_hash=tx_hash, is_simulated=False)
                return LegResult(
                    status="FAILED",
                    error_message=f"Circle status check failed: HTTP {resp.status_code}",
                    is_simulated=False,
                )
        except Exception as e:
            return LegResult(status="FAILED", error_message=str(e)[:200], is_simulated=True)

    # ── Developer-Controlled Wallet provisioning ─────────────────────────

    async def create_wallet_set(self, name: str = "ArcTreasury") -> dict:
        """Create a Circle developer-controlled wallet set.

        POST /v1/w3s/developer/walletSets
        Returns the new wallet set object with its ``id``.
        """
        entity_secret_ciphertext = await self._get_entity_secret_ciphertext()
        payload = {
            "idempotencyKey": str(uuid.uuid4()),
            "entitySecretCiphertext": entity_secret_ciphertext,
            "name": name,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/developer/walletSets",
                headers=self._headers(),
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json().get("data", {}).get("walletSet", {})

    async def create_wallet(
        self,
        wallet_set_id: str,
        blockchains: list[str] | None = None,
        name: str = "ArcTreasury Treasury Wallet",
    ) -> list[dict]:
        """Create developer-controlled wallet(s) inside a wallet set.

        POST /v1/w3s/developer/wallets
        ``blockchains`` defaults to ETH-SEPOLIA (sandbox) or ETH (prod).
        Returns a list of wallet objects, each with ``id`` and ``address``.
        """
        if blockchains is None:
            blockchains = ["ETH-SEPOLIA"] if self.base_url.endswith("sandbox.circle.com/v1/w3s") or "sandbox" in self.base_url else ["ETH"]

        entity_secret_ciphertext = await self._get_entity_secret_ciphertext()
        payload = {
            "idempotencyKey": str(uuid.uuid4()),
            "entitySecretCiphertext": entity_secret_ciphertext,
            "walletSetId": wallet_set_id,
            "blockchains": blockchains,
            "count": 1,
            "metadata": [{"name": name, "refId": f"arctresury-{uuid.uuid4().hex[:8]}"}],
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/developer/wallets",
                headers=self._headers(),
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json().get("data", {}).get("wallets", [])

    async def list_wallets(self, wallet_set_id: str | None = None) -> list[dict]:
        """List developer-controlled wallets for the entity.

        GET /v1/w3s/wallets
        Optionally filtered by walletSetId.
        """
        params: dict = {}
        if wallet_set_id:
            params["walletSetId"] = wallet_set_id
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/wallets",
                headers=self._headers(),
                params=params,
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json().get("data", {}).get("wallets", [])

    async def get_wallet_balance(self) -> dict:
        """Fetch treasury wallet balances from Circle W3S API.

        GET /v1/w3s/wallets/{wallet_id}/balances
        """
        if not self.api_key or not self.wallet_id:
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
