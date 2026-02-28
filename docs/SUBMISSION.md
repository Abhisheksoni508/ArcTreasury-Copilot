# ArcTreasury Copilot — Submission

## Judge-Facing Summary

ArcTreasury Copilot is an AI-powered treasury operations platform that automates USDC payouts across multiple chains using Circle's Programmable Wallets and Arc Testnet. It combines a 5-rule policy engine, an autonomous Treasury Copilot Agent with 3 strategies, RWA-backed treasury reserves (4 tokenized asset classes), CCTP V2 cross-chain bridge routing (7 chains, 42 routes), and a Circle Gateway fiat on/off ramp — all with full audit trails and explicit REAL vs SIMULATED labeling.

**Proven on-chain**: 4 real USDC transfers completed on ARC-TESTNET via Circle Programmable Wallets (wallet `0x0ebad37c...`, funded with 20 USDC, now depleted — proving real execution).

## Bounty Scorecard

| Requirement | Status | Implementation |
|---|---|---|
| Policy-based payouts | **STRONG** | 5-rule engine: amount limits, chain validation, recipient risk, velocity, duplicates → 5 decision states |
| Agent-driven automation | **STRONG** | Autonomous agent with 3 strategies (conservative/balanced/aggressive) + one-click AutoPilot |
| Multi-recipient, multi-chain | **STRONG** | 6+ recipients across ETH/Polygon/Arbitrum/Solana/Avalanche/Base/Arc with payout legs |
| RWA-backed treasury | **STRONG** | 4 tokenized assets (T-Bills 5.25%, MMF 4.8%, Corp Bonds 6.1%, RE Fund 7.5%), health scoring, auto-rebalance |
| Circle Gateway | **COVERED** | Fiat on/off ramp: Wire/ACH/SEPA rails, USD/EUR/GBP/SGD, deposit + withdrawal intents |

## What Is Real vs Simulated

### Real (proven on-chain)
- **Circle Programmable Wallets** — real USDC transfers on ARC-TESTNET via `api.circle.com`
- 4 completed transactions with on-chain tx hashes
- Wallet `e8fd7df0-1df7-5ded-82b4-089164d78e47` funded and depleted
- Adapter auto-detects `TEST_API_KEY:` prefix for testnet routing

### Simulated (demo-safe)
- **Mock adapter** — deterministic outcomes (success, retry-then-success, permanent failure)
- **RWA Treasury** — tokenized asset positions with yield accrual (no real RWA protocol integration)
- **CCTP Bridge** — route planning with fee/time estimates (no real CCTP burn/mint calls)
- **Circle Gateway** — deposit/withdrawal intent flows (no real bank rail integration)
- All simulated items clearly labeled with amber "SIMULATED" badge

## Technical Decisions

1. **Adapter pattern** — Seamless switching between mock/circle/arc without changing business logic
2. **SQLite + WAL** — Zero-config persistence with concurrent reads, sufficient for demo
3. **Rule-based policy engine** — Transparent, deterministic, auditable (vs black-box ML)
4. **Payout legs model** — Each item can have multiple legs (direct, bridge, transfer) with independent retry
5. **Autonomous agent loop** — Background async task: seed → policy → review → execute → repeat
6. **Audit-everything** — Every state transition logged for compliance visibility
7. **3-strategy agent** — Conservative (approve-only), balanced (auto-approve low-risk), aggressive (auto-approve all)

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                    React + Vite + TypeScript + Tailwind        │
│  Dashboard │ Batches │ Execution │ Agent │ Treasury │ Audit   │
│                        + AutoPilot one-click flow             │
└────────────────────────────┬──────────────────────────────────┘
                             │ REST API (43 endpoints)
┌────────────────────────────┴──────────────────────────────────┐
│                    FastAPI Backend (Python)                     │
│                                                                │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Policy     │  │  Execution   │  │   Adapter Layer       │ │
│  │  Engine     │  │  Orchestrator│  │  mock │ circle │ arc  │ │
│  │  (5 rules)  │  │  (multi-leg) │  │  ← real USDC on Arc  │ │
│  └────────────┘  └──────────────┘  └───────────────────────┘ │
│                                                                │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Treasury   │  │  CCTP Bridge │  │   Circle Gateway      │ │
│  │  Agent      │  │  Router      │  │   (fiat on/off ramp)  │ │
│  │  (3 strats) │  │  (7 chains)  │  │   Wire/ACH/SEPA      │ │
│  └────────────┘  └──────────────┘  └───────────────────────┘ │
│                                                                │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  RWA        │  │  Audit       │  │   SQLite (WAL)        │ │
│  │  Treasury   │  │  Logger      │  │   9 tables            │ │
│  │  (4 assets) │  │              │  │                       │ │
│  └────────────┘  └──────────────┘  └───────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

