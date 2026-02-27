"""Review queue and manual decision endpoints."""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models import ItemResponse, ManualDecisionRequest
from app.services.audit_service import log_audit

router = APIRouter()


@router.get("/review-queue", response_model=list[ItemResponse])
async def get_review_queue():
    """List all items that need manual review (decision = REVIEW or HELD)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT * FROM payout_items WHERE decision IN ('REVIEW', 'HELD')
               ORDER BY risk_score DESC"""
        )
        items = await cursor.fetchall()
        return [
            ItemResponse(
                id=i[0], batch_id=i[1], recipient_name=i[2], recipient_address=i[3],
                amount=i[4], currency=i[5], destination_chain=i[6], category=i[7],
                decision=i[8], risk_score=i[9], decision_reason=i[10],
                execution_status=i[11], adapter_used=i[12],
                is_simulated=bool(i[13]), created_at=i[14], updated_at=i[15],
            )
            for i in items
        ]
    finally:
        await db.close()


@router.post("/items/{item_id}/decide", response_model=ItemResponse)
async def manual_decide(item_id: str, req: ManualDecisionRequest):
    """Manually approve or reject a review/held item."""
    if req.decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM payout_items WHERE id = ?", (item_id,))
        item = await cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        old_decision = item[8]
        if old_decision not in ("REVIEW", "HELD"):
            raise HTTPException(status_code=400, detail=f"Item is {old_decision}, not in review")

        now = datetime.now(timezone.utc).isoformat()
        reason = req.reason or f"Manually {req.decision.lower()} by operator"

        await db.execute(
            "UPDATE payout_items SET decision = ?, decision_reason = ?, updated_at = ? WHERE id = ?",
            (req.decision, reason, now, item_id),
        )

        await log_audit(db, "item", item_id, "MANUAL_DECISION", old_decision, req.decision, reason)
        await db.commit()

        cursor = await db.execute("SELECT * FROM payout_items WHERE id = ?", (item_id,))
        updated = await cursor.fetchone()

        return ItemResponse(
            id=updated[0], batch_id=updated[1], recipient_name=updated[2],
            recipient_address=updated[3], amount=updated[4], currency=updated[5],
            destination_chain=updated[6], category=updated[7], decision=updated[8],
            risk_score=updated[9], decision_reason=updated[10],
            execution_status=updated[11], adapter_used=updated[12],
            is_simulated=bool(updated[13]), created_at=updated[14], updated_at=updated[15],
        )
    finally:
        await db.close()
