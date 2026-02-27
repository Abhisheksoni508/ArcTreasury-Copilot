"""Audit logging service — records every state transition."""

import uuid
from datetime import datetime, timezone
import aiosqlite


async def log_audit(
    db: aiosqlite.Connection,
    entity_type: str,
    entity_id: str,
    action: str,
    old_value: str | None = None,
    new_value: str | None = None,
    details: str | None = None,
):
    audit_id = f"audit-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO audit_logs (id, entity_type, entity_id, action, old_value, new_value, details, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (audit_id, entity_type, entity_id, action, old_value, new_value, details, now),
    )
    await db.commit()
    return audit_id
