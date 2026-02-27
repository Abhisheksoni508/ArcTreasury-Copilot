"""Configuration and environment settings."""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./arctresury.db")
    DB_PATH: str = os.getenv("DB_PATH", "arctresury.db")

    # Adapter mode: "mock" | "circle" | "arc"
    ADAPTER_MODE: str = os.getenv("ADAPTER_MODE", "mock")

    # Circle API (optional - for real integration)
    CIRCLE_API_KEY: str = os.getenv("CIRCLE_API_KEY", "")
    CIRCLE_API_BASE: str = os.getenv("CIRCLE_API_BASE", "https://api.circle.com/v1")

    # Arc API (optional - for real integration)
    ARC_API_KEY: str = os.getenv("ARC_API_KEY", "")
    ARC_API_BASE: str = os.getenv("ARC_API_BASE", "https://api.arc.market/v1")

    # Policy thresholds
    POLICY_MAX_AMOUNT: float = float(os.getenv("POLICY_MAX_AMOUNT", "25000"))
    POLICY_VELOCITY_LIMIT: int = int(os.getenv("POLICY_VELOCITY_LIMIT", "5"))

    # Supported chains
    SUPPORTED_CHAINS: list[str] = ["ethereum", "polygon", "arbitrum", "solana", "avalanche", "base"]

    # Treasury wallet (hardcoded for demo)
    TREASURY_WALLET: str = "0xTREASURY_DEMO_WALLET_001"

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))


settings = Settings()
