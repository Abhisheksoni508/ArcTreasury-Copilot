"""SQLite database setup and helpers."""

import aiosqlite
import os
from app.config import settings

DB_PATH = settings.DB_PATH


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    """Create tables if they don't exist."""
    db = await aiosqlite.connect(DB_PATH)
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")

    await db.executescript("""
        CREATE TABLE IF NOT EXISTS payout_batches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'DRAFT',
            total_amount REAL DEFAULT 0,
            item_count INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS payout_items (
            id TEXT PRIMARY KEY,
            batch_id TEXT REFERENCES payout_batches(id),
            recipient_name TEXT,
            recipient_address TEXT,
            amount REAL,
            currency TEXT DEFAULT 'USDC',
            destination_chain TEXT,
            category TEXT,
            decision TEXT DEFAULT 'PENDING',
            risk_score REAL DEFAULT 0,
            decision_reason TEXT DEFAULT '',
            execution_status TEXT DEFAULT 'PENDING',
            adapter_used TEXT,
            is_simulated INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS payout_legs (
            id TEXT PRIMARY KEY,
            item_id TEXT REFERENCES payout_items(id),
            leg_type TEXT,
            source_chain TEXT,
            destination_chain TEXT,
            amount REAL,
            status TEXT DEFAULT 'PENDING',
            tx_hash TEXT,
            adapter_used TEXT,
            attempt_number INTEGER DEFAULT 1,
            error_message TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            entity_type TEXT,
            entity_id TEXT,
            action TEXT,
            old_value TEXT,
            new_value TEXT,
            details TEXT,
            timestamp TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_activity (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            details TEXT,
            strategy TEXT,
            timestamp TEXT
        );

        CREATE TABLE IF NOT EXISTS treasury_positions (
            id TEXT PRIMARY KEY,
            asset_symbol TEXT NOT NULL,
            asset_name TEXT NOT NULL,
            category TEXT NOT NULL,
            amount_usdc REAL NOT NULL,
            shares REAL NOT NULL,
            apy REAL NOT NULL,
            risk_rating TEXT,
            status TEXT DEFAULT 'ACTIVE',
            chain TEXT,
            tx_hash TEXT,
            allocated_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS treasury_rebalance_history (
            id TEXT PRIMARY KEY,
            reserve_ratio_before REAL,
            reserve_ratio_after REAL,
            actions_taken TEXT,
            triggered_by TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS gateway_transactions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            fiat_amount REAL,
            fiat_currency TEXT,
            usdc_amount REAL,
            fee REAL,
            rail TEXT,
            status TEXT DEFAULT 'PENDING',
            bank_instructions TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    """)

    await db.commit()
    await db.close()


async def reset_db():
    """Drop and recreate all tables (for seed/demo reset)."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    await init_db()
