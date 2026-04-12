# AgentOS v2 — FastAPI Application
"""
Main FastAPI application entry point with all API routes.
Serves as the backend for the AgentOS multi-agent platform.
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import (
    AGENT_PIPELINE,
    CORS_ORIGINS,
    SERVICE_NAME,
    SERVICE_VERSION,
    WS_PORT,
)
from app.core.schemas import (
    AgentRole,
    ChatRequest,
    ChatResponse,
    HealthResponse,
    HumanApprovalRequest,
    MemoryQueryRequest,
    MemoryQueryResponse,
    MemoryStoreRequest,
    PipelineRequest,
    PipelineResponse,
    PipelineStatusResponse,
)
from app.memory.store import memory_store, session_memory, initialize_memory
from app.orchestrator.graph import pipeline_runner
from app.tools.registry import list_tools as list_available_tools
from app.agents.executor import AGENT_REGISTRY

# ── Logging Setup ──────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

_start_time = time.monotonic()


# ── Lifespan ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("Starting %s v%s...", SERVICE_NAME, SERVICE_VERSION)

    # Initialize memory stores
    initialize_memory()

    logger.info(
        "AgentOS ready: agents=%s, memory_docs=%d",
        [r.value for r in AGENT_REGISTRY],
        memory_store.document_count,
    )
    yield

    logger.info("Shutting down %s...", SERVICE_NAME)


# ── FastAPI App ────────────────────────────────────────────────────

app = FastAPI(
    title="AgentOS v2 — Multi-Agent Orchestrator",
    description="LangGraph-based cognitive architecture for autonomous multi-agent task execution",
    version=SERVICE_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
# HEALTH & SYSTEM ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Service health check endpoint."""
    uptime = time.monotonic() - _start_time
    try:
        chroma_ok = "connected" if memory_store.is_ready else "disconnected"
    except Exception:
        chroma_ok = "error"

    active = pipeline_runner.active_pipeline_count
    sessions = session_memory.count

    status = "healthy"
    if not memory_store.is_ready:
        status = "degraded"
    if active > 10:
        status = "degraded"

    return HealthResponse(
        status=status,
        version=SERVICE_VERSION,
        uptime_seconds=round(uptime, 2),
        active_pipelines=active,
        chroma_status=chroma_ok,
        memory_sessions=sessions,
    )


@app.get("/api/v1/agents", tags=["Agents"])
async def list_agents():
    """List all registered agents with their configurations."""
    agents = []
    for role, agent in AGENT_REGISTRY.items():
        agents.append({
            "role": role.value,
            "name": agent.name,
            "description": agent.description,
            "status": "available",
        })
    return {"success": True, "data": agents}


@app.get("/api/v1/tools", tags=["Tools"])
async def list_tools():
    """List all available tools that agents can use."""
    return {"success": True, "data": list_available_tools()}


# ═══════════════════════════════════════════════════════════════════
# PIPELINE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/v1/pipeline/run", response_model=PipelineResponse, tags=["Pipeline"])
async def run_pipeline(request: PipelineRequest):
    """
    Execute a new agent pipeline.
    Runs: Supervisor → CEO → Developer → QA (configurable).
    """
    logger.info(
        "Pipeline request: title=%s, priority=%s",
        request.task_title, request.priority,
    )

    # Create pipeline record
    run = pipeline_runner.create_pipeline(
        task_title=request.task_title,
        task_description=request.task_description,
    )

    # Execute pipeline asynchronously
    try:
        result = await pipeline_runner.execute_pipeline(
            pipeline_id=run["id"],
            task_title=request.task_title,
            task_description=request.task_description,
        )

        status = result.get("status", "unknown")
        return PipelineResponse(
            success=status != "failed",
            pipeline_id=run["id"],
            status=status,
            message=f"Pipeline completed with status: {status}",
        )
    except Exception as e:
        logger.error("Pipeline execution error: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/pipeline/{pipeline_id}", tags=["Pipeline"])
async def get_pipeline_status(pipeline_id: str):
    """Get the status of a specific pipeline run."""
    status = pipeline_runner.get_pipeline_status(pipeline_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} not found")
    return {"success": True, "data": status}


@app.get("/api/v1/pipelines", tags=["Pipeline"])
async def list_pipelines():
    """List all pipeline runs."""
    keys = session_memory.keys("pipeline:*")
    pipelines = []
    for key in keys:
        data = session_memory.get(key)
        if data:
            pipelines.append(data)
    return {"success": True, "data": pipelines, "count": len(pipelines)}


