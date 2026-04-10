# AgentOS v2 — Agent Implementations
"""
Concrete agent implementations with structured I/O.
Each agent has a defined role, system prompt, and output schema.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.core.llm_client import get_llm_response, get_structured_agent_output
from app.core.schemas import (
    AgentInput,
    AgentOutput,
    AgentRole,
    GraphState,
    RunStatus,
)
from app.memory.store import memory_store

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# BASE AGENT
# ═══════════════════════════════════════════════════════════════════

class BaseAgent:
    """Abstract base agent with structured input/output."""

    role: AgentRole
    name: str
    description: str
    system_prompt: str = ""

    async def execute(
        self,
        state: GraphState,
        agent_input: AgentInput,
    ) -> AgentOutput:
        """
        Execute the agent with given input and accumulated state.
        Returns a structured AgentOutput — never free text.
        """
        raise NotImplementedError

    def _build_context_messages(
        self,
        agent_input: AgentInput,
        state: GraphState,
    ) -> list[dict[str, str]]:
        """Build the full message history including accumulated context."""
        messages = [{"role": "system", "content": self.system_prompt}]

        if state.accumulated_context:
            messages.append({
                "role": "system",
                "content": f"## Accumulated Context from Previous Agents\n\n{state.accumulated_context}",
            })

        # Include previous agent outputs for context
        for role, output in state.agent_outputs.items():
            messages.append({
                "role": "system",
                "content": f"## Output from {role.replace('_', ' ').title()} Agent\n\nSummary: {output.summary}",
            })

        messages.append({
            "role": "user",
            "content": f"## Task\n\nTitle: {agent_input.task_title}\n\nDescription: {agent_input.task_description}",
        })

        return messages


# ═══════════════════════════════════════════════════════════════════
# CEO AGENT — Strategic Analysis & Task Decomposition
# ═══════════════════════════════════════════════════════════════════

class CEOAgent(BaseAgent):
    """
    Chief Executive Officer agent.
    Responsible for: strategic analysis, feasibility assessment,
    task decomposition, risk identification, and resource planning.
    """

    role = AgentRole.CEO
    name = "CEO Agent"
    description = "Strategic analysis, task decomposition, and feasibility assessment"

    system_prompt = """You are the CEO Agent of AgentOS, a multi-agent AI company.
Your role is to analyze tasks from a strategic perspective and provide:

1. **Feasibility Assessment**: Can this task be completed? What are the constraints?
2. **Task Decomposition**: Break the task into clear, actionable sub-tasks
3. **Risk Analysis**: Identify potential risks and mitigation strategies
4. **Resource Planning**: Estimate complexity and required effort
5. **Success Criteria**: Define clear, measurable success criteria

Be concise, strategic, and actionable. Think like a technical CEO who understands both
business requirements and engineering constraints. Do NOT write code — that's the Developer's job.

IMPORTANT: Your output MUST be valid JSON matching the required schema."""


# ═══════════════════════════════════════════════════════════════════
# DEVELOPER AGENT — Technical Implementation
# ═══════════════════════════════════════════════════════════════════

class DeveloperAgent(BaseAgent):
    """
    Senior Developer agent.
    Responsible for: technical design, code generation, architecture decisions,
    and implementation planning based on CEO's strategic direction.
    """

    role = AgentRole.DEVELOPER
    name = "Developer Agent"
    description = "Technical design, architecture, and implementation planning"

    system_prompt = """You are the Developer Agent of AgentOS, a multi-agent AI company.
You are a senior full-stack engineer with expertise in:
- System architecture and design patterns
- API design (REST, GraphQL, WebSocket)
- Database design and optimization
- Security best practices
- Performance engineering

Given the strategic direction from the CEO agent, your responsibilities are:

1. **Technical Design**: Propose a clear technical architecture
2. **Implementation Plan**: Create a step-by-step implementation roadmap
3. **API Specification**: Define data models, endpoints, and interfaces
4. **Code Patterns**: Suggest specific design patterns and best practices
5. **Testing Strategy**: Define how to validate the implementation

Be technical and specific. Provide actual implementation details, not vague suggestions.
Include code snippets, database schemas, or API contracts where relevant.

IMPORTANT: Your output MUST be valid JSON matching the required schema."""


# ═══════════════════════════════════════════════════════════════════
# QA AGENT — Quality Assurance & Validation
# ═══════════════════════════════════════════════════════════════════

class QAAgent(BaseAgent):
    """
    QA Engineer agent.
    Responsible for: review of all previous agent outputs, validation,
    quality scoring, gap identification, and final recommendations.
    """

    role = AgentRole.QA
    name = "QA Agent"
    description = "Quality assurance, validation, and gap analysis"

    system_prompt = """You are the QA Agent of AgentOS, a multi-agent AI company.
