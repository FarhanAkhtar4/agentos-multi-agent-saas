# AgentOS v2 — Agent Tools
"""
Reusable tools that agents can invoke during execution.
Each tool has a clear schema, validation, and error handling.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


class ToolResult:
    """Structured result from a tool execution."""

    def __init__(self, success: bool, data: Any, message: str = ""):
        self.success = success
        self.data = data
        self.message = message

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "message": self.message,
        }

    def __repr__(self) -> str:
        status = "OK" if self.success else "FAIL"
        return f"ToolResult({status}: {self.message})"


# ═══════════════════════════════════════════════════════════════════
# TOOL: Task Analyzer
# ═══════════════════════════════════════════════════════════════════

class TaskAnalyzerTool:
    """Analyze a task description to extract key information."""

    def execute(self, task_description: str) -> ToolResult:
        """Extract structured information from a task description."""
        try:
            text = task_description.lower()

            # Detect task type
            task_types = {
                "api": any(w in text for w in ["api", "endpoint", "rest", "graphql"]),
                "database": any(w in text for w in ["database", "schema", "sql", "migration"]),
                "ui": any(w in text for w in ["ui", "ux", "frontend", "component", "page"]),
                "testing": any(w in text for w in ["test", "testing", "qa", "validation"]),
                "devops": any(w in text for w in ["deploy", "docker", "ci/cd", "kubernetes", "infrastructure"]),
                "security": any(w in text for w in ["auth", "security", "permission", "encryption"]),
            }

            detected_types = [t for t, detected in task_types.items() if detected]

            # Extract potential technologies mentioned
            tech_patterns = {
                "python": r"\bpython\b",
                "javascript": r"\b(javascript|js|node)\b",
                "typescript": r"\b(typescript|ts)\b",
                "react": r"\breact\b",
                "next.js": r"\bnext\.?js\b",
                "fastapi": r"\bfastapi\b",
                "docker": r"\bdocker\b",
                "postgresql": r"\b(postgres|postgresql)\b",
                "redis": r"\bredis\b",
                "aws": r"\baws\b",
                "langchain": r"\blangchain\b",
                "openai": r"\bopenai\b",
            }

            detected_techs = []
            for tech, pattern in tech_patterns.items():
                if re.search(pattern, text):
                    detected_techs.append(tech)

            # Estimate complexity
            word_count = len(task_description.split())
            sentence_count = len(re.split(r'[.!?]+', task_description))
            complexity = "low"
            if word_count > 200 or sentence_count > 10:
                complexity = "high"
            elif word_count > 50 or sentence_count > 3:
                complexity = "medium"

            return ToolResult(
                success=True,
                data={
                    "task_types": detected_types or ["general"],
                    "technologies": detected_techs,
                    "complexity": complexity,
                    "word_count": word_count,
                    "sentence_count": sentence_count,
                    "has_code_request": bool(re.search(r'\b(code|function|class|implement|build|create)\b', text)),
                    "has_deadline": bool(re.search(r'\b(deadline|due|by\s+\w+|urgent|asap)\b', text)),
                },
                message="Task analyzed successfully",
            )
        except Exception as e:
            return ToolResult(success=False, data={}, message=str(e))


# ═══════════════════════════════════════════════════════════════════
# TOOL: Code Validator
# ═══════════════════════════════════════════════════════════════════

class CodeValidatorTool:
    """Validate code snippets for common issues."""

    def execute(self, code: str, language: str = "python") -> ToolResult:
        """Check code for common anti-patterns and issues."""
        issues: list[dict[str, str]] = []

        # Common checks across languages
        if "TODO" in code or "FIXME" in code:
            issues.append({"level": "warn", "message": "Contains TODO/FIXME markers"})
        if "eval(" in code:
            issues.append({"level": "error", "message": "Uses eval() — security risk"})
        if "exec(" in code:
            issues.append({"level": "error", "message": "Uses exec() — security risk"})
        if "password" in code.lower() and "env" not in code.lower():
            issues.append({"level": "warn", "message": "Possible hardcoded password"})

        # Language-specific checks
        if language == "python":
            lines = code.split("\n")
            for i, line in enumerate(lines, 1):
                if "except:" in line and "Exception" not in line:
                    issues.append({"level": "warn", "message": f"Bare except at line {i}"})
                if "import *" in line:
                    issues.append({"level": "warn", "message": f"Wildcard import at line {i}"})
                if re.match(r'^\s*def\s+\w+\s*\([^)]*\)', line) and '"""' not in code[max(0, code.find(line)-50):code.find(line)+200]:
                    issues.append({"level": "info", "message": f"Function at line {i} may lack docstring"})

        return ToolResult(
            success=len([i for i in issues if i["level"] == "error"]) == 0,
            data={
                "issues": issues,
                "total_issues": len(issues),
                "error_count": len([i for i in issues if i["level"] == "error"]),
                "warn_count": len([i for i in issues if i["level"] == "warn"]),
            },
            message=f"Found {len(issues)} issues in {language} code",
        )


