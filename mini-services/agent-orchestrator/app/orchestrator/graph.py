# AgentOS v2 — LangGraph Orchestrator
"""
Core orchestrator implementing a LangGraph StateGraph with:
- Supervisor node for dynamic routing
- Conditional edges based on state
- Human-in-the-loop support
- Error recovery with retry logic
- Checkpoint-based state persistence
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Literal

from langgraph.graph import END, START, StateGraph
from typing import Any as _Any
from langgraph.graph.state import CompiledStateGraph as CompiledGraph
from langgraph.checkpoint.memory import MemorySaver

from app.agents.executor import AGENT_REGISTRY, AgentRole, execute_agent
from app.core.config import AGENT_PIPELINE, MAX_PIPELINE_ERRORS
from app.core.schemas import (
    AgentOutput,
    AgentRole as AgentRoleEnum,
    GraphState,
    RunStatus,
)
from app.memory.store import session_memory

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# SUPERVISOR NODE — Dynamic Routing
# ═══════════════════════════════════════════════════════════════════

def supervisor_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    Supervisor determines which agent should execute next.
    Uses a round-robin strategy through the configured pipeline.
    """
    pipeline = [AgentRole(a.strip()) for a in AGENT_PIPELINE if a.strip() in [e.value for e in AgentRoleEnum]]
    current_step = state.get("current_step", 0)

    if current_step >= len(pipeline):
        # All agents have executed — route to END
        logger.info("Supervisor: all %d pipeline steps completed", len(pipeline))
        return {
            "next_agent": None,
            "status": RunStatus.COMPLETED,
            "messages": state.get("messages", []) + [{
                "role": "supervisor",
                "content": "Pipeline complete. All agents have finished execution.",
                "timestamp": datetime.utcnow().isoformat(),
            }],
        }

    next_agent = pipeline[current_step]
    logger.info(
        "Supervisor: routing to %s (step %d/%d)",
        next_agent.value, current_step + 1, len(pipeline),
    )

    return {
        "next_agent": next_agent.value,
        "current_step": current_step + 1,
        "total_steps": len(pipeline),
        "status": RunStatus.RUNNING,
        "messages": state.get("messages", []) + [{
            "role": "supervisor",
            "content": f"Routing to {next_agent.value} agent (step {current_step + 1}/{len(pipeline)})",
            "timestamp": datetime.utcnow().isoformat(),
        }],
    }


def route_after_supervisor(state: dict[str, Any]) -> str:
    """
    Conditional edge: decide whether to run an agent or end the pipeline.
    """
    next_agent = state.get("next_agent")
    status = state.get("status")

    # Check if human approval is required
    if state.get("require_human_approval"):
        logger.info("Pipeline paused for human approval")
        return "human_review"

    # Check for too many errors
    if state.get("error_count", 0) >= MAX_PIPELINE_ERRORS:
        logger.warning("Pipeline aborted: too many errors (%d)", state["error_count"])
        return "end"

    # Check if pipeline is complete
    if status == RunStatus.COMPLETED or next_agent is None:
        return "end"

    return next_agent


# ═══════════════════════════════════════════════════════════════════
# AGENT EXECUTION NODES
# ═══════════════════════════════════════════════════════════════════

