"""Seed endpoint — loads deterministic demo data."""

from datetime import datetime, timezone
from fastapi import APIRouter
from app.database import reset_db, get_db
from app.models import SeedResponse
from app.services.audit_service import log_audit

router = APIRouter()

DEMO_BATCH_ID = "batch-demo-001"
DEMO_ITEMS = [
    {
        "id": "item-001",
        "recipient_name": "Alice Johnson",
        "recipient_address": "0xA11CE00000000000000000000000000000000001",
        "amount": 1.50,
        "currency": "USDC",
        "destination_chain": "ethereum",
        "category": "payroll",
    },
    {
        "id": "item-002",
        "recipient_name": "Bob Martinez",
        "recipient_address": "0xB0B0000000000000000000000000000000000002",
        "amount": 2.00,
        "currency": "USDC",
        "destination_chain": "polygon",
        "category": "vendor",
    },
    {
        "id": "item-003",
        "recipient_name": "Charlie Corp",
        "recipient_address": "0xC0FFEE0000000000000000000000000000000003",
        "amount": 30000.00,
        "currency": "USDC",
        "destination_chain": "arbitrum",
        "category": "vendor",
    },
    {
        "id": "item-004",
        "recipient_name": "Diana Wei",
        "recipient_address": "0xD1A6000000000000000000000000000000000004",
        "amount": 1.00,
        "currency": "USDC",
        "destination_chain": "ethereum",
        "category": "revenue_split",
    },
    {
        # Arc Bridge Kit demo: USDC bridged to Circle's Arc L1 via CCTP
        "id": "item-005",
        "recipient_name": "FutureFinance (Arc L1)",
        "recipient_address": "0xFACE000000000000000000000000000000000005",
        "amount": 0.50,
        "currency": "USDC",
        "destination_chain": "arc",   # Circle's Arc blockchain
        "category": "revenue_split",
    },
    {
        "id": "item-006",
        "recipient_name": "Echo Ltd",
        "recipient_address": "0xE000000000000000000000000000000000000006",
        "amount": 3.00,
        "currency": "USDC",
        "destination_chain": "solana",
        "category": "payroll",
    },
    {
        "id": "item-007",
        "recipient_name": "Fraudster Inc",
        "recipient_address": "0xBADF00D000000000000000000000000000000007",
        "amount": 100000.00,
        "currency": "USDC",
        "destination_chain": "ethereum",
        "category": "vendor",
    },
]


@router.post("/seed", response_model=SeedResponse)
async def seed_demo_data():
    """Reset DB and load deterministic demo data."""
    await reset_db()
    db = await get_db()

    now = datetime.now(timezone.utc).isoformat()
    total_amount = sum(item["amount"] for item in DEMO_ITEMS)

    try:
        # Create batch
        await db.execute(
            """INSERT INTO payout_batches (id, name, status, total_amount, item_count, created_at, updated_at)
               VALUES (?, ?, 'DRAFT', ?, ?, ?, ?)""",
            (DEMO_BATCH_ID, "Q1 2025 Payouts — Demo Batch", total_amount, len(DEMO_ITEMS), now, now),
        )

        # Create items
        for item in DEMO_ITEMS:
            await db.execute(
                """INSERT INTO payout_items (id, batch_id, recipient_name, recipient_address, amount,
                      currency, destination_chain, category, decision, risk_score, decision_reason,
                      execution_status, is_simulated, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, '', 'PENDING', 1, ?, ?)""",
                (item["id"], DEMO_BATCH_ID, item["recipient_name"], item["recipient_address"],
                 item["amount"], item["currency"], item["destination_chain"], item["category"],
                 now, now),
            )

        await log_audit(db, "batch", DEMO_BATCH_ID, "SEED", None, "DRAFT",
                        f"Demo data seeded with {len(DEMO_ITEMS)} items, total ${total_amount:,.2f}")
        await db.commit()

        return SeedResponse(
            batch_id=DEMO_BATCH_ID,
            items_created=len(DEMO_ITEMS),
            message=f"Demo data seeded with {len(DEMO_ITEMS)} payout items totaling ${total_amount:,.2f} USDC",
        )
    finally:
        await db.close()
