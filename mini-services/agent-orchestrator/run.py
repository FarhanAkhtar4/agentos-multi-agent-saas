# AgentOS v2 — Orchestrator Service Entry Point
"""
Run with: python -m app.main
Or: uvicorn app.main:app --host 0.0.0.0 --port 3100 --reload
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3100,
        reload=True,
        log_level="info",
    )
