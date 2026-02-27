"""Configuration and environment settings."""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./arctresury.db")
    DB_PATH: str = os.getenv("DB_PATH", "arctresury.db")

    # Adapter mode: "mock" | "circle" | "arc"
    ADAPTER_MODE: str = os.getenv("ADAPTER_MODE", "mock")

    # ── Circle API (Circle Gateway + Circle Wallets) ─────────────────────
    # Set CIRCLE_API_KEY to your Circle API key for real USDC payouts.
    # Circle Gateway docs: https://developers.circle.com/circle-mint/docs/circle-gateway
    # Circle Wallets docs: https://developers.circle.com/w3s/docs/overview
    CIRCLE_API_KEY: str = os.getenv("CIRCLE_API_KEY", "")

    # Circle Programmable Wallets: source wallet ID for treasury transfers.
    # Create a wallet via Circle dashboard and set its ID here.
    CIRCLE_WALLET_ID: str = os.getenv("CIRCLE_WALLET_ID", "")

    # Circle Entity Secret: required for developer-controlled wallet operations.
    CIRCLE_ENTITY_SECRET: str = os.getenv("CIRCLE_ENTITY_SECRET", "")

    # Use Circle sandbox (api-sandbox.circle.com) vs production (api.circle.com).
    # Defaults to sandbox=True for safe demo — set CIRCLE_SANDBOX=false for production.
    CIRCLE_SANDBOX: bool = os.getenv("CIRCLE_SANDBOX", "true").lower() != "false"

    @property
    def CIRCLE_API_BASE(self) -> str:
        if self.CIRCLE_SANDBOX:
            return "https://api-sandbox.circle.com/v1"
        return "https://api.circle.com/v1"

    # ── Arc Bridge Kit (Arc L1 Blockchain via Circle CCTP) ───────────────
    # Arc is Circle's EVM-compatible L1 blockchain.
    # Arc docs: https://docs.arc.network
    # Bridge Kit docs: https://developers.circle.com/circle-mint/docs/bridge-kit
    # Arc uses Circle's CCTP V2 for cross-chain USDC transfers (burn + mint).
    #
    # Arc Testnet: chainId=5042002, CCTP domain=26, gas token=USDC
    # Arc transfers route through Circle's existing API infrastructure.
    # Set ARC_API_KEY to your Circle API key (same key works for Arc).
    ARC_API_KEY: str = os.getenv("ARC_API_KEY", "")

    # Arc chain identifier used in Circle's API.
    # Testnet: "ARC-TESTNET" | Mainnet (future): "ARC"
    ARC_CHAIN: str = os.getenv("ARC_CHAIN", "ARC-TESTNET")

    # Arc CCTP domain for cross-chain attestation
    ARC_CCTP_DOMAIN: int = int(os.getenv("ARC_CCTP_DOMAIN", "26"))

    # Source wallet for Arc bridge transfers (same as Circle wallet or a dedicated one)
    ARC_SOURCE_WALLET: str = os.getenv("ARC_SOURCE_WALLET", "")

    @property
    def ARC_API_BASE(self) -> str:
        # Arc transfers go through Circle's API infrastructure (not api.arc.market)
        # The Arc network is accessed via Circle's Programmable Wallets API
        if self.CIRCLE_SANDBOX:
            return "https://api-sandbox.circle.com/v1"
        return "https://api.circle.com/v1"

    # ── Policy thresholds ────────────────────────────────────────────────
    POLICY_MAX_AMOUNT: float = float(os.getenv("POLICY_MAX_AMOUNT", "25000"))
    POLICY_VELOCITY_LIMIT: int = int(os.getenv("POLICY_VELOCITY_LIMIT", "5"))

    # Supported chains (including Arc testnet)
    SUPPORTED_CHAINS: list[str] = [
        "ethereum", "polygon", "arbitrum", "solana", "avalanche", "base", "arc"
    ]

    # Treasury wallet address (for display; actual transfers use CIRCLE_WALLET_ID)
    TREASURY_WALLET: str = os.getenv("TREASURY_WALLET", "0xTREASURY_DEMO_WALLET_001")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))


settings = Settings()
