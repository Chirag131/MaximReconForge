"""
Provider-agnostic LLM client.

Wraps the OpenAI SDK pointed at Groq's API. Groq's endpoint is fully
OpenAI-compatible, so switching to another OpenAI-compatible provider
(or to Anthropic via its own SDK) only requires changing the base_url
and api_key — no code changes in callers.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from openai import AsyncOpenAI

from app.config import settings
from app.llm.models import GROQ_BASE_URL, get_model_for_role

logger = logging.getLogger(__name__)


@dataclass
class TokenUsage:
    """Accumulated token usage for a session/phase."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    def add(self, usage: dict[str, int]) -> None:
        self.prompt_tokens += usage.get("prompt_tokens", 0)
        self.completion_tokens += usage.get("completion_tokens", 0)
        self.total_tokens += usage.get("total_tokens", 0)


@dataclass
class ToolCallRequest:
    """A structured tool call emitted by a Commander."""
    tool_name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    """Unified response from an LLM call."""
    content: str | None = None
    tool_calls: list[ToolCallRequest] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str = ""


class LLMClient:
    """Async LLM client backed by Groq (via OpenAI-compatible API).

    All Commander agents use this client. The model is selected per-role
    via ``get_model_for_role``, not hardcoded.
    """

    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=GROQ_BASE_URL,
        )
        self._usage = TokenUsage()

    @property
    def usage(self) -> TokenUsage:
        return self._usage

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        role: str = "vuln_analysis",
        escalation: bool = False,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        temperature: float = 0.0,
    ) -> LLMResponse:
        """Send a chat completion request.

        Args:
            messages: OpenAI-format message list.
            role: Commander role for model selection.
            escalation: If True and role is exploitation, use the
                escalation-tier model.
            tools: OpenAI function-calling tool definitions.
            response_format: Structured output schema (json_schema/json_mode).
            temperature: Sampling temperature (0.0 = deterministic).

        Returns:
            Unified LLMResponse with content, tool calls, and usage.
        """
        model = get_model_for_role(role, escalation=escalation)

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        if response_format:
            kwargs["response_format"] = response_format

        logger.info("LLM request: model=%s, role=%s, msgs=%d", model, role, len(messages))

        completion = await self._client.chat.completions.create(**kwargs)
        choice = completion.choices[0]

        # Track token usage
        if completion.usage:
            usage_dict = {
                "prompt_tokens": completion.usage.prompt_tokens or 0,
                "completion_tokens": completion.usage.completion_tokens or 0,
                "total_tokens": completion.usage.total_tokens or 0,
            }
            self._usage.add(usage_dict)
        else:
            usage_dict = {}

        # Parse tool calls if present
        tool_calls: list[ToolCallRequest] = []
        if choice.message.tool_calls:
            import json
            for tc in choice.message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, TypeError):
                    args = {}
                tool_calls.append(
                    ToolCallRequest(tool_name=tc.function.name, arguments=args)
                )

        return LLMResponse(
            content=choice.message.content,
            tool_calls=tool_calls,
            usage=usage_dict,
            finish_reason=choice.finish_reason or "",
        )
