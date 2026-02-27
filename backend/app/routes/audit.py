"""Audit log endpoints."""

from fastapi import APIRouter, Query
from app.database import get_db
from app.models import AuditLogResponse

router = APIRouter()


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    entity_type: str | None = Query(None, description="Filter by entity type (batch, item, leg)"),
    entity_id: str | None = Query(None, description="Filter by entity ID"),
    limit: int = Query(100, ge=1, le=500),
):
    """List audit logs with optional filters."""
    db = await get_db()
    try:
        query = "SELECT * FROM audit_logs WHERE 1=1"
        params: list = []

        if entity_type:
            query += " AND entity_type = ?"
            params.append(entity_type)
        if entity_id:
            query += " AND entity_id = ?"
            params.append(entity_id)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        cursor = await db.execute(query, params)
        logs = await cursor.fetchall()
        return [
            AuditLogResponse(
                id=l[0], entity_type=l[1], entity_id=l[2], action=l[3],
                old_value=l[4], new_value=l[5], details=l[6], timestamp=l[7],
            )
            for l in logs
        ]
    finally:
        await db.close()
