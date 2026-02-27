"""Execution orchestrator — processes approved items through payout adapters.

For each approved item:
  1. Creates PayoutLeg(s) based on chain routing
  2. Calls adapter.execute(leg) → LegResult
  3. Updates item and leg status
  4. Logs audit trail
"""

import uuid
from datetime import datetime, timezone
import aiosqlite

from app.adapters.base import LegResult
from app.adapters.mock_adapter import MockAdapter
from app.adapters.circle_adapter import CircleAdapter
from app.adapters.arc_adapter import ArcAdapter
from app.services.audit_service import log_audit
from app.config import settings


def get_adapter():
    """Get the active payout adapter based on settings."""
    mode = settings.ADAPTER_MODE
    if mode == "circle":
        return CircleAdapter()
    elif mode == "arc":
        return ArcAdapter()
    else:
        return MockAdapter()


async def execute_batch(db: aiosqlite.Connection, batch_id: str) -> list[dict]:
    """Execute all approved items in a batch."""
    adapter = get_adapter()
    now = datetime.now(timezone.utc).isoformat()

    # Update batch status
    await db.execute(
        "UPDATE payout_batches SET status = 'EXECUTING', updated_at = ? WHERE id = ?",
        (now, batch_id),
    )
    await log_audit(db, "batch", batch_id, "STATUS_CHANGE", "REVIEW", "EXECUTING",
                    "Batch execution started")

    # Get approved items (decision = APPROVED, execution_status = PENDING)
    cursor = await db.execute(
        """SELECT id, recipient_name, recipient_address, amount, currency,
                  destination_chain, category
           FROM payout_items
           WHERE batch_id = ? AND decision = 'APPROVED' AND execution_status IN ('PENDING', 'RETRYING')""",
        (batch_id,),
    )
    items = await cursor.fetchall()

    results = []
    for item in items:
        item_id = item[0]
        recipient_address = item[2]
        amount = item[3]
        destination_chain = item[5]

        # Update item to PROCESSING
        await db.execute(
            "UPDATE payout_items SET execution_status = 'PROCESSING', adapter_used = ?, is_simulated = ?, updated_at = ? WHERE id = ?",
            (adapter.name(), 1 if adapter.is_simulated() else 0, now, item_id),
        )
        await log_audit(db, "item", item_id, "EXECUTION_START", "PENDING", "PROCESSING",
                        f"Executing via {adapter.name()} adapter")

        # Create payout leg
        leg_id = f"leg-{uuid.uuid4().hex[:12]}"
        source_chain = "ethereum"  # Treasury is on Ethereum
        leg_type = "direct" if destination_chain == source_chain else "bridge"

        await db.execute(
            """INSERT INTO payout_legs (id, item_id, leg_type, source_chain, destination_chain,
                  amount, status, adapter_used, attempt_number, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, 1, ?, ?)""",
            (leg_id, item_id, leg_type, source_chain, destination_chain, amount,
             adapter.name(), now, now),
        )

        # Execute via adapter
        result: LegResult = await adapter.execute(
            leg_id=leg_id,
            recipient_address=recipient_address,
            amount=amount,
            destination_chain=destination_chain,
        )

        # Update leg status
        await db.execute(
            """UPDATE payout_legs SET status = ?, tx_hash = ?, error_message = ?, updated_at = ?
               WHERE id = ?""",
            (result.status, result.tx_hash, result.error_message, now, leg_id),
        )

        # Map leg result to item execution status
        if result.status == "CONFIRMED":
            exec_status = "SETTLED"
        elif result.status == "SUBMITTED":
            exec_status = "PROCESSING"
        else:
            exec_status = "FAILED"

        await db.execute(
            "UPDATE payout_items SET execution_status = ?, is_simulated = ?, updated_at = ? WHERE id = ?",
            (exec_status, 1 if result.is_simulated else 0, now, item_id),
        )
        await log_audit(db, "item", item_id, "EXECUTION_RESULT", "PROCESSING", exec_status,
                        f"tx_hash={result.tx_hash}, error={result.error_message}")

        results.append({
            "item_id": item_id,
            "status": exec_status,
            "tx_hash": result.tx_hash,
            "error": result.error_message,
            "is_simulated": result.is_simulated,
        })

    # Update batch status
    all_settled = all(r["status"] == "SETTLED" for r in results)
    batch_status = "SETTLED" if all_settled else "COMPLETED"
    await db.execute(
        "UPDATE payout_batches SET status = ?, updated_at = ? WHERE id = ?",
        (batch_status, now, batch_id),
    )
    await log_audit(db, "batch", batch_id, "STATUS_CHANGE", "EXECUTING", batch_status,
                    f"Executed {len(results)} items")

    await db.commit()
    return results


async def retry_item(db: aiosqlite.Connection, item_id: str) -> dict:
    """Retry a single failed payout item."""
    adapter = get_adapter()
    now = datetime.now(timezone.utc).isoformat()

    cursor = await db.execute(
        "SELECT id, batch_id, recipient_address, amount, destination_chain FROM payout_items WHERE id = ?",
        (item_id,),
    )
    item = await cursor.fetchone()
    if not item:
        return {"error": "Item not found"}

    recipient_address = item[2]
    amount = item[3]
    destination_chain = item[4]

    # Mark as retrying
    await db.execute(
        "UPDATE payout_items SET execution_status = 'RETRYING', updated_at = ? WHERE id = ?",
        (now, item_id),
    )
    await log_audit(db, "item", item_id, "RETRY_START", "FAILED", "RETRYING", "Manual retry initiated")

    # Get max attempt number for this item
    cursor = await db.execute(
        "SELECT MAX(attempt_number) FROM payout_legs WHERE item_id = ?",
        (item_id,),
    )
    max_attempt = (await cursor.fetchone())[0] or 0

    # Create new leg
    leg_id = f"leg-{uuid.uuid4().hex[:12]}"
    source_chain = "ethereum"
    leg_type = "direct" if destination_chain == source_chain else "bridge"

    await db.execute(
        """INSERT INTO payout_legs (id, item_id, leg_type, source_chain, destination_chain,
              amount, status, adapter_used, attempt_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)""",
        (leg_id, item_id, leg_type, source_chain, destination_chain, amount,
         adapter.name(), max_attempt + 1, now, now),
    )

    # Execute
    result: LegResult = await adapter.execute(
        leg_id=leg_id,
        recipient_address=recipient_address,
        amount=amount,
        destination_chain=destination_chain,
    )

    await db.execute(
        "UPDATE payout_legs SET status = ?, tx_hash = ?, error_message = ?, updated_at = ? WHERE id = ?",
        (result.status, result.tx_hash, result.error_message, now, leg_id),
    )

    if result.status == "CONFIRMED":
        exec_status = "SETTLED"
    elif result.status == "SUBMITTED":
        exec_status = "PROCESSING"
    else:
        exec_status = "FAILED"

    await db.execute(
        "UPDATE payout_items SET execution_status = ?, is_simulated = ?, updated_at = ? WHERE id = ?",
        (exec_status, 1 if result.is_simulated else 0, now, item_id),
    )
    await log_audit(db, "item", item_id, "RETRY_RESULT", "RETRYING", exec_status,
                    f"Attempt {max_attempt + 1}: tx_hash={result.tx_hash}, error={result.error_message}")

    await db.commit()
    return {
        "item_id": item_id,
        "status": exec_status,
        "tx_hash": result.tx_hash,
        "error": result.error_message,
        "is_simulated": result.is_simulated,
        "attempt": max_attempt + 1,
    }
