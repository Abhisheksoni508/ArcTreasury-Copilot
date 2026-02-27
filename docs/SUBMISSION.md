# ArcTreasury Copilot — Submission

## Judge-Facing Summary

ArcTreasury Copilot is an AI-powered treasury operations platform that automates USDC payouts across multiple chains using Circle Gateway and Arc Bridge Kit. It ingests payout batches (payroll, vendor, revenue splits), runs them through a transparent policy + risk engine producing all five decision states (APPROVED / REVIEW / HELD / QUEUED / REJECTED), executes multi-recipient settlements via an adapter pattern, and provides full audit trails with explicit REAL vs SIMULATED labeling.

## What Is Real vs Simulated

### Real (when API keys configured)
- Circle Gateway API calls for USDC transfers
- Arc Bridge Kit API calls for cross-chain settlements
- Actual on-chain transaction hashes
- Real wallet-to-wallet USDC movement

### Simulated (demo default)
- Mock adapter with deterministic outcomes
- Predictable demo scenarios: immediate success, retry-then-success, permanent failure, queued
- No real funds moved
- All simulated items clearly labeled with amber "SIMULATED" badge

## Technical Decisions

1. **Adapter pattern** — Allows seamless switching between mock/circle/arc without changing business logic
2. **SQLite** — Zero-config persistence, WAL mode for concurrent reads, sufficient for demo
3. **Rule-based policy engine** — Transparent, deterministic, demo-friendly (vs black-box ML)
4. **Payout legs model** — Each item can have multiple legs (direct, bridge, transfer) with independent retry
5. **Audit-everything** — Every state transition logged for compliance visibility

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│              React Dashboard                      │
│  Dashboard │ Batches │ Review │ Execution │ Audit │
└─────────────────────┬───────────────────────────┘
                      │ REST API
┌─────────────────────┴───────────────────────────┐
│              FastAPI Backend                       │
│  ┌────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ Policy │ │ Execution │ │  Adapter Layer   │  │
│  │ Engine │ │ Orchestr. │ │ mock│circle│arc  │  │
│  └────────┘ └───────────┘ └──────────────────┘  │
│  ┌────────┐ ┌───────────┐                        │
│  │ Audit  │ │  SQLite   │                        │
│  │ Logger │ │  (WAL)    │                        │
│  └────────┘ └───────────┘                        │
└─────────────────────────────────────────────────┘
```

## Demo Script (90 seconds)

0:00 — "This is ArcTreasury Copilot — automated USDC payouts with policy checks."
0:05 — Open Dashboard, show empty state.
0:10 — Navigate to Batches, click "Seed Demo Data" — 6 payout items appear.
0:20 — Click "Run Policy Engine" — items classified: 2 APPROVED, 1 REVIEW, 1 HELD, 1 QUEUED, 1 REJECTED. Point out risk scores.
0:35 — Navigate to Review Queue — approve the REVIEW item. Explain the risk flags.
0:45 — Back to Batches — click "Execute Batch" — watch 3 items execute: 1 settles, 1 fails (retry scenario), 1 queued.
0:55 — Go to Execution Monitor — click "Retry" on the failed item — it succeeds on second attempt.
1:05 — Open Audit Log — show full trail of every state change.
1:15 — Settings — show mock/circle/arc mode toggle. Explain REAL vs SIMULATED labels.
1:25 — "Built with FastAPI, React, adapter pattern for Circle and Arc. Every payout is traceable."
1:30 — End.

## 20 Likely Judge Questions + Answers

1. **How does the policy engine work?**
   Five rules evaluated in sequence: amount limit, chain support, recipient risk (blocklist), velocity check, duplicate check. Each contributes a weighted risk score (0-100) which maps to a decision bucket.

2. **Can this handle real USDC transfers?**
   Yes. The Circle and Arc adapters make real API calls when API keys are configured. The adapter pattern abstracts the execution layer, so switching from mock to real requires only setting an environment variable.

3. **What chains are supported?**
   Ethereum, Polygon, Arbitrum, Solana, Avalanche, Base. The payout legs model supports direct transfers (same chain) and bridged transfers (cross-chain).

4. **How do you handle failures and retries?**
   Each payout item can have multiple payout legs with independent attempt tracking. Failed items are marked FAILED and can be retried via the UI or API. The mock adapter deterministically simulates: immediate success, retry-then-success, and permanent failure.

5. **What is simulated vs real?**
   Mock adapter = simulated (deterministic demo outcomes, no funds moved). Circle/Arc adapters = real (actual API calls, actual USDC transfers). Every item in the UI is labeled with a SIMULATED or REAL badge.

6. **How does multi-chain routing work?**
   Each payout item specifies a destination chain. The orchestrator creates payout legs: "direct" if treasury chain matches destination, "bridge" if cross-chain. The adapter handles the actual execution for each leg type.

7. **What's the audit trail?**
   Every state transition is logged: batch creation, policy decisions, manual reviews, execution start/result, retries. Each log entry includes entity type, entity ID, action, old→new state, details, and timestamp.

8. **How scalable is this?**
   For production: replace SQLite with Postgres, add async task queue (Celery), add WebSocket for real-time updates. The current design handles demo-scale cleanly.

9. **Why adapter pattern?**
   Decouples business logic from payment providers. Adding a new provider (e.g., Stripe, Coinbase) requires only implementing the adapter interface: execute(), check_status(), name(), is_simulated().

10. **How does the review queue work?**
    Items scored 50-89 by the policy engine land in REVIEW or HELD states. Operators can view these in the Review Queue and manually APPROVE or REJECT each one with a reason.

11. **What categories of payouts are supported?**
    Payroll, vendor payments, and revenue splits. Each category is tagged on the payout item for categorization and reporting.

12. **How does the risk scoring work?**
    5 rules each contribute a score: amount (0-55), chain (0-100), recipient risk (0-90), velocity (0-30), duplicates (0-20). Scores are summed and capped at 100. Decision thresholds: <25 APPROVED, <50 QUEUED, <75 REVIEW, <90 HELD, ≥90 REJECTED.

13. **Can operators override policy decisions?**
    Yes. REVIEW and HELD items can be manually approved or rejected through the review queue. The override is logged in the audit trail.

14. **What happens if the Circle/Arc API is down?**
    The adapter returns a FAILED result with the error message. The item is marked FAILED and can be retried later. The system never crashes — it degrades gracefully.

15. **Why not use WebSockets for real-time updates?**
    48h hackathon scope cut. The UI uses manual refresh buttons. WebSocket support is a natural Day 3 enhancement.

16. **How is the demo data deterministic?**
    The seed endpoint creates exactly 6 items with specific addresses that trigger specific policy decisions and mock adapter outcomes. Same seed = same demo every time.

17. **What about authentication/authorization?**
    Cut for hackathon scope. In production: add JWT auth, role-based access (operator vs admin), and API key management.

18. **How would you add a new policy rule?**
    Add a new rule function in policy_engine.py that returns a RuleResult (score, weight, passed, reason). Add it to the evaluate_item chain. No other changes needed.

19. **What's the database schema?**
    4 tables: payout_batches, payout_items, payout_legs, audit_logs, plus a settings KV store. All IDs are UUID-based strings.

20. **What would you build next?**
    WebSocket real-time updates, CSV batch upload, treasury balance tracking, automated scheduling (cron-based payroll), and a natural-language copilot that summarizes batch risk.
