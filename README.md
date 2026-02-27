# ArcTreasury Copilot

**AI-powered USDC payouts, policy checks, and treasury automation on Arc.**

Built for the Global Payouts and Treasury Systems bounty — Circle Gateway + Arc Bridge Kit.

## What It Does

ArcTreasury Copilot is a full-stack treasury operations system that:

1. **Ingests payout batches** — payroll, vendor payments, revenue splits
2. **Runs a policy + risk engine** — classifies every payout as APPROVED / REVIEW / HELD / QUEUED / REJECTED based on amount limits, chain validation, recipient risk scoring, and velocity checks
3. **Executes multi-recipient, multi-chain USDC payouts** — via adapter pattern supporting mock (simulated), Circle Gateway, and Arc Bridge Kit
4. **Provides full audit trails** — every state transition logged with timestamps
5. **Clearly labels REAL vs SIMULATED** — honest transparency throughout the UI

## Architecture

```
React + Vite + TypeScript + Tailwind
        │ REST API (JSON)
FastAPI (Python) + SQLite
  ├── Policy Engine (rule-based risk scoring)
  ├── Execution Orchestrator (multi-chain payout legs)
  └── Adapter Layer (mock / circle / arc)
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

### Demo Flow (90 seconds)
1. Open Dashboard → empty state
2. Go to Batches → click **Seed Demo Data** → 6 payout items loaded
3. Click **Run Policy Engine** → items classified into all 5 decision states
4. Go to Review Queue → **Approve** the review item
5. Back to Batches → click **Execute Batch** → watch results
6. Go to Execution Monitor → **Retry** failed items → see retry succeed
7. Open Audit Log → full history of every state change
8. Settings → toggle between mock/circle/arc adapter modes

## Bounty Criteria Mapping

| Criteria | Implementation |
|---|---|
| Automated/agent-driven payout logic | Policy engine with rule-based risk scoring + automated execution orchestrator |
| Multi-recipient, multi-chain settlement | 6 recipients across Ethereum, Polygon, Arbitrum, Solana with payout legs model |
| Policy-based or condition-based payouts | 5-rule policy chain: amount limits, chain validation, recipient risk, velocity, duplicates |
| Circle Gateway | CircleAdapter with real API integration (falls back to mock) |
| Arc Bridge Kit | ArcAdapter with real API integration (falls back to mock) |
| Circle Wallets | Treasury wallet model with USDC settlement |

## Real vs Simulated

- **SIMULATED** (yellow badge): Mock adapter with deterministic demo outcomes. No real funds moved.
- **REAL** (green badge): Circle or Arc API with actual USDC transfers on-chain.

The system defaults to mock mode for safe demo. Toggle to circle/arc mode in Settings when API keys are configured.

## Policy Engine Decision States

| Decision | Risk Score Range | Meaning |
|---|---|---|
| APPROVED | 0-24 | All checks passed, ready for execution |
| QUEUED | 25-49 | Minor flags, queued for batch processing |
| REVIEW | 50-74 | Requires manual operator review |
| HELD | 75-89 | Significant risk flags, held pending investigation |
| REJECTED | 90-100 | Blocked — blocklist match or critical policy violation |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET/PUT | `/api/settings` | View/update settings |
| POST | `/api/seed` | Seed demo data |
| POST | `/api/batches` | Create batch |
| GET | `/api/batches` | List batches |
| GET | `/api/batches/{id}` | Get batch detail |
| POST | `/api/batches/{id}/policy` | Run policy engine |
| GET | `/api/review-queue` | Items needing review |
| POST | `/api/items/{id}/decide` | Manual approve/reject |
| POST | `/api/batches/{id}/execute` | Execute batch |
| POST | `/api/items/{id}/retry` | Retry failed item |
| GET | `/api/executions` | List executed items |
| GET | `/api/items/{id}/legs` | Get payout legs |
| GET | `/api/audit-logs` | Audit trail |

## Tech Stack

- **Frontend**: React 18 + Vite 6 + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) + SQLite (aiosqlite)
- **Adapters**: Mock (deterministic) / Circle / Arc
- **No auth required** — demo-first design

## Environment Variables (optional)

```
ADAPTER_MODE=mock           # mock | circle | arc
CIRCLE_API_KEY=             # Circle API key for real payouts
ARC_API_KEY=                # Arc API key for real payouts
POLICY_MAX_AMOUNT=25000     # Amount threshold for policy engine
```

## Testing

```bash
cd backend
python -m pytest tests/ -v
```

## curl Quick Test

```bash
# Seed demo data
curl -X POST http://localhost:8000/api/seed | python -m json.tool

# Run policy engine
curl -X POST http://localhost:8000/api/batches/batch-demo-001/policy | python -m json.tool

# Execute batch
curl -X POST http://localhost:8000/api/batches/batch-demo-001/execute | python -m json.tool

# View audit logs
curl http://localhost:8000/api/audit-logs | python -m json.tool
```
