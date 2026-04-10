# AgentOS v2 — LLM Client
"""
Unified LLM client with round-robin failover, retry logic,
and structured output parsing. Calls the Next.js /api/llm endpoint
which wraps z-ai-web-dev-sdk.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import httpx

from app.core.config import (
    LLM_API_URL,
    LLM_MAX_RETRIES,
    LLM_MODEL,
    LLM_TIMEOUT,
    DEBUG,
)
from app.core.schemas import AgentOutput, AgentRole

logger = logging.getLogger(__name__)


class LLMResponse:
    """Wrapper around raw LLM API response."""

    def __init__(self, content: str, model: str, usage: dict[str, int], latency_ms: int):
        self.content = content
        self.model = model
        self.usage = usage
        self.latency_ms = latency_ms

    @property
    def token_count(self) -> int:
        return self.usage.get("total_tokens", 0)

    def __repr__(self) -> str:
        return f"LLMResponse(model={self.model}, tokens={self.token_count}, latency={self.latency_ms}ms)"


class LLMClient:
    """
    Production LLM client with:
    - Automatic retry with exponential backoff
    - Timeout handling
    - Structured output parsing
    - Token usage tracking
    """

    def __init__(
        self,
        api_url: str = LLM_API_URL,
        model: str = LLM_MODEL,
        timeout: int = LLM_TIMEOUT,
        max_retries: int = LLM_MAX_RETRIES,
    ):
        self.api_url = api_url
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self._client = httpx.AsyncClient(
            base_url=api_url,
            timeout=httpx.Timeout(timeout, connect=30.0),
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict[str, str] | None = None,
    ) -> LLMResponse:
        """
        Send a chat completion request with retry logic.
        Uses exponential backoff: 2s, 4s, 8s between retries.
        """
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            start_time = time.monotonic()

            try:
                payload: dict[str, Any] = {
                    "messages": messages,
                    "model": self.model,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if response_format:
                    payload["response_format"] = response_format

                logger.debug(
                    "LLM request: attempt=%d, model=%s, messages=%d",
                    attempt, self.model, len(messages),
                )

                response = await self._client.post(
                    "/",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                latency_ms = int((time.monotonic() - start_time) * 1000)
                content = ""
                usage = {"total_tokens": 0}

                # Handle z-ai-web-dev-sdk response format
                if "choices" in data:
                    content = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                elif "content" in data:
                    content = data["content"]
                    usage = data.get("usage", usage)
                elif "message" in data:
                    content = data["message"]
                    usage = data.get("usage", usage)
                else:
                    content = json.dumps(data, indent=2)

                result = LLMResponse(
                    content=content,
                    model=data.get("model", self.model),
                    usage=usage,
                    latency_ms=latency_ms,
                )

                logger.info(
                    "LLM response: model=%s, tokens=%d, latency=%dms",
                    result.model, result.token_count, result.latency_ms,
                )
                return result

            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(
                    "LLM timeout on attempt %d/%d: %s",
                    attempt, self.max_retries, str(e),
                )
            except httpx.HTTPStatusError as e:
                last_error = e
                logger.warning(
                    "LLM HTTP error %d on attempt %d/%d",
                    e.response.status_code, attempt, self.max_retries,
                )
                # Don't retry on 4xx client errors (except 429)
                if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                    break
            except Exception as e:
                last_error = e
                logger.error("LLM unexpected error on attempt %d: %s", attempt, str(e))

            # Exponential backoff before retry
            if attempt < self.max_retries:
                backoff = min(2 ** attempt, 16)
                logger.info("Retrying in %ds...", backoff)
                await asyncio.sleep(backoff)

        # All retries exhausted
        error_msg = f"LLM failed after {self.max_retries} retries: {last_error}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from last_error

    async def chat_with_structured_output(
        self,
        messages: list[dict[str, str]],
        output_schema: dict[str, Any],
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """
        Request structured JSON output from the LLM.
        Includes schema instruction in the system prompt.
        """
        schema_instruction = (
            "\n\nYou MUST respond with valid JSON matching this schema:\n"
            f"```json\n{json.dumps(output_schema, indent=2)}\n```\n"
            "Respond ONLY with the JSON object, no markdown fences, no explanation."
        )

        augmented_messages = []
        for i, msg in enumerate(messages):
            augmented_messages.append(msg)
            if msg.get("role") == "system" and i == 0:
                augmented_messages[-1] = {
                    "role": "system",
                    "content": msg["content"] + schema_instruction,
                }

        response = await self.chat(
            messages=augmented_messages,
            temperature=temperature,
            response_format={"type": "json_object"},
        )

        # Parse and validate JSON response
        try:
            # Strip any markdown fences
            content = response.content.strip()
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

            parsed = json.loads(content)
            return parsed
        except json.JSONDecodeError as e:
            logger.error("Failed to parse structured output: %s\nContent: %s", e, response.content[:500])
            return {
                "raw_output": response.content,
                "parse_error": str(e),
            }


# ── Singleton instance ──────────────────────────────────────────────

llm_client = LLMClient()


async def get_llm_response(
    system_prompt: str,
    user_message: str,
    context: str = "",
    temperature: float = 0.7,
) -> str:
    """
    Convenience function: get a simple text response from the LLM.
    """
    messages = [{"role": "system", "content": system_prompt}]
    if context:
        messages.append({"role": "system", "content": f"Context from previous agents:\n{context}"})
    messages.append({"role": "user", "content": user_message})

    response = await llm_client.chat(messages=messages, temperature=temperature)
    return response.content


async def get_structured_agent_output(
    agent_role: AgentRole,
    system_prompt: str,
    user_message: str,
    context: str = "",
) -> dict[str, Any]:
    """
    Convenience function: get structured JSON output from an agent.
    """
    messages = [{"role": "system", "content": system_prompt}]
    if context:
        messages.append({"role": "system", "content": f"Accumulated context:\n{context}"})
    messages.append({"role": "user", "content": user_message})

    return await llm_client.chat_with_structured_output(
        messages=messages,
        output_schema={
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "decisions": {"type": "array", "items": {"type": "string"}},
                "recommendations": {"type": "array", "items": {"type": "string"}},
                "artifacts": {"type": "array", "items": {"type": "string"}},
                "errors": {"type": "array", "items": {"type": "string"}},
                "raw_output": {"type": "string"},
            },
            "required": ["summary", "raw_output"],
        },
    )
