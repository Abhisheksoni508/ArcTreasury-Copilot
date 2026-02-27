#!/bin/bash
# Run ArcTreasury Copilot backend
cd "$(dirname "$0")"
pip install -r requirements.txt 2>/dev/null
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