## Pages & Features

| Page | What it does |
|---|---|
| **Dashboard** | Batch overview, total payouts, status distribution, recent activity |
| **Batches** | Create batches, seed demo data, run policy, execute, **AutoPilot one-click** (seed→policy→review→execute in sequence) |
| **Execution** | Live execution monitor with retry, payout legs detail, REAL/SIMULATED badges |
| **Copilot Agent** | Start/stop autonomous agent, pick strategy, view real-time activity log |
| **Treasury & RWA** | 3-tab page: RWA positions + allocation, Circle Gateway deposits/withdrawals, CCTP bridge route planner |
| **Audit Log** | Full history of every state change with filters |
| **Settings** | Adapter mode toggle (mock/circle/arc), policy thresholds, wallet config |

## Demo Script (2 minutes)

0:00 — "ArcTreasury Copilot — AI-powered USDC payouts with policy engine, autonomous agent, and RWA treasury."
0:10 — **Dashboard** — show system overview.
0:15 — **Batches** → click **AutoPilot** → watch one-click flow: seeds 6 items → runs policy (5 decisions) → auto-approves review items → executes payouts. All in 10 seconds.
0:35 — Point out REAL vs SIMULATED badges. Switch to Arc adapter in Settings to show real on-chain capability.
0:45 — **Copilot Agent** → Start agent with "balanced" strategy → watch it autonomously create batches, run policy, execute payouts in a loop.
1:00 — **Treasury & RWA** → Tab 1: Show RWA positions (T-Bills, MMF, Corp Bonds, RE Fund). Click "Seed Demo" → allocate USDC to tokenized assets. Show health score with liquidity + diversification + yield composite.
1:15 — **Treasury & RWA** → Tab 2: Circle Gateway — create a deposit intent (Wire, $50K USD). Show bank instructions and fee breakdown.
1:25 — **Treasury & RWA** → Tab 3: CCTP Bridge — plan a route from Ethereum to Arc. Show burn→attest→mint steps with fee and time estimates across 7 chains.
1:35 — **Execution Monitor** → show completed items, retry a failed one, inspect payout legs.
1:45 — **Audit Log** → full trail of every action taken by the agent and manually.
1:55 — "Built with FastAPI, React, real Circle Programmable Wallets on Arc Testnet. All 5 bounty requirements addressed."
2:00 — End.

## 20 Likely Judge Questions + Answers

1. **How does the policy engine work?**
   Five rules evaluated in sequence: amount limit ($25K default), chain support (6 chains + Arc), recipient risk (blocklist matching), velocity check (frequency cap), duplicate detection. Each contributes a weighted risk score (0-100) mapping to decision buckets: APPROVED (<25), QUEUED (25-49), REVIEW (50-74), HELD (75-89), REJECTED (90+).

2. **Did you actually move real USDC?**
   Yes. 4 real USDC transfers completed on ARC-TESTNET via Circle Programmable Wallets (api.circle.com). We created a wallet, funded it with 20 USDC, and executed multi-recipient payouts until the wallet was depleted. Transaction hashes are on-chain.

3. **What is the Treasury Copilot Agent?**
   An autonomous background agent that runs a continuous loop: create batch → run policy → auto-review → execute. It supports 3 strategies: **conservative** (only executes pre-approved items), **balanced** (auto-approves items with risk < 50), **aggressive** (auto-approves everything except REJECTED). Controllable via start/stop from the UI.

4. **What is the AutoPilot feature?**
   A one-click button on the Batches page that runs the entire pipeline end-to-end: Seed Demo Data → Run Policy Engine → Auto-Approve Review Items → Execute Batch. Shows real-time step progress with success/failure indicators.

5. **How does the RWA treasury work?**
   Treasury holds idle USDC and allocates it to 4 tokenized asset classes: T-Bills (5.25% APY), Money Market Fund (4.8%), Investment-Grade Corp Bonds (6.1%), Real Estate Fund (7.5%). Each has a risk rating and liquidity tier. The treasury health score is a composite of liquidity ratio, diversification index, and weighted yield. Auto-rebalance enforces a target 40% liquid reserve ratio.

