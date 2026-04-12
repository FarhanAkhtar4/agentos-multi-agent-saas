# AgentOS v2 — Pydantic Schemas
"""
All structured data models used across agents and API endpoints.
Every inter-agent message MUST use these schemas — no free-text.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
# ENUMERATIONS
# ═══════════════════════════════════════════════════════════════════

class AgentRole(str, Enum):
    CEO = "ceo"
    DEVELOPER = "developer"
    QA = "qa"
    SUPERVISOR = "supervisor"
    HUMAN_REVIEWER = "human_reviewer"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    AWAITING_HUMAN = "awaiting_human"
    APPROVED = "approved"
    REJECTED = "rejected"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


# ═══════════════════════════════════════════════════════════════════
# STRUCTURED AGENT MESSAGES (Inter-Agent Bus)
# ═══════════════════════════════════════════════════════════════════

class StructuredMessage(BaseModel):
    """Base class for all inter-agent communications."""
    sender: AgentRole
    recipient: AgentRole | str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentInput(StructuredMessage):
    """Input payload sent to an agent."""
    task_title: str
    task_description: str
    context: list[dict[str, str]] = Field(default_factory=list)
    accumulated_context: str = ""
    pipeline_id: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM


class AgentOutput(StructuredMessage):
    """Structured output from an agent."""
    task_title: str
    status: RunStatus
    summary: str
    artifacts: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    raw_output: str = ""
    require_human_approval: bool = False
    approval_reason: str = ""
    duration_ms: int = 0


class SupervisorDecision(StructuredMessage):
    """Supervisor node routing decision."""
    next_agent: AgentRole
    reason: str
    accumulated_context: str = ""
    error_count: int = 0


# ═══════════════════════════════════════════════════════════════════
# PIPELINE & RUN MODELS
# ═══════════════════════════════════════════════════════════════════

class PipelineRun(BaseModel):
    """A complete pipeline execution record."""
    id: str
    task_title: str
    task_description: str
    status: RunStatus = RunStatus.PENDING
    agent_results: list[AgentOutput] = Field(default_factory=list)
    current_agent: str | None = None
    error_count: int = 0
    require_human_approval: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None


class AgentLogEntry(BaseModel):
    """A single log entry from an agent run."""
    run_id: str
    agent: AgentRole
    level: LogLevel
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════
# API REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════

class PipelineRequest(BaseModel):
    """Request to start a new pipeline run."""
    task_title: str = Field(..., min_length=1, max_length=500)
    task_description: str = Field(..., min_length=1, max_length=10000)
    priority: TaskPriority = TaskPriority.MEDIUM
    agent_pipeline: list[str] | None = None


class PipelineResponse(BaseModel):
    """Response after starting a pipeline."""
    success: bool
    pipeline_id: str
    status: RunStatus
    message: str = ""


class PipelineStatusResponse(BaseModel):
    """Detailed status of a pipeline run."""
    pipeline: PipelineRun
    agent_logs: list[AgentLogEntry] = Field(default_factory=list)


class ChatRequest(BaseModel):
    """Chat message to an agent."""
    message: str = Field(..., min_length=1, max_length=10000)
    session_id: str | None = None
    agent_type: AgentRole | None = None


class ChatResponse(BaseModel):
    """Response from an agent chat."""
    session_id: str
    message: str
    agent_type: AgentRole | None = None
    sources: list[dict[str, str]] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Service health check."""
    status: Literal["healthy", "degraded", "unhealthy"]
    version: str
    uptime_seconds: float
    active_pipelines: int
    chroma_status: str
    memory_sessions: int


class MemoryQueryRequest(BaseModel):
    """Request to query vector memory."""
    query: str = Field(..., min_length=1)
    n_results: int = Field(default=5, ge=1, le=50)
    agent_filter: str | None = None


class MemoryStoreRequest(BaseModel):
    """Request to store in vector memory."""
    text: str = Field(..., min_length=1)
    agent: AgentRole
    metadata: dict[str, Any] = Field(default_factory=dict)
    pipeline_id: str | None = None


class MemoryQueryResponse(BaseModel):
    """Response from vector memory query."""
    results: list[dict[str, Any]]
    count: int


class HumanApprovalRequest(BaseModel):
    """Human review decision."""
    pipeline_id: str
    approved: bool
    reviewer_notes: str = ""


# ═══════════════════════════════════════════════════════════════════
# LANGGRAPH STATE (TypedDict compatible)
# ═══════════════════════════════════════════════════════════════════

class GraphState(BaseModel):
    """LangGraph StateGraph state definition."""
    pipeline_id: str = ""
    task_title: str = ""
    task_description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    messages: list[dict[str, Any]] = Field(default_factory=list)
    agent_outputs: dict[str, AgentOutput] = Field(default_factory=dict)
    accumulated_context: str = ""
    next_agent: AgentRole | None = None
    require_human_approval: bool = False
    error_count: int = 0
    current_step: int = 0
    total_steps: int = 0
    status: RunStatus = RunStatus.PENDING
