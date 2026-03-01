<div align="center">

# ⚡ ArcTreasury Copilot

### AI-Powered Global Payouts & Treasury System on USDC

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-arc--treasury--copilot.vercel.app-blue?style=for-the-badge)](https://arc-treasury-copilot.vercel.app)
[![Demo Video](https://img.shields.io/badge/🎬_Demo_Video-Watch_on_Streamable-ff4444?style=for-the-badge)](https://streamable.com/nz2v36)
[![Backend API](https://img.shields.io/badge/⚙️_Backend_API-Render-46E3B7?style=for-the-badge)](https://arctresury-api.onrender.com/api/health)

**Built for the [$10K Build Global Payouts and Treasury Systems with USDC](https://arc.net) Bounty**

Circle Programmable Wallets · Arc Testnet · CCTP V2 · Circle Gateway

---

</div>

## 📋 Table of Contents

- [Demo Video](#-demo-video)
- [Live Links](#-live-links)
- [What It Does](#-what-it-does)
- [Architecture](#-architecture)
- [Screenshots](#-screenshots)
- [Quick Start](#-quick-start)
- [Bounty Criteria](#-bounty-criteria-mapping)
- [Real vs Simulated](#-real-vs-simulated)
- [Tech Stack](#-tech-stack)
- [API Endpoints](#-api-endpoints-43-total)
- [Environment Variables](#-environment-variables)
- [Testing](#-testing)

---

## 🎬 Demo Video

> **[▶️ Watch the full demo on Streamable](https://streamable.com/nz2v36)**

---

## 🔗 Live Links

| | Link |
|---|---|
| **Frontend** | [arc-treasury-copilot.vercel.app](https://arc-treasury-copilot.vercel.app) |
| **Backend API** | [arctresury-api.onrender.com](https://arctresury-api.onrender.com/api/health) |
| **API Docs (Swagger)** | [arctresury-api.onrender.com/docs](https://arctresury-api.onrender.com/docs) |

> **Note:** The Render backend may take ~30s to cold-start on the first request (free tier).

---

## 🚀 What It Does

ArcTreasury Copilot is a full-stack treasury operations platform that automates USDC payouts across multiple blockchains using Circle's infrastructure and Arc Testnet.

| # | Feature | Description |
|---|---|---|
| 1 | **Payout Batches** | Ingest payroll, vendor payments, and revenue splits |
| 2 | **5-Rule Policy Engine** | Risk scoring → APPROVED / QUEUED / REVIEW / HELD / REJECTED |
| 3 | **Multi-Chain Execution** | USDC payouts across ETH, Polygon, Arbitrum, Solana, Avalanche, Base, Arc |
| 4 | **Treasury Copilot Agent** | Autonomous agent with 3 strategies (conservative / balanced / aggressive) |
| 5 | **One-Click AutoPilot** | Seed → Policy → Review → Execute in a single button press |
| 6 | **RWA Treasury** | Allocate idle USDC to T-Bills, MMF, Corp Bonds, RE Fund |
| 7 | **CCTP V2 Bridge** | 7 chains, 42 cross-chain routes with fee & time estimates |
| 8 | **Circle Gateway** | Crosschain unified USDC balance — deposit on any chain, instant mint on another |
| 9 | **Bridge Kit** | TypeScript script for programmatic USDC bridging via CCTP |
| 10 | **Full Audit Trail** | Every state transition logged with timestamps |
| 11 | **REAL vs SIMULATED Labels** | Honest transparency — clearly marks what's on-chain vs demo |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│          Frontend — React 18 + Vite + TypeScript + Tailwind     │
│   Dashboard │ Batches │ Execution │ Agent │ Treasury │ Audit    │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST API (43 endpoints)
┌──────────────────────────┴──────────────────────────────────────┐
│              Backend — FastAPI (Python) + SQLite (WAL)           │
│                                                                  │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ Policy Engine │  │   Execution    │  │   Adapter Layer     │  │
│  │  (5 rules)    │  │  Orchestrator  │  │ mock│circle│arc     │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │   Treasury   │  │  CCTP Bridge   │  │  Circle Gateway     │  │
│  │    Agent     │  │   Router       │  │  (unified USDC)     │  │
│  │ (3 strategies)│  │  (7 chains)    │  │  (7 chains)         │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ RWA Treasury │  │ Audit Logger   │  │ SQLite (9 tables)   │  │
│  │ (4 assets)   │  │                │  │                     │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs → [http://localhost:8000/docs](http://localhost:8000/docs)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App → [http://localhost:5173](http://localhost:5173)

### Demo Flow (2 minutes)

| Step | Action |
|---|---|
| 1 | Open **Dashboard** → system overview with stats |
| 2 | **Batches** → click **Seed & AutoPilot** → watch: seed → policy → review → execute |
| 3 | **Copilot Agent** → start with "balanced" strategy → watch autonomous loop |
| 4 | **Treasury & RWA** → Tab 1: seed RWA positions, allocate USDC, view health score |
| 5 | **Treasury & RWA** → Tab 2: Circle Gateway — deposit from Ethereum, mint on Arbitrum |
| 6 | **Treasury & RWA** → Tab 3: CCTP Bridge — plan cross-chain route with fee breakdown |
| 7 | **Execution Monitor** → retry failed items, inspect payout legs |
| 8 | **Audit Log** → full history of every action |
| 9 | **Settings** → toggle mock / circle / arc adapter mode |

---

## ✅ Bounty Criteria Mapping

| Requirement | Status | Implementation |
|---|---|---|
| **Policy-based payouts** | ✅ Strong | 5-rule engine: amount limits, chain validation, recipient risk, velocity, duplicates → 5 decision states |
| **Agent-driven automation** | ✅ Strong | Treasury Copilot Agent with 3 strategies + one-click AutoPilot |
| **Multi-recipient, multi-chain** | ✅ Strong | 7+ recipients across ETH / Polygon / Arbitrum / Solana / Avalanche / Base / Arc with payout legs |
| **RWA-backed treasury** | ✅ Strong | 4 tokenized assets (T-Bills, MMF, Corp Bonds, RE Fund), health scoring, auto-rebalance |
| **Circle Gateway** | ✅ Strong | Crosschain unified USDC balance: deposit on 7 chains, instant mint on destination |
| **CCTP V2 Bridge** | ✅ Strong | Domain registry (7 chains, 42 routes), route planner with burn → attest → mint |
| **Circle Programmable Wallets** | ✅ Proven | Real USDC transfers on ARC-TESTNET — 4 completed transactions on-chain |

---

## 🟢 Real vs Simulated

| Mode | Badge | What It Means |
|---|---|---|
| **REAL** | 🟢 Green | Circle Programmable Wallets API → actual USDC transfers on ARC-TESTNET. Proven with 4 transfers. |
| **SIMULATED** | 🟡 Yellow | Mock adapter with deterministic demo outcomes. No real funds moved. |

**On-chain proof:**
- Wallet ID: `e8fd7df0-1df7-5ded-82b4-089164d78e47`
- Wallet Address: `0x0ebad37c010db50010fa779cc289382479859836`
- Network: ARC-TESTNET
- Funded with 20 USDC, executed 4 transfers until depleted

The system defaults to mock mode for safe demo. Toggle to `circle` or `arc` mode in **Settings** when API keys are configured.

---

## 🔒 Policy Engine

| Decision | Risk Score | Meaning |
|---|---|---|
| ✅ APPROVED | 0 – 24 | All checks passed, ready for execution |
| 📋 QUEUED | 25 – 49 | Minor flags, queued for batch processing |
| 👀 REVIEW | 50 – 74 | Requires manual operator review |
| ⏸️ HELD | 75 – 89 | Significant risk, held pending investigation |
| ❌ REJECTED | 90 – 100 | Blocked — blocklist match or critical violation |

**5 Rules:** Amount limit ($25K) · Chain validation (7 chains) · Recipient risk (blocklist) · Velocity check (frequency cap) · Duplicate detection

---

## 📡 API Endpoints (43 total)

| Category | Endpoints |
|---|---|
| **Health & Settings** | `GET /api/health` · `GET/PUT /api/settings` |
| **Batches** | `POST /api/seed` · `POST /api/batches` · `GET /api/batches` · `GET /api/batches/{id}` |
| **Policy & Review** | `POST /api/batches/{id}/policy` · `GET /api/review-queue` · `POST /api/items/{id}/decide` |
| **Execution** | `POST /api/batches/{id}/execute` · `POST /api/items/{id}/retry` · `GET /api/executions` · `GET /api/items/{id}/legs` |
| **Agent** | `GET /api/agent/status` · `POST /api/agent/control` · `PUT /api/agent/strategy` · `GET /api/agent/activity` · `GET /api/agent/strategies` |
| **Treasury (RWA)** | `GET /api/treasury/overview` · `GET /api/treasury/catalog` · `POST /api/treasury/allocate` · `POST /api/treasury/redeem/{id}` · `POST /api/treasury/rebalance` · `POST /api/treasury/seed` |
| **CCTP Bridge** | `GET /api/bridge/domains` · `GET /api/bridge/routes` · `POST /api/bridge/plan` · `GET /api/bridge/transactions` |
| **Circle Gateway** | `GET /api/gateway/info` · `GET /api/gateway/balance` · `POST /api/gateway/deposit` · `POST /api/gateway/mint` · `POST /api/gateway/transfer` · `GET /api/gateway/transactions` |
| **Wallets** | `POST /api/wallets/setup` · `GET /api/wallets/balance` |
| **Audit** | `GET /api/audit-logs` |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 · Vite 6 · TypeScript · Tailwind CSS · Recharts · Lucide Icons |
| **Backend** | FastAPI · Python 3.12 · SQLite (aiosqlite, WAL mode) |
| **Adapters** | Mock (deterministic) · Circle Programmable Wallets · Arc |
| **Circle SDK** | v10.1.0 — wallet creation & management |
| **Bridge Kit** | TypeScript CCTP V2 bridging script |
| **Deployment** | Vercel (frontend) · Render (backend) |

---

## ⚙️ Environment Variables

```env
ADAPTER_MODE=mock              # mock | circle | arc
CIRCLE_API_KEY=                # Circle API key (TEST_API_KEY: prefix → testnet)
ARC_API_KEY=                   # Arc API key
CIRCLE_WALLET_ID=              # Circle Programmable Wallet ID
POLICY_MAX_AMOUNT=25000        # Amount threshold for policy engine
POLICY_VELOCITY_LIMIT=5        # Max payouts per recipient per 30 days
```

---

## 🧪 Testing

```bash
cd backend
python -m pytest tests/ -v
```

---

<div align="center">

**Built with ❤️ for the Circle × Arc Global Payouts & Treasury Bounty**

[Live App](https://arc-treasury-copilot.vercel.app) · [Demo Video](https://streamable.com/nz2v36) · [API Docs](https://arctresury-api.onrender.com/docs)

</div>