6. **What chains does CCTP support?**
   7 chains with CCTP V2 domain IDs: Ethereum (0), Avalanche (1), Arbitrum (3), Base (6), Polygon (7), Solana (5), Arc (26). The route planner calculates burn→attest→mint steps with chain-specific fees and time estimates across 7 chains. Arc-native routes get reduced fees (0.01%).

7. **How does Circle Gateway work?**
   Fiat on/off ramp supporting Wire, ACH, and SEPA payment rails in USD, EUR, GBP, and SGD. Non-USD deposits are converted to USD via live FX rates (EUR×1.08, GBP×1.27, SGD×0.74) before minting USDC. The UI lets operators select a payment method and currency, see a live FX conversion preview, then create deposit intents (fiat→USD→USDC) or withdrawal intents (USDC→USD→fiat) with fee breakdown. Rail details: Wire ($100 min, 0.1% fee, 1-2 days), ACH ($10 min, free, 2-3 days), SEPA (€10 min, free, 1-2 days).

8. **What chains are supported for payouts?**
   Ethereum, Polygon, Arbitrum, Solana, Avalanche, Base, and Arc Testnet. The payout legs model supports direct transfers (same chain) and bridged transfers (cross-chain via CCTP routing).

9. **How do you handle failures and retries?**
   Each payout item can have multiple payout legs with independent attempt tracking. Failed items are marked FAILED with error details and can be retried via the UI or API. The system tracks attempt numbers and error messages for each leg.

10. **What's the adapter pattern?**
    Decouples business logic from payment providers. Three adapters implement the same interface: `execute()`, `check_status()`, `name()`, `is_simulated()`. MockAdapter returns deterministic outcomes, CircleAdapter calls Circle Programmable Wallets API, ArcAdapter calls Arc-specific endpoints. Adding a new provider means implementing 4 methods.

11. **What's the database schema?**
    9 tables: `payout_batches`, `payout_items`, `payout_legs`, `audit_logs`, `settings`, `agent_activity`, `treasury_positions`, `treasury_rebalance_history`, `gateway_transactions`. All IDs are UUID-based strings. SQLite with WAL mode for concurrent reads.

12. **What's the audit trail?**
    Every state transition is logged: batch creation, policy decisions, manual reviews, agent actions, execution starts/results, retries, treasury allocations. Each entry includes entity type, entity ID, action, old→new state, details, and timestamp.

13. **Can operators override policy decisions?**
    Yes. Items in REVIEW or HELD states can be manually approved or rejected inline during the AutoPilot flow or via the API. All overrides are logged in the audit trail with the operator's reason.

14. **How scalable is this?**
    For production: replace SQLite with Postgres, add async task queue (Celery/Redis), add WebSocket for real-time updates, horizontal scaling behind a load balancer. The adapter pattern and service layer make this straightforward.

15. **What about authentication/authorization?**
    Scoped out for hackathon. Production path: JWT auth, role-based access (operator/admin/viewer), API key management per adapter, audit logs tied to authenticated user.

16. **What happens if Circle API is down?**
    The adapter catches all exceptions and returns a FAILED result with the error message. The item is marked FAILED and can be retried later. The system degrades gracefully — mock adapter is always available as fallback.

17. **How does the treasury health scoring work?**
    Three components: **Liquidity ratio** (liquid USDC / total reserves, target ≥40%), **Diversification index** (1 - Herfindahl across asset classes, higher = better), **Yield composite** (weighted average across positions). Combined into a letter grade (A/B/C/D) with color coding.

18. **Is the CCTP bridge real?**
    The route planner and domain registry are fully functional with real CCTP V2 domain IDs and chain metadata. The actual burn/mint execution is simulated (no real cross-chain burns). In production, this would call Circle's CCTP V2 contracts on each chain.

19. **How deterministic is the demo?**
    The seed endpoint creates exactly 6 items with specific addresses that trigger specific policy decisions and mock adapter outcomes. Same seed = same demo every time. Treasury seed creates a fixed set of RWA positions.

20. **What would you build next?**
    WebSocket real-time updates, CSV/API batch upload, CCTP V2 live execution (actual burn/mint), Circle Mint integration for real Gateway flows, automated scheduling (cron-based payroll), natural-language copilot chat, and multi-tenant support with auth.
