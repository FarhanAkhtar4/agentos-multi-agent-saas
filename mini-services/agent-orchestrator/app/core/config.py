# AgentOS v2 — Core Configuration
"""
Central configuration module for the AgentOS orchestrator service.
All settings are loaded from environment variables with sensible defaults.
"""

import os
from typing import Literal

# ── Service Configuration ────────────────────────────────────────────
SERVICE_NAME: str = "agentos-orchestrator"
SERVICE_VERSION: str = "2.0.0"
DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

# ── Host & Port ─────────────────────────────────────────────────────
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "3100"))
WS_PORT: int = int(os.getenv("WS_PORT", "3101"))

# ── LLM Configuration ───────────────────────────────────────────────
# The Next.js frontend exposes /api/llm which wraps z-ai-web-dev-sdk
NEXTJS_URL: str = os.getenv("NEXTJS_URL", "http://localhost:3000")
LLM_API_URL: str = f"{NEXTJS_URL}/api/llm"
LLM_TIMEOUT: int = int(os.getenv("LLM_TIMEOUT", "120"))
LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "3"))
LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-chat")

# ── Agent Pipeline Configuration ────────────────────────────────────
# Minimum viable pipeline: CEO → Developer → QA
AGENT_PIPELINE: list[str] = os.getenv(
    "AGENT_PIPELINE", "ceo,developer,qa"
).split(",")

# Human-in-the-loop threshold (dollar amount)
HITL_FINANCIAL_THRESHOLD: float = float(os.getenv("HITL_FINANCIAL_THRESHOLD", "50.0"))

# Maximum sequential errors before pipeline abort
MAX_PIPELINE_ERRORS: int = int(os.getenv("MAX_PIPELINE_ERRORS", "3"))

# ── Memory Configuration ────────────────────────────────────────────
CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "/tmp/agentos_chroma")
CHROMA_COLLECTION: str = os.getenv("CHROMA_COLLECTION", "agentos_memory")
MEMORY_MAX_RESULTS: int = int(os.getenv("MEMORY_MAX_RESULTS", "10"))

# Session memory TTL in seconds (default: 24 hours)
SESSION_TTL: int = int(os.getenv("SESSION_TTL", "86400"))

# ── CORS Configuration ─────────────────────────────────────────────
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
