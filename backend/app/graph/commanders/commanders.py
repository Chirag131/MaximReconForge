"""Vuln-Analysis and Exploitation Commander implementations."""

from __future__ import annotations

from app.config import settings
from app.graph.commanders.base import BaseCommander
from app.graph.prompts.system_prompts import (
    VULN_ANALYSIS_SYSTEM_PROMPT,
    EXPLOITATION_SYSTEM_PROMPT,
    REPORTING_SYSTEM_PROMPT,
)


class VulnAnalysisCommander(BaseCommander):
    def __init__(
        self,
        *,
        engagement_id: str,
        target_domain: str,
        scope_entries: list[dict[str, str]],
    ) -> None:
        prompt = VULN_ANALYSIS_SYSTEM_PROMPT.format(
            engagement_id=engagement_id,
            target_domain=target_domain,
        )
        super().__init__(
            role="vuln_analysis",
            system_prompt=prompt,
            engagement_id=engagement_id,
            target_domain=target_domain,
            scope_entries=scope_entries,
            risky_tools_enabled=False,
            iteration_cap=settings.vuln_analysis_iteration_cap,
            token_ceiling=settings.vuln_analysis_token_ceiling,
        )


class ExploitationCommander(BaseCommander):
    def __init__(
        self,
        *,
        engagement_id: str,
        target_domain: str,
        scope_entries: list[dict[str, str]],
        risky_tools_enabled: bool = False,
    ) -> None:
        prompt = EXPLOITATION_SYSTEM_PROMPT.format(
            engagement_id=engagement_id,
            target_domain=target_domain,
            risky_tools_enabled=risky_tools_enabled,
        )
        super().__init__(
            role="exploitation",
            system_prompt=prompt,
            engagement_id=engagement_id,
            target_domain=target_domain,
            scope_entries=scope_entries,
            risky_tools_enabled=risky_tools_enabled,
            iteration_cap=settings.exploitation_iteration_cap,
            token_ceiling=settings.exploitation_token_ceiling,
        )


class ReportingAgent:
    """Reporting agent — single call, generates markdown report."""

    def __init__(self, engagement_id: str, target_domain: str) -> None:
        self.engagement_id = engagement_id
        self.target_domain = target_domain
        self.prompt = REPORTING_SYSTEM_PROMPT.format(
            engagement_id=engagement_id,
            target_domain=target_domain,
        )

    async def generate_report(self, whiteboard_context: str) -> str:
        from app.llm.client import LLMClient

        client = LLMClient()
        messages = [
            {"role": "system", "content": self.prompt},
            {"role": "user", "content": f"Shared Whiteboard & Findings Summary:\n\n{whiteboard_context}"},
        ]
        res = await client.chat(messages=messages, role="reporting")
        return res.content or "# Report Generation Failed\nNo output produced."