def create_agent_node(role: AgentRole):
    """Factory function to create an agent execution node for the graph."""

    async def agent_node(state: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a specific agent and update the graph state.
        """
        logger.info("Executing agent node: %s", role.value)

        # Convert dict state to GraphState for type safety
        graph_state = GraphState(
            pipeline_id=state.get("pipeline_id", ""),
            task_title=state.get("task_title", ""),
            task_description=state.get("task_description", ""),
            priority=state.get("priority", "medium"),
            messages=state.get("messages", []),
            agent_outputs=state.get("agent_outputs", {}),
            accumulated_context=state.get("accumulated_context", ""),
            next_agent=state.get("next_agent"),
            require_human_approval=state.get("require_human_approval", False),
            error_count=state.get("error_count", 0),
            current_step=state.get("current_step", 0),
            total_steps=state.get("total_steps", 0),
            status=state.get("status", RunStatus.PENDING),
        )

        # Execute the agent
        output = await execute_agent(role, graph_state)

        # Update accumulated context
        new_context = graph_state.accumulated_context
        new_context += f"\n\n## {role.value.upper()} Agent Output\n\n"
        new_context += f"**Summary:** {output.summary}\n\n"
        if output.decisions:
            new_context += "**Key Decisions:**\n"
            for d in output.decisions:
                new_context += f"- {d}\n"
        if output.recommendations:
            new_context += "\n**Recommendations:**\n"
            for r in output.recommendations:
                new_context += f"- {r}\n"

        # Update error count
        new_error_count = graph_state.error_count
        if output.status == RunStatus.FAILED:
            new_error_count += 1

        # Store agent output
        agent_outputs = dict(graph_state.agent_outputs)
        agent_outputs[role.value] = output

        logger.info(
            "Agent node %s finished: status=%s, errors=%d",
            role.value, output.status.value, new_error_count,
        )

        return {
            "agent_outputs": agent_outputs,
            "accumulated_context": new_context,
            "error_count": new_error_count,
            "require_human_approval": output.require_human_approval or graph_state.require_human_approval,
            "messages": graph_state.messages + [{
                "role": role.value,
                "content": output.summary,
                "timestamp": datetime.utcnow().isoformat(),
                "status": output.status.value,
                "duration_ms": output.duration_ms,
            }],
        }

    return agent_node


def human_review_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    Human-in-the-loop node. Pauses execution pending human approval.
    In production, this would emit a notification and wait.
    For now, auto-approves after logging.
    """
    logger.warning(
        "Human review requested for pipeline %s — auto-approving in dev mode",
        state.get("pipeline_id"),
    )
    return {
        "require_human_approval": False,
        "messages": state.get("messages", []) + [{
            "role": "human_reviewer",
            "content": "Auto-approved (development mode). In production, this requires manual review.",
            "timestamp": datetime.utcnow().isoformat(),
        }],
    }


def finalize_node(state: dict[str, Any]) -> dict[str, Any]:
    """Final node: set pipeline status and record completion."""
    error_count = state.get("error_count", 0)
    status = RunStatus.COMPLETED if error_count == 0 else RunStatus.FAILED

    logger.info(
        "Pipeline %s finalized: status=%s, errors=%d, agents=%d",
        state.get("pipeline_id"), status.value, error_count,
        len(state.get("agent_outputs", {})),
    )

    return {
        "status": status,
        "messages": state.get("messages", []) + [{
            "role": "supervisor",
            "content": f"Pipeline {status.value}. Total errors: {error_count}.",
            "timestamp": datetime.utcnow().isoformat(),
        }],
    }


# ═══════════════════════════════════════════════════════════════════
# GRAPH BUILDER
# ═══════════════════════════════════════════════════════════════════

def build_graph() -> CompiledGraph:
    """
    Build the LangGraph StateGraph for the AgentOS pipeline.

    Graph structure:
        START → supervisor → [ceo | developer | qa | human_review | end]
        Each agent → supervisor (loop back for next agent routing)
        end → END
    """
    graph = StateGraph(dict)

    # Add all nodes
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("finalize", finalize_node)

    for role in AGENT_REGISTRY:
        node_fn = create_agent_node(role)
        graph.add_node(role.value, node_fn)

    # Entry point
    graph.add_edge(START, "supervisor")

    # Supervisor → conditional routing
    # Build the route mapping dynamically based on configured pipeline
    route_map: dict[str, str] = {"end": "finalize"}
    for role in AGENT_REGISTRY:
        route_map[role.value] = role.value
    route_map["human_review"] = "human_review"

    graph.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        route_map,
    )

    # Each agent → back to supervisor for next routing decision
    for role in AGENT_REGISTRY:
        graph.add_edge(role.value, "supervisor")

    # Human review → back to supervisor
    graph.add_edge("human_review", "supervisor")

    # Finalize → END
    graph.add_edge("finalize", END)

    # Compile with in-memory checkpoint saver
    checkpointer = MemorySaver()
    compiled = graph.compile(checkpointer=checkpointer)

    logger.info(
        "LangGraph compiled: nodes=%s, edges=supervisor-conditional",
        list(AGENT_REGISTRY.keys()),
    )
    return compiled


# ═══════════════════════════════════════════════════════════════════
# PIPELINE RUNNER (High-Level API)
# ═══════════════════════════════════════════════════════════════════