# ═══════════════════════════════════════════════════════════════════
# TOOL: Requirement Extractor
# ═══════════════════════════════════════════════════════════════════

class RequirementExtractorTool:
    """Extract structured requirements from natural language text."""

    def execute(self, text: str) -> ToolResult:
        """Extract requirements, constraints, and acceptance criteria."""
        try:
            sentences = re.split(r'(?<=[.!?])\s+', text)

            functional_reqs = []
            non_functional_reqs = []
            constraints = []
            acceptance_criteria = []

            for sentence in sentences:
                s = sentence.strip()
                if not s:
                    continue

                if any(w in s.lower() for w in ["must", "shall", "should", "need to", "require"]):
                    if any(w in s.lower() for w in ["fast", "performance", "scalable", "reliable", "secure", "available"]):
                        non_functional_reqs.append(s)
                    else:
                        functional_reqs.append(s)

                if any(w in s.lower() for w in ["constraint", "limitation", "only", "must not", "cannot", "restricted"]):
                    constraints.append(s)

                if any(w in s.lower() for w in ["given", "when", "then", "accept", "verify", "validate"]):
                    acceptance_criteria.append(s)

            return ToolResult(
                success=True,
                data={
                    "functional_requirements": functional_reqs,
                    "non_functional_requirements": non_functional_reqs,
                    "constraints": constraints,
                    "acceptance_criteria": acceptance_criteria,
                    "total_requirements": len(functional_reqs) + len(non_functional_reqs),
                    "coverage_score": min(100, (len(functional_reqs) + len(non_functional_reqs)) * 20),
                },
                message=f"Extracted {len(functional_reqs) + len(non_functional_reqs)} requirements",
            )
        except Exception as e:
            return ToolResult(success=False, data={}, message=str(e))


# ═══════════════════════════════════════════════════════════════════
# TOOL: Risk Analyzer
# ═══════════════════════════════════════════════════════════════════

class RiskAnalyzerTool:
    """Identify and score risks in a plan or implementation."""

    RISK_PATTERNS = {
        "security": [
            (r"password|secret|key|token", "high", "Potential credential exposure"),
            (r"sql|query|input.*without.*validation", "high", "SQL injection risk"),
            (r"upload|file.*accept", "medium", "File upload vulnerability"),
        ],
        "performance": [
            (r"loop.*nested|o\(n\^2\)|quadratic", "high", "Potential performance bottleneck"),
            (r"without.*limit|no.*pagination", "medium", "Unbounded data retrieval"),
            (r"sync.*request|blocking", "medium", "Blocking operation in async context"),
        ],
        "reliability": [
            (r"single.*point.*failure|no.*fallback", "high", "Single point of failure"),
            (r"no.*error.*handling|no.*try", "medium", "Missing error handling"),
            (r"no.*backup|no.*recovery", "medium", "No disaster recovery plan"),
        ],
    }

    def execute(self, text: str) -> ToolResult:
        """Analyze text for potential risks."""
        text_lower = text.lower()
        risks = []

        for category, patterns in self.RISK_PATTERNS.items():
            for pattern, severity, description in patterns:
                if re.search(pattern, text_lower):
                    risks.append({
                        "category": category,
                        "severity": severity,
                        "description": description,
                        "matched_pattern": pattern,
                    })

        # Calculate overall risk score
        severity_weights = {"low": 1, "medium": 3, "high": 5, "critical": 10}
        total_score = sum(severity_weights.get(r["severity"], 1) for r in risks)
        max_possible = sum(severity_weights.values()) * 3  # Normalize

        return ToolResult(
            success=True,
            data={
                "risks": risks,
                "total_risks": len(risks),
                "high_severity_count": len([r for r in risks if r["severity"] == "high"]),
                "risk_score": min(100, int((total_score / max(1, max_possible)) * 100)),
                "risk_level": "low" if total_score < 5 else "medium" if total_score < 15 else "high",
            },
            message=f"Identified {len(risks)} risks (score: {min(100, int((total_score / max(1, max_possible)) * 100))})",
        )


# ═══════════════════════════════════════════════════════════════════
# TOOL REGISTRY
# ═══════════════════════════════════════════════════════════════════

TOOLS: dict[str, Any] = {
    "task_analyzer": TaskAnalyzerTool(),
    "code_validator": CodeValidatorTool(),
    "requirement_extractor": RequirementExtractorTool(),
    "risk_analyzer": RiskAnalyzerTool(),
}


def get_tool(name: str) -> Any:
    """Get a tool instance by name."""
    tool = TOOLS.get(name)
    if not tool:
        raise ValueError(f"Unknown tool: {name}. Available: {list(TOOLS.keys())}")
    return tool


def list_tools() -> list[dict[str, str]]:
    """List all available tools with descriptions."""
    return [
        {"name": "task_analyzer", "description": "Analyze task descriptions to extract types, technologies, and complexity"},
        {"name": "code_validator", "description": "Validate code for anti-patterns and security issues"},
        {"name": "requirement_extractor", "description": "Extract structured requirements from natural language"},
        {"name": "risk_analyzer", "description": "Identify and score risks in plans or implementations"},
    ]
