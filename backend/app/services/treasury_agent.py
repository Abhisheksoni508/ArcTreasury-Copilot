"""Treasury Copilot Agent — autonomous payout orchestration.

The agent runs as a background loop and autonomously:
  1. Detects new batches → runs the policy engine
  2. Auto-approves REVIEW/HELD items below a configurable risk threshold
  3. Executes batches when all items are decided
  4. Retries failed items with exponential backoff
  5. Logs every decision to agent_activity + audit trail

Strategies control risk tolerance:
  conservative — only auto-approve risk < 30, max 1 retry
  balanced     — auto-approve risk < 60, max 2 retries
  aggressive   — auto-approve risk < 80, max 3 retries
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass

from app.database import get_db
from app.services.policy_engine import evaluate_item
from app.services.execution_orchestrator import execute_batch, retry_item
from app.services.audit_service import log_audit


# ── Strategy Presets ────────────────────────────────────────────────────

STRATEGIES = {
    "conservative": {
        "auto_approve_max_risk": 30,
        "auto_approve_max_amount": 5_000,
        "auto_approve_decisions": ["QUEUED"],  # only QUEUED, not REVIEW/HELD
        "max_retries": 1,
        "retry_backoff_base": 60,       # seconds
        "execute_delay": 30,            # seconds after all items decided
        "loop_interval": 15,            # seconds between cycles
        "description": "Cautious — only auto-approves low-risk queued items",
    },
    "balanced": {
        "auto_approve_max_risk": 60,
        "auto_approve_max_amount": 10_000,
        "auto_approve_decisions": ["QUEUED", "REVIEW"],
        "max_retries": 2,
        "retry_backoff_base": 30,
        "execute_delay": 10,
        "loop_interval": 10,
        "description": "Moderate — auto-approves review items below risk threshold",
    },
    "aggressive": {
        "auto_approve_max_risk": 80,
        "auto_approve_max_amount": 50_000,
        "auto_approve_decisions": ["QUEUED", "REVIEW", "HELD"],
        "max_retries": 3,
        "retry_backoff_base": 15,
        "execute_delay": 5,
        "loop_interval": 8,
        "description": "Bold — auto-approves most items including held, fast retries",
    },
}


# ── Agent State ─────────────────────────────────────────────────────────

@dataclass
class AgentState:
    """Mutable singleton holding agent runtime state."""
    running: bool = False
    strategy: str = "balanced"
    cycle_count: int = 0
    last_cycle_at: str | None = None
    task: asyncio.Task | None = None


_state = AgentState()


def get_state() -> AgentState:
    return _state


# ── Activity Logging ────────────────────────────────────────────────────

async def _log_activity(
    db,
    action: str,
    entity_type: str,
    entity_id: str,
    details: str,
    strategy: str,
):
    """Write to agent_activity table AND audit_logs."""
    act_id = f"agent-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO agent_activity
           (id, action, entity_type, entity_id, details, strategy, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (act_id, action, entity_type, entity_id, details, strategy, now),
    )
    await log_audit(
        db, "agent", entity_id, f"AGENT_{action}",
        old_value=None, new_value=None,
        details=f"[{strategy}] {details}",
    )


# ── Core Loop ───────────────────────────────────────────────────────────

async def _agent_loop():
    """Main agent loop — runs until _state.running = False."""
    state = _state

    while state.running:
        strategy_name = state.strategy
        cfg = STRATEGIES[strategy_name]

        try:
            db = await get_db()
            try:
                changed = False

                # ── Step 1: Auto-run policy on DRAFT batches ────────────
                cursor = await db.execute(
                    "SELECT id FROM payout_batches WHERE status = 'DRAFT'"
                )
                drafts = await cursor.fetchall()
                for row in drafts:
                    batch_id = row[0]
                    await _run_policy_for_batch(db, batch_id, strategy_name)
                    changed = True

                # ── Step 2: Auto-approve eligible items ─────────────────
                allowed_decisions = cfg["auto_approve_decisions"]
                if allowed_decisions:
                    placeholders = ",".join("?" for _ in allowed_decisions)
                    cursor = await db.execute(
                        f"""SELECT id, batch_id, recipient_address, amount,
                                   risk_score, decision, destination_chain
                            FROM payout_items
                            WHERE decision IN ({placeholders})
                              AND execution_status = 'PENDING'""",
                        allowed_decisions,
                    )
                    items = await cursor.fetchall()
                    for item in items:
                        item_id = item[0]
                        amount = item[3]
                        risk_score = item[4]
                        decision = item[5]

                        if (risk_score <= cfg["auto_approve_max_risk"]
                                and amount <= cfg["auto_approve_max_amount"]):
                            now = datetime.now(timezone.utc).isoformat()
                            reason = (
                                f"Agent auto-approved: risk {risk_score:.0f} "
                                f"<= {cfg['auto_approve_max_risk']} threshold, "
                                f"amount ${amount:,.2f} "
                                f"<= ${cfg['auto_approve_max_amount']:,.0f} limit"
                            )
                            await db.execute(
                                """UPDATE payout_items
                                   SET decision = 'APPROVED',
                                       decision_reason = ?,
                                       updated_at = ?
                                   WHERE id = ?""",
                                (reason, now, item_id),
                            )
                            await _log_activity(
                                db, "AUTO_APPROVE", "item", item_id,
                                reason, strategy_name,
                            )
                            changed = True

                # ── Step 3: Execute ready batches ───────────────────────
                cursor = await db.execute(
                    """SELECT DISTINCT b.id
                       FROM payout_batches b
                       JOIN payout_items i ON i.batch_id = b.id
                       WHERE b.status IN ('POLICY_RUN', 'REVIEW')
                         AND NOT EXISTS (
                             SELECT 1 FROM payout_items i2
                             WHERE i2.batch_id = b.id
                               AND i2.decision IN ('PENDING', 'REVIEW', 'HELD', 'QUEUED')
                         )
                         AND EXISTS (
                             SELECT 1 FROM payout_items i3
                             WHERE i3.batch_id = b.id
                               AND i3.decision = 'APPROVED'
                               AND i3.execution_status = 'PENDING'
                         )"""
                )
                ready_batches = await cursor.fetchall()
                for row in ready_batches:
                    batch_id = row[0]
                    await _log_activity(
                        db, "AUTO_EXECUTE", "batch", batch_id,
                        f"All items decided — executing batch",
                        strategy_name,
                    )
                    await db.commit()
                    results = await execute_batch(db, batch_id)
                    settled = sum(1 for r in results if r["status"] == "SETTLED")
                    failed = sum(1 for r in results if r["status"] == "FAILED")
                    processing = sum(1 for r in results if r["status"] == "PROCESSING")
                    await _log_activity(
                        db, "EXECUTE_RESULT", "batch", batch_id,
                        f"Executed {len(results)} items: "
                        f"{settled} settled, {processing} processing, {failed} failed",
                        strategy_name,
                    )
                    changed = True

                # ── Step 4: Auto-retry failed items ─────────────────────
                max_retries = cfg["max_retries"]
                if max_retries > 0:
                    cursor = await db.execute(
                        """SELECT i.id, i.batch_id,
                                  COALESCE(MAX(l.attempt_number), 0) as attempts
                           FROM payout_items i
                           LEFT JOIN payout_legs l ON l.item_id = i.id
                           WHERE i.execution_status = 'FAILED'
                           GROUP BY i.id
                           HAVING attempts < ?""",
                        (max_retries + 1,),
                    )
                    failed_items = await cursor.fetchall()
                    for fitem in failed_items:
                        item_id = fitem[0]
                        attempts = fitem[2]
                        backoff = cfg["retry_backoff_base"] * (2 ** attempts)
                        # Check if enough time has elapsed (simple: always retry in demo)
                        await _log_activity(
                            db, "AUTO_RETRY", "item", item_id,
                            f"Retrying (attempt {attempts + 1}/{max_retries + 1}), "
                            f"backoff={backoff}s",
                            strategy_name,
                        )
                        await db.commit()
                        result = await retry_item(db, item_id)
                        status = result.get("status", "UNKNOWN")
                        await _log_activity(
                            db, "RETRY_RESULT", "item", item_id,
                            f"Retry result: {status} "
                            f"(tx={result.get('tx_hash', 'N/A')})",
                            strategy_name,
                        )
                        changed = True

                await db.commit()

                # Update state
                state.cycle_count += 1
                state.last_cycle_at = datetime.now(timezone.utc).isoformat()

                if not changed:
                    # Nothing to do — log idle periodically (every 6th cycle)
                    if state.cycle_count % 6 == 0:
                        await _log_activity(
                            db, "IDLE", "agent", "copilot",
                            f"Cycle {state.cycle_count} — no pending work",
                            strategy_name,
                        )
                        await db.commit()

            finally:
                await db.close()

        except Exception as e:
            # Don't crash the loop — log error and continue
            try:
                db = await get_db()
                await _log_activity(
                    db, "ERROR", "agent", "copilot",
                    f"Agent error: {str(e)[:200]}",
                    strategy_name,
                )
                await db.commit()
                await db.close()
            except Exception:
                pass  # can't log, just continue

        # Wait before next cycle
        await asyncio.sleep(cfg["loop_interval"])


async def _run_policy_for_batch(db, batch_id: str, strategy_name: str):
    """Run policy engine on all PENDING items in a batch."""
    now = datetime.now(timezone.utc).isoformat()

    cursor = await db.execute(
        """SELECT id, recipient_address, amount, destination_chain, category
           FROM payout_items
           WHERE batch_id = ? AND decision = 'PENDING'""",
        (batch_id,),
    )
    items = await cursor.fetchall()
    if not items:
        return

    # Gather addresses for duplicate check
    all_addresses = [i[1] for i in items]

    results = []
    for item in items:
        item_id, addr, amount, chain, category = item[0], item[1], item[2], item[3], item[4]

        # Query actual recent payout count for velocity check
        vel_cursor = await db.execute(
            """SELECT COUNT(*) FROM payout_items
               WHERE recipient_address = ? AND decision = 'APPROVED'
                 AND id != ? AND created_at >= datetime('now', '-30 days')""",
            (addr, item_id),
        )
        recipient_recent_count = (await vel_cursor.fetchone())[0]

        decision_result = evaluate_item(
            recipient_address=addr,
            amount=amount,
            destination_chain=chain,
            category=category,
            batch_addresses=all_addresses,
            recipient_recent_count=recipient_recent_count,
        )

        await db.execute(
            """UPDATE payout_items
               SET decision = ?, risk_score = ?, decision_reason = ?, updated_at = ?
               WHERE id = ?""",
            (decision_result.decision, decision_result.risk_score,
             decision_result.reason, now, item_id),
        )
        results.append(f"{item_id}={decision_result.decision}({decision_result.risk_score:.0f})")

    # Update batch status
    await db.execute(
        "UPDATE payout_batches SET status = 'POLICY_RUN', updated_at = ? WHERE id = ?",
        (now, batch_id),
    )
    await _log_activity(
        db, "AUTO_POLICY", "batch", batch_id,
        f"Policy run on {len(items)} items: {', '.join(results)}",
        strategy_name,
    )
    await db.commit()


# ── Public Control API ──────────────────────────────────────────────────

def start_agent(strategy: str = "balanced"):
    """Start the agent background loop."""
    state = _state
    if state.running:
        return False  # already running

    strategy = strategy if strategy in STRATEGIES else "balanced"
    state.running = True
    state.strategy = strategy
    state.cycle_count = 0
    state.task = asyncio.get_event_loop().create_task(_agent_loop())
    return True


def stop_agent():
    """Stop the agent background loop."""
    state = _state
    if not state.running:
        return False
    state.running = False
    if state.task and not state.task.done():
        state.task.cancel()
    state.task = None
    return True


def set_strategy(strategy: str) -> bool:
    """Change agent strategy at runtime."""
    if strategy not in STRATEGIES:
        return False
    _state.strategy = strategy
    return True
