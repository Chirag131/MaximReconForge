"""Base Commander class encapsulating the reasoning loop and tool dispatch."""

from __future__ import annotations

import logging
from typing import Any

from app.config import settings
from app.core.scope_guard import ScopeGuard, extract_targets_from_tool_call, ScopeGuardRejection
from app.llm.client import LLMClient, LLMResponse, ToolCallRequest
from app.tools.registry import get_openai_tools_for_phase, validate_tool_call

logger = logging.getLogger(__name__)


class BaseCommander:
    """Base reasoning agent for an engagement phase.

    Handles:
    - Message history management
    - Tool filtering per phase
    - ScopeGuard validation before tool dispatch
    - Circuit breaker tracking (iteration count + token spend)
    """

    def __init__(
        self,
        *,
        role: str,
        system_prompt: str,
        engagement_id: str,
        target_domain: str,
        scope_entries: list[dict[str, str]],
        risky_tools_enabled: bool = False,
        iteration_cap: int = 10,
        token_ceiling: int = 100_000,
    ) -> None:
        self.role = role
        self.system_prompt = system_prompt
        self.engagement_id = engagement_id
        self.target_domain = target_domain
        self.scope_guard = ScopeGuard(scope_entries)
        self.risky_tools_enabled = risky_tools_enabled
        self.iteration_cap = iteration_cap
        self.token_ceiling = token_ceiling

        self.llm_client = LLMClient()
        self.iteration_count = 0
        self.token_usage = 0
        self.messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]

    def is_cap_exceeded(self) -> bool:
        return (
            self.iteration_count >= self.iteration_cap
            or self.token_usage >= self.token_ceiling
        )

    async def step(self, extra_context: str | None = None) -> LLMResponse:
        """Execute a single reasoning turn in the Commander loop.

        Returns the LLM's proposed tool call or final text.
        """
        self.iteration_count += 1

        if extra_context:
            self.messages.append({"role": "user", "content": extra_context})

        tools = get_openai_tools_for_phase(self.role, self.risky_tools_enabled)

        response = await self.llm_client.chat(
            messages=self.messages,
            role=self.role,
            tools=tools,
        )

        self.token_usage += response.usage.get("total_tokens", 0)
        return response

    def validate_proposal(self, tool_call: ToolCallRequest) -> tuple[bool, str]:
        """Validate a proposed tool call against schema and ScopeGuard.

        Returns (is_valid, reason_if_invalid).
        """
        # 1. Validate arguments against Pydantic schema
        try:
            validate_tool_call(tool_call.tool_name, tool_call.arguments)
        except ValueError as exc:
            return False, f"Schema validation error: {exc}"

        # 2. Extract every target and validate each against ScopeGuard. All
        #    targets in a multi-target call (e.g. run_httpx) must be in scope —
        #    a single out-of-scope entry rejects the whole proposal.
        targets = extract_targets_from_tool_call(tool_call.tool_name, tool_call.arguments)
        for target in targets:
            try:
                self.scope_guard.check(target)
            except ScopeGuardRejection as exc:
                return False, f"ScopeGuard rejected target '{target}': {exc.reason}"

        return True, ""
