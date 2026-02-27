"""Policy evaluation endpoint."""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models import PolicyRunResponse, PolicyResultItem
from app.services.policy_engine import evaluate_item
from app.services.audit_service import log_audit

router = APIRouter()


@router.post("/batches/{batch_id}/policy", response_model=PolicyRunResponse)
async def run_policy(batch_id: str):
    """Run the policy engine on all PENDING items in a batch."""
    db = await get_db()
    try:
        # Verify batch exists
        cursor = await db.execute("SELECT id, status FROM payout_batches WHERE id = ?", (batch_id,))
        batch = await cursor.fetchone()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        # Get all items
        cursor = await db.execute(
            "SELECT id, recipient_address, amount, destination_chain, category FROM payout_items WHERE batch_id = ?",
            (batch_id,),
        )
        items = await cursor.fetchall()
        if not items:
            raise HTTPException(status_code=400, detail="Batch has no items")

        # Collect all addresses for duplicate check
        all_addresses = [item[1] for item in items]

        now = datetime.now(timezone.utc).isoformat()
        results = []

        for item in items:
            item_id, recipient_address, amount, dest_chain, category = item

            decision = evaluate_item(
                recipient_address=recipient_address,
                amount=amount,
                destination_chain=dest_chain,
                category=category,
                batch_addresses=all_addresses,
                recipient_recent_count=0,
            )

            # Update item
            await db.execute(
                """UPDATE payout_items SET decision = ?, risk_score = ?, decision_reason = ?, updated_at = ?
                   WHERE id = ?""",
                (decision.decision, decision.risk_score, decision.reason, now, item_id),
            )

            await log_audit(db, "item", item_id, "POLICY_DECISION",
                            "PENDING", decision.decision,
                            f"Risk score: {decision.risk_score}, Reason: {decision.reason}")

            results.append(PolicyResultItem(
                item_id=item_id,
                decision=decision.decision,
                risk_score=decision.risk_score,
                reason=decision.reason,
            ))

        # Update batch status
        has_review = any(r.decision == "REVIEW" for r in results)
        batch_status = "REVIEW" if has_review else "POLICY_RUN"
        await db.execute(
            "UPDATE payout_batches SET status = ?, updated_at = ? WHERE id = ?",
            (batch_status, now, batch_id),
        )
        await log_audit(db, "batch", batch_id, "POLICY_RUN", batch[1], batch_status,
                        f"Policy evaluated {len(results)} items")

        await db.commit()
        return PolicyRunResponse(batch_id=batch_id, results=results)
    finally:
        await db.close()
