"""ArcTreasury Copilot — FastAPI main application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import health, settings, seed, batches, policy, review, execution, audit, wallets, agent
from app.routes import treasury, bridge, gateway


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="ArcTreasury Copilot",
    description="AI-powered USDC payouts, policy checks, and treasury automation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all route modules under /api
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(settings.router, prefix="/api", tags=["Settings"])
app.include_router(seed.router, prefix="/api", tags=["Seed"])
app.include_router(batches.router, prefix="/api", tags=["Batches"])
app.include_router(policy.router, prefix="/api", tags=["Policy"])
app.include_router(review.router, prefix="/api", tags=["Review"])
app.include_router(execution.router, prefix="/api", tags=["Execution"])
app.include_router(audit.router, prefix="/api", tags=["Audit"])
app.include_router(wallets.router, prefix="/api", tags=["Wallets"])
app.include_router(agent.router, prefix="/api", tags=["Agent"])
app.include_router(treasury.router, prefix="/api", tags=["Treasury"])
app.include_router(bridge.router, prefix="/api", tags=["Bridge"])
app.include_router(gateway.router, prefix="/api", tags=["Gateway"])


@app.get("/")
async def root():
    return {
        "name": "ArcTreasury Copilot",
        "version": "1.0.0",
        "docs": "/docs",
        "api": "/api/health",
    }
