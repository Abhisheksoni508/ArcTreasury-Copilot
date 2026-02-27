"""Policy engine — rule-based risk scoring and decision classification.

Rules evaluated in order:
  1. amount_limit     — flag high-value payouts
  2. chain_supported  — block unsupported chains
  3. recipient_risk   — score based on address patterns (blocklist, known-good)
  4. velocity_check   — flag if recipient has too many recent payouts
  5. duplicate_check  — flag potential duplicates in the same batch

Risk score → Decision mapping:
  0-24   → APPROVED
  25-49  → QUEUED
  50-74  → REVIEW
  75-89  → HELD
  90+    → REJECTED
"""

from __future__ import annotations
from dataclasses import dataclass, field
from app.config import settings


@dataclass
class RuleResult:
    rule_name: str
    score: float        # 0-100 contribution
    weight: float       # multiplier
    passed: bool
    reason: str


@dataclass
class PolicyDecision:
    decision: str       # APPROVED | REVIEW | HELD | QUEUED | REJECTED
    risk_score: float
    reason: str
    rules: list[RuleResult] = field(default_factory=list)


# ── Blocklist / Known addresses (demo) ─────────────────────────────────

BLOCKLIST = {"0xFAIL_BLOCKLISTED_666", "0xFRAUD_KNOWN_BAD"}
KNOWN_GOOD = {"0xSUCCESS_ALICE_001", "0xSUCCESS_CHARLIE_003"}


def evaluate_item(
    recipient_address: str,
    amount: float,
    destination_chain: str,
    category: str,
    batch_addresses: list[str] | None = None,
    recipient_recent_count: int = 0,
) -> PolicyDecision:
    """Evaluate a single payout item through the rule chain."""

    rules: list[RuleResult] = []

    # Rule 1: Amount limit
    # Thresholds: >3x limit → 55, >1x limit → 35, >0.5x limit → 8, else 0
    if amount > settings.POLICY_MAX_AMOUNT * 3:
        rules.append(RuleResult("amount_limit", 55, 1.0, False,
                                f"Amount ${amount:,.0f} far exceeds limit (${settings.POLICY_MAX_AMOUNT:,.0f})"))
    elif amount > settings.POLICY_MAX_AMOUNT:
        rules.append(RuleResult("amount_limit", 50, 1.0, False,
                                f"High amount ${amount:,.0f} exceeds limit (${settings.POLICY_MAX_AMOUNT:,.0f})"))
    elif amount > settings.POLICY_MAX_AMOUNT * 0.5:
        rules.append(RuleResult("amount_limit", 8, 1.0, True,
                                f"Amount ${amount:,.0f} approaching limit"))
    else:
        rules.append(RuleResult("amount_limit", 0, 1.0, True, "Amount within limits"))

    # Rule 2: Chain supported
    chain_lower = destination_chain.lower()
    if chain_lower not in [c.lower() for c in settings.SUPPORTED_CHAINS]:
        rules.append(RuleResult("chain_supported", 100, 1.0, False,
                                f"Chain '{destination_chain}' is not supported"))
    else:
        rules.append(RuleResult("chain_supported", 0, 1.0, True, "Chain supported"))

    # Rule 3: Recipient risk (blocklist / pattern-based)
    addr_upper = recipient_address.upper()
    if any(bl.upper() in addr_upper or addr_upper in bl.upper() for bl in BLOCKLIST) or "FAIL" in addr_upper:
        rules.append(RuleResult("recipient_risk", 90, 1.0, False,
                                "Recipient address on blocklist"))
    elif "QUEUE" in addr_upper:
        rules.append(RuleResult("recipient_risk", 70, 1.0, False,
                                "Recipient flagged for velocity anomaly"))
    elif "RETRY" in addr_upper:
        rules.append(RuleResult("recipient_risk", 8, 1.0, True,
                                "Recipient has minor risk flag"))
    elif any(kg.upper() in addr_upper for kg in KNOWN_GOOD) or "SUCCESS" in addr_upper:
        rules.append(RuleResult("recipient_risk", 0, 1.0, True, "Recipient is known-good"))
    elif "NEW" in addr_upper:
        rules.append(RuleResult("recipient_risk", 30, 1.0, False,
                                "New recipient — no payment history on file"))
    else:
        rules.append(RuleResult("recipient_risk", 12, 1.0, True, "Recipient not flagged"))

    # Rule 4: Velocity check
    if recipient_recent_count > settings.POLICY_VELOCITY_LIMIT:
        rules.append(RuleResult("velocity_check", 30, 1.0, False,
                                f"Recipient has {recipient_recent_count} recent payouts (limit: {settings.POLICY_VELOCITY_LIMIT})"))
    else:
        rules.append(RuleResult("velocity_check", 0, 1.0, True, "Velocity within limits"))

    # Rule 5: Duplicate check
    if batch_addresses and batch_addresses.count(recipient_address) > 1:
        rules.append(RuleResult("duplicate_check", 20, 1.0, False,
                                "Duplicate recipient in same batch"))
    else:
        rules.append(RuleResult("duplicate_check", 0, 1.0, True, "No duplicates"))

    # Calculate weighted risk score
    total_score = sum(r.score * r.weight for r in rules)
    # Normalize to 0-100 range
    risk_score = min(100, total_score)

    # Map score to decision
    decision = score_to_decision(risk_score)

    # Build reason from failing rules
    failing_rules = [r for r in rules if not r.passed]
    if failing_rules:
        reason = "; ".join(r.reason for r in failing_rules)
    else:
        reason = "All checks passed"

    return PolicyDecision(
        decision=decision,
        risk_score=round(risk_score, 1),
        reason=reason,
        rules=rules,
    )


def score_to_decision(score: float) -> str:
    """Map risk score to decision.

    0-24  → APPROVED
    25-49 → QUEUED
    50-74 → REVIEW
    75-89 → HELD
    90+   → REJECTED
    """
    if score < 25:
        return "APPROVED"
    elif score < 50:
        return "QUEUED"
    elif score < 75:
        return "REVIEW"
    elif score < 90:
        return "HELD"
    else:
        return "REJECTED"
