"""Batch CRUD endpoints."""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter
from app.database import get_db
from app.models import (
    CreateBatchRequest, BatchResponse, BatchDetailResponse, ItemResponse,
)
from app.services.audit_service import log_audit

router = APIRouter()


@router.post("/batches", response_model=BatchResponse)
async def create_batch(req: CreateBatchRequest):
    db = await get_db()
    try:
        batch_id = f"batch-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        total = sum(item.amount for item in req.items)

        await db.execute(
            """INSERT INTO payout_batches (id, name, status, total_amount, item_count, created_at, updated_at)
               VALUES (?, ?, 'DRAFT', ?, ?, ?, ?)""",
            (batch_id, req.name, total, len(req.items), now, now),
        )

        for item in req.items:
            item_id = f"item-{uuid.uuid4().hex[:12]}"
            await db.execute(
                """INSERT INTO payout_items (id, batch_id, recipient_name, recipient_address, amount,
                      currency, destination_chain, category, decision, risk_score, decision_reason,
                      execution_status, is_simulated, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, '', 'PENDING', 1, ?, ?)""",
                (item_id, batch_id, item.recipient_name, item.recipient_address,
                 item.amount, item.currency, item.destination_chain, item.category, now, now),
            )

        await log_audit(db, "batch", batch_id, "CREATED", None, "DRAFT",
                        f"Batch created with {len(req.items)} items")
        await db.commit()

        return BatchResponse(
            id=batch_id, name=req.name, status="DRAFT",
            total_amount=total, item_count=len(req.items),
            created_at=now, updated_at=now,
        )
    finally:
        await db.close()


@router.get("/batches", response_model=list[BatchResponse])
async def list_batches():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM payout_batches ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [
            BatchResponse(
                id=r[0], name=r[1], status=r[2], total_amount=r[3],
                item_count=r[4], created_at=r[5], updated_at=r[6],
            )
            for r in rows
        ]
    finally:
        await db.close()


@router.get("/batches/{batch_id}", response_model=BatchDetailResponse)
async def get_batch(batch_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM payout_batches WHERE id = ?", (batch_id,))
        row = await cursor.fetchone()
        if not row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Batch not found")

        cursor2 = await db.execute(
            "SELECT * FROM payout_items WHERE batch_id = ? ORDER BY created_at", (batch_id,)
        )
        items = await cursor2.fetchall()

        return BatchDetailResponse(
            id=row[0], name=row[1], status=row[2], total_amount=row[3],
            item_count=row[4], created_at=row[5], updated_at=row[6],
            items=[
                ItemResponse(
                    id=i[0], batch_id=i[1], recipient_name=i[2], recipient_address=i[3],
                    amount=i[4], currency=i[5], destination_chain=i[6], category=i[7],
                    decision=i[8], risk_score=i[9], decision_reason=i[10],
                    execution_status=i[11], adapter_used=i[12],
                    is_simulated=bool(i[13]), created_at=i[14], updated_at=i[15],
                )
                for i in items
            ],
        )
    finally:
        await db.close()