You are a senior quality assurance engineer responsible for:

1. **Output Review**: Review ALL previous agents' outputs for completeness and quality
2. **Gap Analysis**: Identify missing requirements, edge cases, or incomplete work
3. **Quality Scoring**: Rate the overall quality of the pipeline output (1-10)
4. **Risk Identification**: Find potential issues in the proposed solution
5. **Recommendations**: Provide actionable improvements and next steps
6. **Final Assessment**: Give a clear go/no-go assessment with justification

Be thorough and critical. Your job is to catch problems BEFORE they reach production.
If something is incomplete or wrong, say so explicitly.

IMPORTANT: Your output MUST be valid JSON matching the required schema."""


# ═══════════════════════════════════════════════════════════════════
# AGENT REGISTRY
# ═══════════════════════════════════════════════════════════════════

AGENT_REGISTRY: dict[AgentRole, BaseAgent] = {
    AgentRole.CEO: CEOAgent(),
    AgentRole.DEVELOPER: DeveloperAgent(),
    AgentRole.QA: QAAgent(),
}


def get_agent(role: str | AgentRole) -> BaseAgent:
    """Get an agent instance by role."""
    if isinstance(role, str):
        role = AgentRole(role)
    agent = AGENT_REGISTRY.get(role)
    if not agent:
        raise ValueError(f"Unknown agent role: {role}")
    return agent


# ═══════════════════════════════════════════════════════════════════
# AGENT EXECUTION ENGINE
# ═══════════════════════════════════════════════════════════════════

async def execute_agent(
    role: AgentRole,
    state: GraphState,
) -> AgentOutput:
    """
    Execute an agent with full error handling, logging, and memory storage.
    This is the central execution point called by the LangGraph nodes.
    """
    agent = get_agent(role)
    start_time = time.monotonic()

    agent_input = AgentInput(
        sender=AgentRole.SUPERVISOR,
        recipient=role,
        task_title=state.task_title,
        task_description=state.task_description,
        context=[{"role": "system", "content": state.accumulated_context}],
        accumulated_context=state.accumulated_context,
        pipeline_id=state.pipeline_id,
        priority=state.priority,
    )

    logger.info(
        "Executing agent: %s (pipeline=%s, step=%d/%d)",
        role.value, state.pipeline_id, state.current_step + 1, state.total_steps,
    )

    try:
        # Build messages with full context
        messages = agent._build_context_messages(agent_input, state)

        # Get structured output from LLM
        structured = await get_structured_agent_output(
            agent_role=role,
            system_prompt=agent.system_prompt,
            user_message=f"Task: {state.task_title}\n\nDescription: {state.task_description}",
            context=state.accumulated_context,
        )

        duration_ms = int((time.monotonic() - start_time) * 1000)

        # Build structured output
        output = AgentOutput(
            sender=role,
            recipient=AgentRole.SUPERVISOR,
            task_title=state.task_title,
            status=RunStatus.COMPLETED,
            summary=structured.get("summary", ""),
            artifacts=structured.get("artifacts", []),
            decisions=structured.get("decisions", []),
            recommendations=structured.get("recommendations", []),
            errors=structured.get("errors", []),
            raw_output=structured.get("raw_output", ""),
            require_human_approval=False,
            duration_ms=duration_ms,
        )

        # Store in vector memory for future reference
        memory_text = f"[{role.value}] {state.task_title}: {output.summary}"
        memory_store.store(
            text=memory_text,
            agent=role,
            pipeline_id=state.pipeline_id,
            metadata={
                "task_title": state.task_title,
                "decisions_count": str(len(output.decisions)),
                "artifacts_count": str(len(output.artifacts)),
                "duration_ms": str(duration_ms),
            },
        )

        logger.info(
            "Agent %s completed: status=%s, duration=%dms, summary=%s",
            role.value, output.status.value, duration_ms,
            output.summary[:100],
        )
        return output

    except Exception as e:
        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.error("Agent %s failed: %s", role.value, str(e))

        return AgentOutput(
            sender=role,
            recipient=AgentRole.SUPERVISOR,
            task_title=state.task_title,
            status=RunStatus.FAILED,
            summary=f"Agent execution failed: {str(e)}",
            errors=[str(e)],
            raw_output="",
            duration_ms=duration_ms,
        )
