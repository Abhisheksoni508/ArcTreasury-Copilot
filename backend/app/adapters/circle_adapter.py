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


class CircleAdapter:
    """
    Executes USDC payouts via Circle's W3S Developer-Controlled Wallets API.

    Each transfer call:
      1. Fetches Circle's RSA public key
      2. Encrypts the entity secret (RSA-OAEP / SHA-256) → entitySecretCiphertext
      3. Looks up the USDC token ID for the target blockchain
      4. POSTs to /v1/w3s/developer/transactions/transfer

    Requires CIRCLE_API_KEY, CIRCLE_WALLET_ID, and CIRCLE_ENTITY_SECRET in .env.
    CIRCLE_WALLET_ID is the UUID shown in Circle console (not the 0x blockchain address).
    """

    def __init__(self):
        self.api_key = settings.CIRCLE_API_KEY
        self.wallet_id = settings.CIRCLE_WALLET_ID
        self.entity_secret = settings.CIRCLE_ENTITY_SECRET

    @property
    def base_url(self) -> str:
        if settings.CIRCLE_SANDBOX:
            return "https://api-sandbox.circle.com/v1/w3s"
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

    async def _get_usdc_token_id(self, blockchain: str) -> str | None:
        """
        Look up the USDC token ID for a given blockchain via Circle's tokens API.

        GET /v1/w3s/tokens?blockchain={blockchain}
        Returns the token UUID needed for the transfer payload.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/tokens",
                headers=self._headers(),
                params={"blockchain": blockchain},
                timeout=15.0,
            )
            if resp.status_code == 200:
                tokens = resp.json().get("data", {}).get("tokens", [])
                for token in tokens:
                    if token.get("symbol", "").upper() in ("USDC", "USD"):
                        return token.get("id")
        return None

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

        if not self.wallet_id:
            return LegResult(
                status="FAILED",
                error_message=(
                    "Circle wallet ID not configured. "
                    "Set CIRCLE_WALLET_ID in .env with the UUID from Circle console "
                    "(Programmable Wallets → your wallet → copy the ID, not the 0x address)."
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

        chain_map = CHAIN_MAP_SANDBOX if settings.CIRCLE_SANDBOX else CHAIN_MAP_PROD
        blockchain = chain_map.get(destination_chain.lower(), "ETH-SEPOLIA")

        try:
            entity_secret_ciphertext = await self._get_entity_secret_ciphertext()

            token_id = await self._get_usdc_token_id(blockchain)
            if not token_id:
                return LegResult(
                    status="FAILED",
                    error_message=(
                        f"No USDC token found for chain '{blockchain}'. "
                        f"Verify Circle sandbox supports this chain."
                    ),
                    is_simulated=False,
                )

            payload = {
                "idempotencyKey": str(uuid.uuid4()),
                "entitySecretCiphertext": entity_secret_ciphertext,
                "walletId": self.wallet_id,
                "amounts": [f"{amount:.2f}"],
                "destinationAddress": recipient_address,
                "tokenId": token_id,
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