# ═══════════════════════════════════════════════════════════════════
# CHAT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/v1/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    """
    Send a message to an agent for a direct conversation.
    Uses the agent's system prompt with the accumulated memory context.
    """
    from app.core.llm_client import get_llm_response

    agent_role = request.agent_type or AgentRole.CEO
    session_id = request.session_id or f"chat-{int(time.time())}"

    # Retrieve relevant memory for context
    memory_results = memory_store.query(
        query_text=request.message,
        n_results=5,
        agent_filter=agent_role.value if request.agent_type else None,
    )

    context = ""
    if memory_results:
        context_parts = [r["text"] for r in memory_results if r.get("relevance", 0) > 0.3]
        if context_parts:
            context = "\n".join(context_parts)

    # Get agent for system prompt
    try:
        agent = AGENT_REGISTRY[agent_role]
        system_prompt = agent.system_prompt
    except KeyError:
        system_prompt = "You are a helpful AI assistant."

    # Get LLM response
    try:
        response = await get_llm_response(
            system_prompt=system_prompt,
            user_message=request.message,
            context=context,
        )

        # Store in memory
        memory_store.store(
            text=f"[chat:{agent_role.value}] User: {request.message}\nAgent: {response[:200]}",
            agent=agent_role,
            metadata={"type": "chat", "session_id": session_id},
        )

        return ChatResponse(
            session_id=session_id,
            message=response,
            agent_type=agent_role,
            sources=[{"text": r["text"], "relevance": str(r.get("relevance", 0))} for r in memory_results[:3]],
        )
    except Exception as e:
        logger.error("Chat error: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Agent chat failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# MEMORY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/v1/memory/store", tags=["Memory"])
async def store_memory(request: MemoryStoreRequest):
    """Store a document in vector memory."""
    try:
        doc_id = memory_store.store(
            text=request.text,
            agent=request.agent,
            pipeline_id=request.pipeline_id,
            metadata=request.metadata,
        )
        return {"success": True, "data": {"document_id": doc_id}, "message": "Memory stored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/memory/query", response_model=MemoryQueryResponse, tags=["Memory"])
async def query_memory(request: MemoryQueryRequest):
    """Query vector memory for semantically similar documents."""
    try:
        results = memory_store.query(
            query_text=request.query,
            n_results=request.n_results,
            agent_filter=request.agent_filter,
        )
        return MemoryQueryResponse(results=results, count=len(results))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/memory/stats", tags=["Memory"])
async def memory_stats():
    """Get memory store statistics."""
    return {
        "success": True,
        "data": {
            "total_documents": memory_store.document_count,
            "chroma_status": "connected" if memory_store.is_ready else "disconnected",
            "session_count": session_memory.count,
        },
    }


# ═══════════════════════════════════════════════════════════════════
# HUMAN-IN-THE-LOOP ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/v1/human/approval", tags=["Human-in-the-Loop"])
async def human_approval(request: HumanApprovalRequest):
    """
    Submit a human approval/rejection decision for a pipeline.
    In production, this would resume a paused pipeline.
    """
    status = pipeline_runner.get_pipeline_status(request.pipeline_id)
    if not status:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    # Update pipeline status based on human decision
    decision = "approved" if request.approved else "rejected"
    status["human_decision"] = decision
    status["reviewer_notes"] = request.reviewer_notes
    session_memory.set(f"pipeline:{request.pipeline_id}", status)

    logger.info(
        "Human decision: pipeline=%s, decision=%s",
        request.pipeline_id, decision,
    )

    return {
        "success": True,
        "data": {
            "pipeline_id": request.pipeline_id,
            "decision": decision,
            "message": f"Pipeline {decision} by human reviewer",
        },
    }


# ═══════════════════════════════════════════════════════════════════
# CONFIG ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/v1/config", tags=["System"])
async def get_config():
    """Get current configuration (non-sensitive)."""
    return {
        "success": True,
        "data": {
            "version": SERVICE_VERSION,
            "agent_pipeline": AGENT_PIPELINE,
            "agents_available": [r.value for r in AGENT_REGISTRY],
            "tools_available": [t["name"] for t in list_available_tools()],
            "memory_ready": memory_store.is_ready,
            "memory_documents": memory_store.document_count,
        },
    }
