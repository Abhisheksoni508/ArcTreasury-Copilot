"""Treasury Service — RWA-backed treasury reserves management.

Manages a treasury composed of:
  1. USDC liquid reserves (held in Circle developer-controlled wallet)
  2. Tokenized Real-World Assets (RWAs): T-Bills, Money Market Funds, Corporate Bonds
  3. Yield-bearing positions that back the treasury's payout capacity

Key concepts:
  - Reserve Ratio: Minimum % of treasury that must remain liquid USDC
  - Yield: Annual percentage yield earned on RWA positions
  - Rebalancing: Agent-driven reallocation between liquid USDC and RWA positions
  - Treasury Health: Overall score based on reserve ratio, diversification, yield

Circle integration points:
  - Circle Wallets API for USDC balance
  - Tokenized assets modeled as on-chain RWA positions trackable via Circle
  - Future: Circle CCTP for cross-chain RWA settlement
"""

import uuid
import json
from datetime import datetime, timezone
from typing import Optional
import aiosqlite

from app.config import settings
from app.services.audit_service import log_audit


# ── RWA Asset Catalog ────────────────────────────────────────────────────
# These represent tokenized real-world assets available for treasury allocation.
# In production, these would be on-chain tokenized securities (e.g., via Securitize, Ondo, Backed).

RWA_CATALOG = {
    "TBILL-6M": {
        "name": "US Treasury Bill (6-Month)",
        "symbol": "TBILL-6M",
        "category": "government_bond",
        "apy": 5.25,
        "risk_rating": "AAA",
        "maturity_days": 180,
        "min_investment": 1000.0,
        "issuer": "US Treasury (Tokenized via Circle)",
        "chain": "ARC-TESTNET",
        "description": "Tokenized 6-month US Treasury Bill. Highest safety, moderate yield.",
    },
    "MMF-USDC": {
        "name": "USDC Money Market Fund",
        "symbol": "MMF-USDC",
        "category": "money_market",
        "apy": 4.80,
        "risk_rating": "AA+",
        "maturity_days": 1,  # instant redemption
        "min_investment": 100.0,
        "issuer": "BlackRock Tokenized (via Circle)",
        "chain": "ARC-TESTNET",
        "description": "Tokenized money market fund denominated in USDC. Near-instant liquidity.",
    },
    "CORP-BOND-IG": {
        "name": "Investment Grade Corporate Bonds",
        "symbol": "CORP-BOND-IG",
        "category": "corporate_bond",
        "apy": 6.10,
        "risk_rating": "A",
        "maturity_days": 365,
        "min_investment": 5000.0,
        "issuer": "Multi-issuer Pool (Tokenized via Securitize)",
        "chain": "ARC-TESTNET",
        "description": "Diversified pool of investment-grade corporate bonds. Higher yield, longer lock.",
    },
    "RWA-RE-FUND": {
        "name": "Tokenized Real Estate Fund",
        "symbol": "RWA-RE-FUND",
        "category": "real_estate",
        "apy": 7.50,
        "risk_rating": "BBB+",
        "maturity_days": 730,
        "min_investment": 10000.0,
        "issuer": "RealT x Circle",
        "chain": "ARC-TESTNET",
        "description": "Fractional tokenized commercial real estate portfolio. Highest yield, longer horizon.",
    },
}

# Default treasury configuration
DEFAULT_MIN_RESERVE_RATIO = 0.20   # 20% must stay liquid USDC
DEFAULT_TARGET_RESERVE_RATIO = 0.30  # Target 30% liquid
DEFAULT_REBALANCE_THRESHOLD = 0.05   # Rebalance if ratio deviates by 5%


