"""Quick smoke tests for backend — run with: python -m pytest tests/ -v"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.policy_engine import evaluate_item


def test_alice_approved():
    """Alice: SUCCESS address, low amount → APPROVED."""
    result = evaluate_item("0xSUCCESS_ALICE_001", 2500, "ethereum", "payroll")
    assert result.decision == "APPROVED"
    assert result.risk_score < 25


def test_bob_approved():
    """Bob: RETRY address, moderate amount → APPROVED."""
    result = evaluate_item("0xRETRY_BOB_002", 8000, "polygon", "vendor")
    assert result.decision == "APPROVED"
    assert result.risk_score < 25


def test_charlie_review():
    """Charlie: known-good address but high amount ($50k) → REVIEW."""
    result = evaluate_item("0xSUCCESS_CHARLIE_003", 50000, "arbitrum", "vendor")
    assert result.decision == "REVIEW"
    assert 50 <= result.risk_score < 75


def test_diana_held():
    """Diana: QUEUE flagged address → HELD."""
    result = evaluate_item("0xQUEUE_DIANA_004", 15000, "ethereum", "revenue_split")
    assert result.decision == "HELD"
    assert 75 <= result.risk_score < 90


def test_echo_queued():
    """Echo: NEW address, moderate amount → QUEUED."""
    result = evaluate_item("0xNEW_ECHO_005", 18000, "solana", "payroll")
    assert result.decision == "QUEUED"
    assert 25 <= result.risk_score < 50


def test_fraudster_rejected():
    """Fraudster: blocklisted address, huge amount → REJECTED."""
    result = evaluate_item("0xFAIL_BLOCKLISTED_666", 100000, "ethereum", "vendor")
    assert result.decision == "REJECTED"
    assert result.risk_score >= 90


def test_unsupported_chain():
    result = evaluate_item("0xSOMEONE", 1000, "fantom", "payroll")
    assert result.decision == "REJECTED"
    assert "not supported" in result.reason.lower()


def test_arc_chain_approved():
    """Arc L1 chain is supported — Circle's Bridge Kit destination."""
    result = evaluate_item("0xSUCCESS_ARC_005", 5000, "arc", "revenue_split")
    assert result.decision == "APPROVED"
    assert result.risk_score < 25


def test_arc_chain_policy_pass():
    """Arc chain is in SUPPORTED_CHAINS — should not trigger chain_supported rule."""
    result = evaluate_item("0xSOMEADDRESS", 1000, "arc", "payroll")
    # Chain rule should pass (arc is supported), only slight risk from unknown address
    chain_rule = next((r for r in result.rules if r.rule_name == "chain_supported"), None)
    assert chain_rule is not None
    assert chain_rule.passed is True