class PipelineRunner:
    """
    High-level pipeline execution manager.
    Wraps the compiled LangGraph with session management and state tracking.
    """

    def __init__(self):
        self._graph: CompiledGraph | None = None
        self._active_runs: dict[str, dict[str, Any]] = {}

    @property
    def graph(self) -> CompiledGraph:
        if self._graph is None:
            self._graph = build_graph()
        return self._graph

    def create_pipeline(
        self,
        task_title: str,
        task_description: str,
        pipeline_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new pipeline run record."""
        pid = pipeline_id or str(uuid.uuid4())
        run = {
            "id": pid,
            "task_title": task_title,
            "task_description": task_description,
            "status": RunStatus.PENDING,
            "created_at": datetime.utcnow().isoformat(),
        }
        self._active_runs[pid] = run
        session_memory.set(f"pipeline:{pid}", run)

        logger.info("Pipeline created: id=%s, task=%s", pid, task_title)
        return run

    async def execute_pipeline(
        self,
        pipeline_id: str,
        task_title: str,
        task_description: str,
    ) -> dict[str, Any]:
        """
        Execute the full agent pipeline for a given task.
        Returns the final graph state with all agent outputs.
        """
        logger.info("Starting pipeline execution: id=%s", pipeline_id)

        # Update status
        if pipeline_id in self._active_runs:
            self._active_runs[pipeline_id]["status"] = RunStatus.RUNNING
            session_memory.set(
                f"pipeline:{pipeline_id}",
                self._active_runs[pipeline_id],
            )

        # Initial state
        initial_state = {
            "pipeline_id": pipeline_id,
            "task_title": task_title,
            "task_description": task_description,
            "priority": "medium",
            "messages": [],
            "agent_outputs": {},
            "accumulated_context": "",
            "next_agent": None,
            "require_human_approval": False,
            "error_count": 0,
            "current_step": 0,
            "total_steps": len(AGENT_PIPELINE),
            "status": RunStatus.PENDING,
        }

        try:
            # Execute the compiled graph
            # LangGraph async invoke with thread_id for checkpointing
            config = {"configurable": {"thread_id": pipeline_id}}
            final_state = await self.graph.ainvoke(initial_state, config=config)

            # Extract results
            agent_results = []
            for role, output_data in final_state.get("agent_outputs", {}).items():
                if isinstance(output_data, AgentOutput):
                    agent_results.append(output_data.model_dump())
                elif isinstance(output_data, dict):
                    agent_results.append(output_data)

            result = {
                "id": pipeline_id,
                "task_title": task_title,
                "task_description": task_description,
                "status": final_state.get("status", "unknown"),
                "agent_results": agent_results,
                "error_count": final_state.get("error_count", 0),
                "accumulated_context": final_state.get("accumulated_context", ""),
                "messages": final_state.get("messages", []),
                "completed_at": datetime.utcnow().isoformat(),
            }

            # Update run record
            if pipeline_id in self._active_runs:
                self._active_runs[pipeline_id]["status"] = final_state.get("status", "unknown")
                session_memory.set(
                    f"pipeline:{pipeline_id}",
                    self._active_runs[pipeline_id],
                )

            logger.info(
                "Pipeline completed: id=%s, status=%s, agents=%d",
                pipeline_id,
                final_state.get("status"),
                len(agent_results),
            )
            return result

        except Exception as e:
            logger.error("Pipeline execution failed: id=%s, error=%s", pipeline_id, str(e))

            result = {
                "id": pipeline_id,
                "task_title": task_title,
                "task_description": task_description,
                "status": RunStatus.FAILED,
                "agent_results": [],
                "error_count": 1,
                "error": str(e),
                "completed_at": datetime.utcnow().isoformat(),
            }

            if pipeline_id in self._active_runs:
                self._active_runs[pipeline_id]["status"] = RunStatus.FAILED
                session_memory.set(
                    f"pipeline:{pipeline_id}",
                    self._active_runs[pipeline_id],
                )

            return result

    def get_pipeline_status(self, pipeline_id: str) -> dict[str, Any] | None:
        """Get the current status of a pipeline run."""
        return session_memory.get(f"pipeline:{pipeline_id}")

    @property
    def active_pipeline_count(self) -> int:
        return len(self._active_runs)


# ── Singleton ─────────────────────────────────────────────────────

pipeline_runner = PipelineRunner()