async def get_treasury_config(db: aiosqlite.Connection) -> dict:
    """Get treasury configuration from settings table."""
    cursor = await db.execute("SELECT value FROM settings WHERE key = 'treasury_config'")
    row = await cursor.fetchone()
    if row:
        return json.loads(row[0])
    return {
        "min_reserve_ratio": DEFAULT_MIN_RESERVE_RATIO,
        "target_reserve_ratio": DEFAULT_TARGET_RESERVE_RATIO,
        "rebalance_threshold": DEFAULT_REBALANCE_THRESHOLD,
    }


async def update_treasury_config(db: aiosqlite.Connection, config: dict) -> dict:
    """Update treasury configuration."""
    current = await get_treasury_config(db)
    current.update(config)
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('treasury_config', ?)",
        (json.dumps(current),),
    )
    await db.commit()
    return current


async def get_rwa_catalog() -> list[dict]:
    """Return available RWA assets for treasury allocation."""
    return list(RWA_CATALOG.values())


async def get_treasury_positions(db: aiosqlite.Connection) -> list[dict]:
    """Get all active treasury RWA positions."""
    cursor = await db.execute(
        """SELECT id, asset_symbol, asset_name, category, amount_usdc, shares,
                  apy, risk_rating, status, chain, tx_hash, allocated_at, updated_at
           FROM treasury_positions
           WHERE status IN ('ACTIVE', 'PENDING')
           ORDER BY allocated_at DESC"""
    )
    rows = await cursor.fetchall()
    return [
        {
            "id": row[0],
            "asset_symbol": row[1],
            "asset_name": row[2],
            "category": row[3],
            "amount_usdc": row[4],
            "shares": row[5],
            "apy": row[6],
            "risk_rating": row[7],
            "status": row[8],
            "chain": row[9],
            "tx_hash": row[10],
            "allocated_at": row[11],
            "updated_at": row[12],
            "current_value": row[4] * (1 + row[6] / 100 * _days_held(row[11]) / 365),
            "accrued_yield": row[4] * (row[6] / 100 * _days_held(row[11]) / 365),
        }
        for row in rows
    ]


