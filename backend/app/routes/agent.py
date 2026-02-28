"""Agent control and activity endpoints."""

from fastapi import APIRouter, HTTPException, Query
from app.database import get_db
from app.models import (
    AgentActivityResponse,
    AgentStatusResponse,
    AgentControlRequest,
)
from app.services.treasury_agent import (
    get_state,
    start_agent,
    stop_agent,
    set_strategy,
    STRATEGIES,
)

router = APIRouter()


@router.get("/agent/status", response_model=AgentStatusResponse)
async def agent_status():
    """Get the current agent status."""
    state = get_state()
    cfg = STRATEGIES.get(state.strategy, {})
    return AgentStatusResponse(
        running=state.running,
        strategy=state.strategy,
        cycle_count=state.cycle_count,
        last_cycle_at=state.last_cycle_at,
        strategy_config=cfg,
        available_strategies=list(STRATEGIES.keys()),
    )


@router.post("/agent/control", response_model=AgentStatusResponse)
async def agent_control(req: AgentControlRequest):
    """Start or stop the agent, optionally setting strategy."""
    if req.action == "start":
        strategy = req.strategy or "balanced"
        if strategy not in STRATEGIES:
            raise HTTPException(400, f"Unknown strategy: {strategy}. Choose from: {list(STRATEGIES.keys())}")
        started = start_agent(strategy)
        if not started:
            # Already running — update strategy
            set_strategy(strategy)
    elif req.action == "stop":
        stop_agent()
    else:
        raise HTTPException(400, f"Unknown action: {req.action}. Use 'start' or 'stop'.")

    state = get_state()
    cfg = STRATEGIES.get(state.strategy, {})
    return AgentStatusResponse(
        running=state.running,
        strategy=state.strategy,
        cycle_count=state.cycle_count,
        last_cycle_at=state.last_cycle_at,
        strategy_config=cfg,
        available_strategies=list(STRATEGIES.keys()),
    )


@router.put("/agent/strategy")
async def update_strategy(strategy: str):
    """Change agent strategy at runtime."""
    if strategy not in STRATEGIES:
        raise HTTPException(400, f"Unknown strategy: {strategy}. Choose from: {list(STRATEGIES.keys())}")
    set_strategy(strategy)
    state = get_state()
    return {
        "strategy": state.strategy,
        "config": STRATEGIES[strategy],
    }


@router.get("/agent/activity", response_model=list[AgentActivityResponse])
async def list_activity(
    limit: int = Query(50, ge=1, le=500),
    action: str | None = Query(None, description="Filter by action type"),
):
    """List recent agent activity."""
    db = await get_db()
    try:
        query = "SELECT * FROM agent_activity WHERE 1=1"
        params: list = []
        if action:
            query += " AND action = ?"
            params.append(action)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [
            AgentActivityResponse(
                id=r[0],
                action=r[1],
                entity_type=r[2] or "",
                entity_id=r[3] or "",
                details=r[4] or "",
                strategy=r[5] or "",
                timestamp=r[6] or "",
            )
            for r in rows
        ]
    finally:
        await db.close()


@router.delete("/agent/activity")
async def clear_activity():
    """Clear all agent activity logs."""
    db = await get_db()
    try:
        await db.execute("DELETE FROM agent_activity")
        await db.commit()
        return {"cleared": True}
    finally:
        await db.close()


@router.get("/agent/strategies")
async def list_strategies():
    """List all available agent strategies with their configs."""
    return {
        name: {
            "description": cfg["description"],
            "auto_approve_max_risk": cfg["auto_approve_max_risk"],
            "auto_approve_max_amount": cfg["auto_approve_max_amount"],
            "auto_approve_decisions": cfg["auto_approve_decisions"],
            "max_retries": cfg["max_retries"],
            "loop_interval": cfg["loop_interval"],
        }
        for name, cfg in STRATEGIES.items()
    }
