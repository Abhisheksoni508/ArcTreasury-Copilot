"""Pydantic models and enums for ArcTreasury Copilot."""

from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ── Enums ──────────────────────────────────────────────────────────────

class BatchStatus(str, Enum):
    DRAFT = "DRAFT"
    POLICY_RUN = "POLICY_RUN"
    REVIEW = "REVIEW"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    SETTLED = "SETTLED"


class Decision(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REVIEW = "REVIEW"
    HELD = "HELD"
    QUEUED = "QUEUED"
    REJECTED = "REJECTED"


class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


class LegStatus(str, Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class LegType(str, Enum):
    DIRECT = "direct"
    BRIDGE = "bridge"
    TRANSFER = "transfer"


class Category(str, Enum):
    PAYROLL = "payroll"
    VENDOR = "vendor"
    REVENUE_SPLIT = "revenue_split"


# ── Request/Response Models ────────────────────────────────────────────

class CreateBatchRequest(BaseModel):
    name: str
    items: list[CreateItemRequest] = []


class CreateItemRequest(BaseModel):
    recipient_name: str
    recipient_address: str
    amount: float
    currency: str = "USDC"
    destination_chain: str
    category: str = "payroll"


class ManualDecisionRequest(BaseModel):
    decision: str  # "APPROVED" or "REJECTED"
    reason: str = ""


class SettingsUpdateRequest(BaseModel):
    adapter_mode: Optional[str] = None
    policy_max_amount: Optional[float] = None
    policy_velocity_limit: Optional[int] = None


# ── Response Models ────────────────────────────────────────────────────

class BatchResponse(BaseModel):
    id: str
    name: str
    status: str
    total_amount: float
    item_count: int
    created_at: str
    updated_at: str


class BatchDetailResponse(BatchResponse):
    items: list[ItemResponse] = []


class ItemResponse(BaseModel):
    id: str
    batch_id: str
    recipient_name: str
    recipient_address: str
    amount: float
    currency: str
    destination_chain: str
    category: str
    decision: str
    risk_score: float
    decision_reason: str
    execution_status: str
    adapter_used: Optional[str] = None
    is_simulated: bool
    created_at: str
    updated_at: str


class LegResponse(BaseModel):
    id: str
    item_id: str
    leg_type: str
    source_chain: str
    destination_chain: str
    amount: float
    status: str
    tx_hash: Optional[str] = None
    adapter_used: Optional[str] = None
    attempt_number: int
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class AuditLogResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    action: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None
    timestamp: str


class PolicyResultItem(BaseModel):
    item_id: str
    decision: str
    risk_score: float
    reason: str


class PolicyRunResponse(BaseModel):
    batch_id: str
    results: list[PolicyResultItem]


class ExecutionResultItem(BaseModel):
    item_id: str
    status: str
    tx_hash: Optional[str] = None
    error: Optional[str] = None
    is_simulated: bool = True


class ExecutionResponse(BaseModel):
    batch_id: str
    executed: int
    results: list[ExecutionResultItem]


class SeedResponse(BaseModel):
    batch_id: str
    items_created: int
    message: str


class HealthResponse(BaseModel):
    status: str = "healthy"
    adapter_mode: str
    version: str = "1.0.0"


class SettingsResponse(BaseModel):
    adapter_mode: str
    policy_max_amount: float
    policy_velocity_limit: int
    supported_chains: list[str]
    treasury_wallet: str