def _days_held(allocated_at: str) -> float:
    """Calculate days since allocation."""
    try:
        alloc = datetime.fromisoformat(allocated_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return max(0, (now - alloc).total_seconds() / 86400)
    except Exception:
        return 0


async def allocate_to_rwa(
    db: aiosqlite.Connection,
    asset_symbol: str,
    amount_usdc: float,
) -> dict:
    """Allocate USDC from treasury liquid reserves into an RWA position.

    This simulates the on-chain flow:
      1. USDC is transferred from treasury wallet to RWA tokenization contract
      2. RWA tokens are minted and sent back to treasury wallet
      3. Position is tracked in treasury_positions table
    """
    asset = RWA_CATALOG.get(asset_symbol)
    if not asset:
        return {"error": f"Unknown asset: {asset_symbol}"}

    if amount_usdc < asset["min_investment"]:
        return {"error": f"Minimum investment for {asset_symbol} is ${asset['min_investment']:,.0f}"}

    now = datetime.now(timezone.utc).isoformat()
    position_id = f"pos-{uuid.uuid4().hex[:12]}"
    shares = amount_usdc / 1.0  # 1 share = 1 USDC at NAV

    # Simulate on-chain mint of RWA tokens
    tx_hash = f"0x{uuid.uuid4().hex}"

    await db.execute(
        """INSERT INTO treasury_positions
           (id, asset_symbol, asset_name, category, amount_usdc, shares, apy,
            risk_rating, status, chain, tx_hash, allocated_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)""",
        (position_id, asset_symbol, asset["name"], asset["category"],
         amount_usdc, shares, asset["apy"], asset["risk_rating"],
         asset["chain"], tx_hash, now, now),
    )

    await log_audit(db, "treasury", position_id, "RWA_ALLOCATE", "USDC",
                    f"{asset_symbol} ${amount_usdc:,.2f}",
                    f"Allocated ${amount_usdc:,.2f} to {asset['name']} (APY: {asset['apy']}%)")

    await db.commit()
    return {
        "position_id": position_id,
        "asset_symbol": asset_symbol,
        "asset_name": asset["name"],
        "amount_usdc": amount_usdc,
        "shares": shares,
        "apy": asset["apy"],
        "tx_hash": tx_hash,
        "status": "ACTIVE",
    }


async def redeem_rwa(db: aiosqlite.Connection, position_id: str) -> dict:
    """Redeem an RWA position back to USDC.

    Simulates:
      1. RWA tokens are burned on-chain
      2. USDC (principal + yield) is returned to treasury wallet
    """
    cursor = await db.execute(
        "SELECT id, asset_symbol, amount_usdc, apy, status, allocated_at FROM treasury_positions WHERE id = ?",
        (position_id,),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Position not found"}
    if row[4] != "ACTIVE":
        return {"error": f"Position is {row[4]}, cannot redeem"}

    principal = row[2]
    apy = row[3]
    days = _days_held(row[5])
    accrued_yield = principal * (apy / 100 * days / 365)
    total_return = principal + accrued_yield

    now = datetime.now(timezone.utc).isoformat()
    tx_hash = f"0x{uuid.uuid4().hex}"

    await db.execute(
        "UPDATE treasury_positions SET status = 'REDEEMED', updated_at = ? WHERE id = ?",
        (now, position_id),
    )

    await log_audit(db, "treasury", position_id, "RWA_REDEEM",
                    f"ACTIVE ${principal:,.2f}",
                    f"REDEEMED ${total_return:,.2f}",
                    f"Redeemed {row[1]}: principal=${principal:,.2f}, yield=${accrued_yield:,.2f}, total=${total_return:,.2f}")

    await db.commit()
    return {
        "position_id": position_id,
        "asset_symbol": row[1],
        "principal": principal,
        "accrued_yield": round(accrued_yield, 4),
        "total_return": round(total_return, 4),
        "tx_hash": tx_hash,
        "status": "REDEEMED",
    }


async def get_treasury_overview(db: aiosqlite.Connection) -> dict:
    """Comprehensive treasury overview: liquid USDC + RWA positions + health.

    This is the main treasury dashboard data source.
    """
    config = await get_treasury_config(db)
    positions = await get_treasury_positions(db)

    # Get USDC liquid balance from Circle wallet
    usdc_liquid = await _get_usdc_balance()

    # RWA totals
    total_rwa_principal = sum(p["amount_usdc"] for p in positions)
    total_rwa_current = sum(p["current_value"] for p in positions)
    total_accrued_yield = sum(p["accrued_yield"] for p in positions)

    # Total AUM (Assets Under Management)
    total_aum = usdc_liquid + total_rwa_current

    # Reserve ratio
    reserve_ratio = usdc_liquid / total_aum if total_aum > 0 else 1.0

    # Weighted average APY (based on total AUM so idle USDC dilutes yield)
    weighted_apy = 0
    if total_aum > 0:
        weighted_apy = sum(p["apy"] * p["amount_usdc"] for p in positions) / total_aum

    # Category breakdown
    categories = {}
    for p in positions:
        cat = p["category"]
        if cat not in categories:
            categories[cat] = {"count": 0, "principal": 0, "current_value": 0, "avg_apy": 0}
        categories[cat]["count"] += 1
        categories[cat]["principal"] += p["amount_usdc"]
        categories[cat]["current_value"] += p["current_value"]
    for cat in categories:
        if categories[cat]["count"] > 0:
            cat_positions = [p for p in positions if p["category"] == cat]
            categories[cat]["avg_apy"] = sum(p["apy"] for p in cat_positions) / len(cat_positions)

    # Health assessment
    health = _assess_treasury_health(reserve_ratio, config, len(categories), weighted_apy)

    return {
        "usdc_liquid": round(usdc_liquid, 4),
        "total_rwa_principal": round(total_rwa_principal, 4),
        "total_rwa_current_value": round(total_rwa_current, 4),
        "total_accrued_yield": round(total_accrued_yield, 4),
        "total_aum": round(total_aum, 4),
        "reserve_ratio": round(reserve_ratio, 4),
        "weighted_avg_apy": round(weighted_apy, 2),
        "position_count": len(positions),
        "positions": positions,
        "category_breakdown": categories,
        "config": config,
        "health": health,
    }


async def _get_usdc_balance() -> float:
    """Get liquid USDC balance from Circle wallet."""
    try:
        if settings.ADAPTER_MODE == "mock":
            return 50000.0  # Demo balance for mock mode

        from app.adapters.circle_adapter import CircleAdapter
        adapter = CircleAdapter()
        result = await adapter.get_wallet_balance()
        balances = result.get("balances", [])
        for b in balances:
            token = b.get("token", {})
            if token.get("symbol") in ("USDC", "USD"):
                return float(b.get("amount", 0))
        return 0.0
    except Exception:
        return 0.0


def _assess_treasury_health(
    reserve_ratio: float,
    config: dict,
    num_categories: int,
    avg_apy: float,
) -> dict:
    """Score treasury health on multiple dimensions."""
    min_ratio = config.get("min_reserve_ratio", DEFAULT_MIN_RESERVE_RATIO)

    # Liquidity score (0-100)
    if reserve_ratio >= min_ratio * 1.5:
        liquidity_score = 100
        liquidity_status = "excellent"
    elif reserve_ratio >= min_ratio:
        liquidity_score = 70
        liquidity_status = "healthy"
    elif reserve_ratio >= min_ratio * 0.5:
        liquidity_score = 40
        liquidity_status = "warning"
    else:
        liquidity_score = 10
        liquidity_status = "critical"

    # Diversification score
    diversification_score = min(100, num_categories * 25)
    diversification_status = "excellent" if diversification_score >= 75 else "good" if diversification_score >= 50 else "needs_improvement"

    # Yield score
    yield_score = min(100, int(avg_apy * 15))
    yield_status = "excellent" if yield_score >= 75 else "good" if yield_score >= 50 else "low"

    overall = int((liquidity_score + diversification_score + yield_score) / 3)

    return {
        "overall_score": overall,
        "overall_status": "excellent" if overall >= 80 else "healthy" if overall >= 60 else "warning" if overall >= 40 else "critical",
        "liquidity": {"score": liquidity_score, "status": liquidity_status, "reserve_ratio": round(reserve_ratio, 4), "min_required": min_ratio},
        "diversification": {"score": diversification_score, "status": diversification_status, "categories": num_categories},
        "yield": {"score": yield_score, "status": yield_status, "weighted_apy": round(avg_apy, 2)},
    }


async def auto_rebalance(db: aiosqlite.Connection) -> dict:
    """Agent-driven treasury rebalancing.

    If liquid USDC exceeds target reserve ratio, automatically allocate
    excess to the best-yield RWA. If below minimum, redeem lowest-yield position.
    """
    overview = await get_treasury_overview(db)
    config = overview["config"]
    reserve_ratio = overview["reserve_ratio"]
    target = config.get("target_reserve_ratio", DEFAULT_TARGET_RESERVE_RATIO)
    min_ratio = config.get("min_reserve_ratio", DEFAULT_MIN_RESERVE_RATIO)
    threshold = config.get("rebalance_threshold", DEFAULT_REBALANCE_THRESHOLD)

    actions = []

    if overview["total_aum"] == 0:
        return {"actions": [], "message": "No treasury assets to rebalance"}

    # Over-liquid: allocate excess to RWAs
    if reserve_ratio > target + threshold:
        excess = overview["usdc_liquid"] - (overview["total_aum"] * target)
        if excess > 100:  # Only rebalance if meaningful amount
            # Pick highest-yield asset we can afford
            best_asset = max(RWA_CATALOG.values(), key=lambda a: a["apy"])
            amount = min(excess, overview["usdc_liquid"] * 0.5)  # Don't allocate more than 50% at once
            if amount >= best_asset["min_investment"]:
                result = await allocate_to_rwa(db, best_asset["symbol"], round(amount, 2))
                actions.append({
                    "type": "ALLOCATE",
                    "asset": best_asset["symbol"],
                    "amount": round(amount, 2),
                    "result": result,
                })

    # Under-liquid: redeem positions to restore reserves
    elif reserve_ratio < min_ratio - threshold:
        deficit = (overview["total_aum"] * min_ratio) - overview["usdc_liquid"]
        if deficit > 0 and overview["positions"]:
            # Redeem lowest-yield position first
            sorted_positions = sorted(overview["positions"], key=lambda p: p["apy"])
            for pos in sorted_positions:
                if deficit <= 0:
                    break
                result = await redeem_rwa(db, pos["id"])
                actions.append({
                    "type": "REDEEM",
                    "position_id": pos["id"],
                    "asset": pos["asset_symbol"],
                    "amount": pos["current_value"],
                    "result": result,
                })
                deficit -= pos["current_value"]

    now = datetime.now(timezone.utc).isoformat()
    # Log rebalance event
    await db.execute(
        """INSERT INTO treasury_rebalance_history
           (id, reserve_ratio_before, reserve_ratio_after, actions_taken, triggered_by, created_at)
           VALUES (?, ?, ?, ?, 'auto', ?)""",
        (f"reb-{uuid.uuid4().hex[:12]}", reserve_ratio,
         overview["reserve_ratio"], json.dumps(actions), now),
    )
    await db.commit()

    return {
        "actions": actions,
        "reserve_ratio_before": round(reserve_ratio, 4),
        "message": f"Rebalance complete: {len(actions)} action(s) taken" if actions else "Treasury is within target range, no rebalancing needed",
    }


async def get_rebalance_history(db: aiosqlite.Connection, limit: int = 20) -> list[dict]:
    """Get treasury rebalance history."""
    cursor = await db.execute(
        """SELECT id, reserve_ratio_before, reserve_ratio_after, actions_taken,
                  triggered_by, created_at
           FROM treasury_rebalance_history
           ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    return [
        {
            "id": row[0],
            "reserve_ratio_before": row[1],
            "reserve_ratio_after": row[2],
            "actions_taken": json.loads(row[3]) if row[3] else [],
            "triggered_by": row[4],
            "created_at": row[5],
        }
        for row in rows
    ]


async def seed_treasury_positions(db: aiosqlite.Connection) -> list[dict]:
    """Seed demo RWA positions for showcase."""
    now = datetime.now(timezone.utc).isoformat()
    # Clear existing positions
    await db.execute("DELETE FROM treasury_positions")

    demo_positions = [
        ("TBILL-6M", 15000.0),
        ("MMF-USDC", 8000.0),
        ("CORP-BOND-IG", 12000.0),
        ("RWA-RE-FUND", 10000.0),
    ]

    results = []
    for symbol, amount in demo_positions:
        asset = RWA_CATALOG[symbol]
        position_id = f"pos-{uuid.uuid4().hex[:12]}"
        tx_hash = f"0x{uuid.uuid4().hex}"

        # Backdate allocations for yield accrual demo
        import random
        days_ago = random.randint(7, 90)
        alloc_time = datetime(2026, 2, 28, tzinfo=timezone.utc)
        from datetime import timedelta
        alloc_time = (alloc_time - timedelta(days=days_ago)).isoformat()

        await db.execute(
            """INSERT INTO treasury_positions
               (id, asset_symbol, asset_name, category, amount_usdc, shares, apy,
                risk_rating, status, chain, tx_hash, allocated_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)""",
            (position_id, symbol, asset["name"], asset["category"],
             amount, amount, asset["apy"], asset["risk_rating"],
             asset["chain"], tx_hash, alloc_time, now),
        )
        results.append({"position_id": position_id, "asset": symbol, "amount": amount})

    await db.commit()
    return results
