# ArcTreasury Copilot

**AI-powered USDC payouts, policy checks, and treasury automation on Arc.**

Built for the **Global Payouts and Treasury Systems** bounty — Circle Programmable Wallets + Arc Testnet.

## What It Does

ArcTreasury Copilot is a full-stack treasury operations system that:

1. **Ingests payout batches** — payroll, vendor payments, revenue splits
2. **Runs a 5-rule policy + risk engine** — classifies every payout as APPROVED / REVIEW / HELD / QUEUED / REJECTED
3. **Executes multi-recipient, multi-chain USDC payouts** — via adapter pattern supporting mock, Circle Programmable Wallets, and Arc
4. **Autonomous Treasury Agent** — 3 strategies (conservative/balanced/aggressive) running continuous payout loops
5. **One-click AutoPilot** — seed → policy → review → execute in a single button press
6. **RWA-backed treasury** — allocate idle USDC to 4 tokenized asset classes (T-Bills, MMF, Corp Bonds, RE Fund)
7. **CCTP V2 bridge routing** — 7 chains, 42 cross-chain routes with fee/time estimates
8. **Circle Gateway** — crosschain unified USDC balance (deposit on any chain, instant mint on another)
9. **Bridge Kit integration** — TypeScript script for programmatic USDC bridging via CCTP
10. **Full audit trails** — every state transition logged with timestamps
11. **Dark mode** — ThemeToggle with Tailwind dark: variants throughout
12. **Clearly labels REAL vs SIMULATED** — honest transparency throughout the UI

## Architecture

```
React + Vite + TypeScript + Tailwind (7 pages)
        │ REST API (43 endpoints)
FastAPI (Python) + SQLite (9 tables, WAL mode)
  ├── Policy Engine (5-rule risk scoring)
  ├── Execution Orchestrator (multi-chain payout legs)
  ├── Adapter Layer (mock / circle / arc)
  ├── Treasury Agent (3 strategies, autonomous loop)
  ├── RWA Treasury (4 asset classes, health scoring, auto-rebalance)
  ├── CCTP Bridge Router (7 chains, 42 routes)
  ├── Circle Gateway (crosschain unified USDC balance)
  └── Bridge Kit (TypeScript CCTP V2 bridging script)
```

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API docs at: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:5173

### Demo Flow (2 minutes)
1. Open **Dashboard** → system overview
2. Go to **Batches** → click **AutoPilot** → watch one-click: seed 6 items → policy → auto-review → execute
3. Open **Copilot Agent** → start with "balanced" strategy → watch autonomous loop
4. Go to **Treasury & RWA** → Tab 1: seed RWA positions, allocate USDC to tokenized assets, view health score
5. **Treasury & RWA** → Tab 2: Circle Gateway — view unified crosschain balance, deposit USDC from Ethereum, mint on Arbitrum
6. **Treasury & RWA** → Tab 3: CCTP Bridge — plan cross-chain route with fee breakdown
7. **Execution Monitor** → retry failed items, inspect payout legs
8. **Audit Log** → full history of every action
9. **Settings** → toggle mock/circle/arc adapter mode

## Bounty Criteria Mapping

| Criteria | Implementation |
|---|---|
| Policy-based payouts | 5-rule engine: amount limits, chain validation, recipient risk, velocity, duplicates → 5 decision states |
| Agent-driven automation | Treasury Copilot Agent with 3 strategies + one-click AutoPilot |
| Multi-recipient, multi-chain | 6+ recipients across ETH/Polygon/Arbitrum/Solana/Avalanche/Base/Arc with payout legs |
| RWA-backed treasury | 4 tokenized assets (T-Bills, MMF, Corp Bonds, RE Fund), health scoring, auto-rebalance |
| Circle Gateway | Crosschain unified USDC balance: deposit on 7 chains, instant mint on destination, unified balance UI |
| CCTP Bridge | V2 domain registry (7 chains, 42 routes), route planner with burn→attest→mint steps |
| Circle Wallets | Real USDC transfers on ARC-TESTNET via Circle Programmable Wallets |

## Real vs Simulated

- **REAL** (green badge): Circle Programmable Wallets API with actual USDC transfers on-chain. Proven with 4 transfers on ARC-TESTNET.
- **SIMULATED** (yellow badge): Mock adapter with deterministic demo outcomes. No real funds moved.

The system defaults to mock mode for safe demo. Toggle to circle/arc mode in Settings when API keys are configured.

## Policy Engine Decision States

| Decision | Risk Score Range | Meaning |
|---|---|---|
| APPROVED | 0-24 | All checks passed, ready for execution |
| QUEUED | 25-49 | Minor flags, queued for batch processing |
| REVIEW | 50-74 | Requires manual operator review |
| HELD | 75-89 | Significant risk flags, held pending investigation |
| REJECTED | 90-100 | Blocked — blocklist match or critical policy violation |

## API Endpoints (43 total)

| Category | Endpoints |
|---|---|
| **Health & Settings** | `GET /api/health`, `GET/PUT /api/settings` |
| **Batches** | `POST /api/seed`, `POST /api/batches`, `GET /api/batches`, `GET /api/batches/{id}` |
| **Policy & Review** | `POST /api/batches/{id}/policy`, `GET /api/review-queue`, `POST /api/items/{id}/decide` |
| **Execution** | `POST /api/batches/{id}/execute`, `POST /api/items/{id}/retry`, `GET /api/executions`, `GET /api/items/{id}/legs` |
| **Agent** | `GET /api/agent/status`, `POST /api/agent/control`, `PUT /api/agent/strategy`, `GET /api/agent/activity`, `GET /api/agent/strategies` |
| **Treasury (RWA)** | `GET /api/treasury/overview`, `GET /api/treasury/catalog`, `POST /api/treasury/allocate`, `POST /api/treasury/redeem/{id}`, `POST /api/treasury/rebalance`, `POST /api/treasury/seed` |
| **CCTP Bridge** | `GET /api/bridge/domains`, `GET /api/bridge/routes`, `POST /api/bridge/plan`, `GET /api/bridge/transactions` |
| **Circle Gateway** | `GET /api/gateway/info`, `GET /api/gateway/balance`, `POST /api/gateway/deposit`, `POST /api/gateway/mint`, `POST /api/gateway/transfer`, `GET /api/gateway/transactions` |
| **Wallets** | `POST /api/wallets/setup`, `GET /api/wallets/balance` |
| **Audit** | `GET /api/audit-logs` |

## Tech Stack

- **Frontend**: React 18 + Vite 6 + TypeScript + Tailwind CSS + lucide-react + dark mode
- **Backend**: FastAPI (Python 3.12) + SQLite (aiosqlite, WAL mode)
- **Adapters**: Mock (deterministic) / Circle Programmable Wallets / Arc
- **Circle SDK**: v10.1.0 for wallet creation scripts
- **Bridge Kit**: TypeScript CCTP V2 bridging script
- **No auth required** — demo-first design

## Environment Variables

```
ADAPTER_MODE=mock           # mock | circle | arc
CIRCLE_API_KEY=             # Circle API key (TEST_API_KEY: prefix for testnet)
ARC_API_KEY=                # Arc API key
POLICY_MAX_AMOUNT=25000     # Amount threshold for policy engine
```

## Testing

```bash
cd backend
python -m pytest tests/ -v
```
