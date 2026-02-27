"""Circle Developer-Controlled Wallet provisioning routes.

Implements the Circle quickstart flow:
  1. POST /api/wallets/setup  — create wallet set + wallet, persist CIRCLE_WALLET_ID
  2. GET  /api/wallets         — list wallets for the entity
  3. GET  /api/wallets/balance — fetch token balances for the configured treasury wallet

Docs: https://developers.circle.com/w3s/docs/developer-controlled-create-your-first-wallet
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.adapters.circle_adapter import CircleAdapter
from app.config import settings

router = APIRouter()


class WalletSetupRequest(BaseModel):
    wallet_set_name: str = "ArcTreasury"
    wallet_name: str = "ArcTreasury Treasury Wallet"
    # Blockchains to create the wallet on.
    # Defaults to ETH-SEPOLIA in sandbox or ETH in production.
    blockchains: list[str] | None = None


class WalletSetupResponse(BaseModel):
    wallet_set_id: str
    wallet_id: str
    address: str
    blockchain: str
    message: str


@router.post("/wallets/setup", response_model=WalletSetupResponse, tags=["Wallets"])
async def setup_wallet(req: WalletSetupRequest):
    """Create a Circle developer-controlled wallet set and wallet.

    Follows the Circle Developer-Controlled Wallets quickstart:
      1. POST /v1/w3s/developer/walletSets  → wallet_set_id
      2. POST /v1/w3s/developer/wallets     → wallet_id + address

    The returned ``wallet_id`` is stored in memory as CIRCLE_WALLET_ID so that
    subsequent payout executions pick it up without a restart.  Persist it in
    your .env (CIRCLE_WALLET_ID=<wallet_id>) for durability.
    """
    if not settings.CIRCLE_API_KEY:
        raise HTTPException(status_code=400, detail="CIRCLE_API_KEY not configured in .env")
    if not settings.CIRCLE_ENTITY_SECRET:
        raise HTTPException(status_code=400, detail="CIRCLE_ENTITY_SECRET not configured in .env")

    adapter = CircleAdapter()

    try:
        # Step 1 — Create wallet set
        wallet_set = await adapter.create_wallet_set(name=req.wallet_set_name)
        wallet_set_id: str = wallet_set.get("id", "")
        if not wallet_set_id:
            raise HTTPException(status_code=502, detail=f"Wallet set creation returned no id: {wallet_set}")

        # Step 2 — Create wallet inside the wallet set
        wallets = await adapter.create_wallet(
            wallet_set_id=wallet_set_id,
            blockchains=req.blockchains,
            name=req.wallet_name,
        )
        if not wallets:
            raise HTTPException(status_code=502, detail="Wallet creation returned empty list")

        wallet = wallets[0]
        wallet_id: str = wallet.get("id", "")
        address: str = wallet.get("address", "")
        blockchain: str = wallet.get("blockchain", "")

        # Persist in-memory so payout execution uses it immediately
        settings.CIRCLE_WALLET_ID = wallet_id

        return WalletSetupResponse(
            wallet_set_id=wallet_set_id,
            wallet_id=wallet_id,
            address=address,
            blockchain=blockchain,
            message=(
                f"Wallet created. Add to .env: CIRCLE_WALLET_ID={wallet_id}  "
                f"TREASURY_WALLET={address}"
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Circle API error: {str(exc)[:300]}")


@router.get("/wallets", tags=["Wallets"])
async def list_wallets(wallet_set_id: str | None = None):
    """List developer-controlled wallets for this Circle entity.

    Optionally filter by wallet_set_id query param.
    """
    if not settings.CIRCLE_API_KEY:
        raise HTTPException(status_code=400, detail="CIRCLE_API_KEY not configured in .env")

    adapter = CircleAdapter()
    try:
        wallets = await adapter.list_wallets(wallet_set_id=wallet_set_id)
        return {
            "wallets": wallets,
            "configured_wallet_id": settings.CIRCLE_WALLET_ID or None,
            "sandbox": settings.CIRCLE_SANDBOX,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Circle API error: {str(exc)[:300]}")


@router.get("/wallets/balance", tags=["Wallets"])
async def wallet_balance():
    """Fetch token balances for the configured treasury wallet (CIRCLE_WALLET_ID)."""
    if not settings.CIRCLE_API_KEY:
        raise HTTPException(status_code=400, detail="CIRCLE_API_KEY not configured in .env")
    if not settings.CIRCLE_WALLET_ID:
        raise HTTPException(
            status_code=400,
            detail=(
                "CIRCLE_WALLET_ID not set. "
                "Call POST /api/wallets/setup first or set CIRCLE_WALLET_ID in .env."
            ),
        )

    adapter = CircleAdapter()
    result = await adapter.get_wallet_balance()
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result
