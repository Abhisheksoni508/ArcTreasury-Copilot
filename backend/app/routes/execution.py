"""Execution and retry endpoints."""

from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models import ExecutionResponse, ExecutionResultItem, ItemResponse, LegResponse
from app.services.execution_orchestrator import execute_batch, retry_item
from app.services.audit_service import log_audit

router = APIRouter()


@router.post("/batches/{batch_id}/execute", response_model=ExecutionResponse)
async def execute_batch_endpoint(batch_id: str):
    """Execute all approved items in a batch."""
    db = await get_db()
    try:
        # Verify batch exists
        cursor = await db.execute("SELECT id, status FROM payout_batches WHERE id = ?", (batch_id,))
        batch = await cursor.fetchone()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        results = await execute_batch(db, batch_id)

        return ExecutionResponse(
            batch_id=batch_id,
            executed=len(results),
            results=[
                ExecutionResultItem(
                    item_id=r["item_id"],
                    status=r["status"],
                    tx_hash=r.get("tx_hash"),
                    error=r.get("error"),
                    is_simulated=r.get("is_simulated", True),
                )
                for r in results
            ],
        )
    finally:
        await db.close()


@router.post("/items/{item_id}/retry")
async def retry_item_endpoint(item_id: str):
    """Retry a failed payout item."""
    db = await get_db()
    try:
        # Verify item exists and is failed
        cursor = await db.execute(
            "SELECT execution_status FROM payout_items WHERE id = ?", (item_id,),
        )
        item = await cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        if item[0] != "FAILED":
            raise HTTPException(status_code=400, detail=f"Item status is {item[0]}, not FAILED")

        result = await retry_item(db, item_id)
        return result
    finally:
        await db.close()


@router.get("/executions", response_model=list[ItemResponse])
async def list_executions():
    """List all items that have been executed or are in progress."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT * FROM payout_items WHERE execution_status != 'PENDING'
               ORDER BY updated_at DESC"""
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


@router.get("/items/{item_id}/legs", response_model=list[LegResponse])
async def get_item_legs(item_id: str):
    """Get all payout legs for an item."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM payout_legs WHERE item_id = ? ORDER BY attempt_number", (item_id,),
        )
        legs = await cursor.fetchall()
        return [
            LegResponse(
                id=l[0], item_id=l[1], leg_type=l[2], source_chain=l[3],
                destination_chain=l[4], amount=l[5], status=l[6],
                tx_hash=l[7], adapter_used=l[8], attempt_number=l[9],
                error_message=l[10], created_at=l[11], updated_at=l[12],
            )
            for l in legs
        ]
    finally:
        await db.close()
