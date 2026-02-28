"""Circle Gateway Service — Fiat on/off ramp for USDC treasury operations.

Circle Gateway (formerly Circle Payments) enables:
  - Fiat → USDC on-ramp: Convert USD/EUR/GBP bank deposits to USDC
  - USDC → Fiat off-ramp: Convert USDC back to fiat for bank withdrawal
  - Wire transfers, ACH, SEPA support

Integration points:
  - POST /v1/businessAccount/banks/wires     — Create wire deposit instructions
  - POST /v1/businessAccount/payouts          — Initiate fiat payout from USDC
  - GET  /v1/businessAccount/balances         — Get fiat + crypto balances
  - POST /v1/businessAccount/transfers        — Internal USDC transfer

Docs: https://developers.circle.com/circle-mint/docs/circle-gateway

Note: Full Gateway integration requires a Circle Business Account.
For this hackathon, we model the Gateway flow and provide reference endpoints.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
import json
import aiosqlite

from app.config import settings
from app.services.audit_service import log_audit


# ── FX Rates (mid-market approximations for demo) ────────────────────────
# In production, these would be fetched from a live FX feed or Circle's rates.
FX_RATES_TO_USD: dict[str, float] = {
    "USD": 1.0,
    "EUR": 1.08,    # 1 EUR = 1.08 USD
    "GBP": 1.27,    # 1 GBP = 1.27 USD
    "SGD": 0.74,    # 1 SGD = 0.74 USD
}

def _convert_to_usd(amount: float, currency: str) -> float:
    """Convert a fiat amount to USD equivalent."""
    rate = FX_RATES_TO_USD.get(currency, 1.0)
    return round(amount * rate, 2)

def _convert_from_usd(amount_usd: float, currency: str) -> float:
    """Convert a USD amount to target fiat currency."""
    rate = FX_RATES_TO_USD.get(currency, 1.0)
    return round(amount_usd / rate, 2)


# ── Gateway Configuration ────────────────────────────────────────────────

SUPPORTED_FIAT_CURRENCIES = ["USD", "EUR", "GBP", "SGD"]

PAYMENT_RAILS = {
    "wire": {
        "name": "Wire Transfer",
        "currencies": ["USD", "EUR", "GBP", "SGD"],
        "min_amount": 100.0,
        "max_amount": 1000000.0,
        "estimated_time": "1-2 business days",
        "fee_percent": 0.1,
    },
    "ach": {
        "name": "ACH Transfer",
        "currencies": ["USD"],
        "min_amount": 10.0,
        "max_amount": 100000.0,
        "estimated_time": "2-3 business days",
        "fee_percent": 0.0,
    },
    "sepa": {
        "name": "SEPA Transfer",
        "currencies": ["EUR"],
        "min_amount": 10.0,
        "max_amount": 500000.0,
        "estimated_time": "1-2 business days",
        "fee_percent": 0.0,
    },
}


def get_gateway_info() -> dict:
    """Return Circle Gateway configuration and supported rails."""
    return {
        "provider": "Circle Gateway",
        "description": "Fiat on/off ramp for USDC treasury operations",
        "supported_currencies": SUPPORTED_FIAT_CURRENCIES,
        "payment_rails": PAYMENT_RAILS,
        "fx_rates": FX_RATES_TO_USD,
        "docs_url": "https://developers.circle.com/circle-mint/docs/circle-gateway",
        "features": [
            "Fiat → USDC on-ramp (bank deposit → mint USDC)",
            "USDC → Fiat off-ramp (burn USDC → bank withdrawal)",
            "Multi-currency support (USD, EUR, GBP, SGD)",
            "Wire, ACH, SEPA payment rails",
            "API-driven programmatic conversions",
            "Compliance & KYB built-in",
        ],
        "treasury_integration": {
            "on_ramp_flow": [
                "1. Treasury manager initiates fiat deposit via Gateway API",
                "2. Circle provides wire/ACH instructions for bank transfer",
                "3. Bank sends fiat to Circle's custodial account",
                "4. Circle mints equivalent USDC to treasury wallet",
                "5. USDC available for payouts or RWA allocation",
            ],
            "off_ramp_flow": [
                "1. Treasury manager initiates USDC → fiat conversion",
                "2. USDC is burned from treasury wallet",
                "3. Circle initiates fiat wire/ACH to destination bank",
                "4. Funds arrive in 1-3 business days",
            ],
        },
    }


async def create_deposit_intent(
    db: aiosqlite.Connection,
    amount: float,
    currency: str = "USD",
    rail: str = "wire",
) -> dict:
    """Create a fiat-to-USDC deposit intent via Circle Gateway.

    In production, this calls Circle's API to generate bank deposit instructions.
    For the hackathon, we model the flow with mock wire instructions.
    """
    if currency not in SUPPORTED_FIAT_CURRENCIES:
        return {"error": f"Currency {currency} not supported. Use: {SUPPORTED_FIAT_CURRENCIES}"}

    rail_config = PAYMENT_RAILS.get(rail)
    if not rail_config:
        return {"error": f"Payment rail '{rail}' not supported. Use: {list(PAYMENT_RAILS.keys())}"}

    if currency not in rail_config["currencies"]:
        return {"error": f"{rail} does not support {currency}. Supported: {rail_config['currencies']}"}

    if amount < rail_config["min_amount"]:
        return {"error": f"Minimum for {rail}: {currency} {rail_config['min_amount']:,.2f}"}

    fee = round(amount * rail_config["fee_percent"] / 100, 2)
    net_fiat = round(amount - fee, 2)
    # Convert to USD first, then that's the USDC amount (1 USD = 1 USDC)
    usd_equivalent = _convert_to_usd(net_fiat, currency)
    usdc_amount = usd_equivalent

    intent_id = f"dep-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    # Create deposit record
    await db.execute(
        """INSERT INTO gateway_transactions
           (id, type, fiat_amount, fiat_currency, usdc_amount, fee, rail, status,
            bank_instructions, created_at, updated_at)
           VALUES (?, 'DEPOSIT', ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)""",
        (intent_id, amount, currency, usdc_amount, fee, rail,
         json.dumps(_generate_wire_instructions(intent_id, amount, currency)),
         now, now),
    )
    await log_audit(db, "gateway", intent_id, "DEPOSIT_INTENT",
                    f"{currency} {amount:,.2f}", f"USDC {usdc_amount:,.2f}",
                    f"Fiat deposit via {rail}: {currency} {amount:,.2f} (USD {usd_equivalent:,.2f}) → {usdc_amount:,.2f} USDC")
    await db.commit()

    fx_note = f" (FX rate: 1 {currency} = {FX_RATES_TO_USD.get(currency, 1.0)} USD)" if currency != "USD" else ""

    return {
        "intent_id": intent_id,
        "type": "DEPOSIT",
        "fiat_amount": amount,
        "fiat_currency": currency,
        "usd_equivalent": usd_equivalent,
        "usdc_amount": usdc_amount,
        "fee": fee,
        "fee_currency": currency,
        "fx_rate": FX_RATES_TO_USD.get(currency, 1.0),
        "rail": rail,
        "estimated_time": rail_config["estimated_time"],
        "status": "PENDING",
        "bank_instructions": _generate_wire_instructions(intent_id, amount, currency),
        "message": f"Send {currency} {amount:,.2f} via {rail_config['name']}{fx_note}. {usdc_amount:,.2f} USDC will be minted upon receipt.",
    }


async def create_withdrawal_intent(
    db: aiosqlite.Connection,
    amount_usdc: float,
    currency: str = "USD",
    rail: str = "wire",
    bank_account: Optional[str] = None,
) -> dict:
    """Create a USDC-to-fiat withdrawal intent via Circle Gateway.

    In production, this triggers USDC burn + fiat wire to the destination bank.
    """
    if currency not in SUPPORTED_FIAT_CURRENCIES:
        return {"error": f"Currency {currency} not supported"}

    rail_config = PAYMENT_RAILS.get(rail)
    if not rail_config:
        return {"error": f"Payment rail '{rail}' not supported"}

    fee_usdc = round(amount_usdc * rail_config["fee_percent"] / 100, 2)
    net_usdc = round(amount_usdc - fee_usdc, 2)
    # Convert from USD (USDC) to target fiat currency
    fiat_amount = _convert_from_usd(net_usdc, currency)

    intent_id = f"wd-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    await db.execute(
        """INSERT INTO gateway_transactions
           (id, type, fiat_amount, fiat_currency, usdc_amount, fee, rail, status,
            bank_instructions, created_at, updated_at)
           VALUES (?, 'WITHDRAWAL', ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)""",
        (intent_id, fiat_amount, currency, amount_usdc, fee_usdc, rail,
         json.dumps({"bank_account": bank_account or "****1234", "reference": intent_id}),
         now, now),
    )
    await log_audit(db, "gateway", intent_id, "WITHDRAWAL_INTENT",
                    f"USDC {amount_usdc:,.2f}", f"{currency} {fiat_amount:,.2f}",
                    f"Fiat withdrawal via {rail}: {amount_usdc:,.2f} USDC → {currency} {fiat_amount:,.2f}")
    await db.commit()

    fx_note = f" (FX rate: 1 USD = {round(1/FX_RATES_TO_USD.get(currency, 1.0), 4)} {currency})" if currency != "USD" else ""

    return {
        "intent_id": intent_id,
        "type": "WITHDRAWAL",
        "usdc_amount": amount_usdc,
        "fiat_amount": fiat_amount,
        "fiat_currency": currency,
        "fee": fee_usdc,
        "fx_rate": FX_RATES_TO_USD.get(currency, 1.0),
        "rail": rail,
        "estimated_time": rail_config["estimated_time"],
        "status": "PENDING",
        "message": f"{amount_usdc:,.2f} USDC will be burned. {currency} {fiat_amount:,.2f} sent via {rail_config['name']}{fx_note}.",
    }


async def simulate_deposit_complete(db: aiosqlite.Connection, intent_id: str) -> dict:
    """Simulate a deposit completing (for demo purposes).

    In production, Circle would webhook us when the bank transfer arrives
    and USDC is minted to our wallet.
    """
    now = datetime.now(timezone.utc).isoformat()
    cursor = await db.execute(
        "SELECT id, usdc_amount, fiat_currency, fiat_amount, status FROM gateway_transactions WHERE id = ?",
        (intent_id,),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Intent not found"}
    if row[4] != "PENDING":
        return {"error": f"Intent is {row[4]}, cannot complete"}

    await db.execute(
        "UPDATE gateway_transactions SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
        (now, intent_id),
    )
    await log_audit(db, "gateway", intent_id, "DEPOSIT_COMPLETE",
                    "PENDING", "COMPLETED",
                    f"Deposit completed: {row[2]} {row[3]:,.2f} → {row[1]:,.2f} USDC minted to treasury")
    await db.commit()

    return {
        "intent_id": intent_id,
        "status": "COMPLETED",
        "usdc_minted": row[1],
        "message": f"{row[1]:,.2f} USDC minted to treasury wallet",
    }


async def get_gateway_transactions(db: aiosqlite.Connection, limit: int = 50) -> list[dict]:
    """Get all gateway transactions."""
    cursor = await db.execute(
        """SELECT id, type, fiat_amount, fiat_currency, usdc_amount, fee, rail,
                  status, created_at, updated_at
           FROM gateway_transactions
           ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    return [
        {
            "id": row[0],
            "type": row[1],
            "fiat_amount": row[2],
            "fiat_currency": row[3],
            "usdc_amount": row[4],
            "fee": row[5],
            "rail": row[6],
            "status": row[7],
            "created_at": row[8],
            "updated_at": row[9],
        }
        for row in rows
    ]


def _generate_wire_instructions(intent_id: str, amount: float, currency: str) -> dict:
    """Generate mock wire deposit instructions (Circle Gateway would provide real ones)."""
    return {
        "beneficiary_name": "Circle Internet Financial Inc.",
        "beneficiary_address": "99 High Street, Boston, MA 02110",
        "bank_name": "Silvergate Bank",
        "routing_number": "122242869",
        "account_number": "1000XXXXXXXX",
        "reference": f"CIR-{intent_id}",
        "amount": f"{currency} {amount:,.2f}",
        "instructions": f"Include reference CIR-{intent_id} in memo field",
    }
