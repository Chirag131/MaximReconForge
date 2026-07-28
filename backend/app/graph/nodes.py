"""
LangGraph nodes for engagement supervisor and phase execution.
"""

from __future__ import annotations

import logging
from typing import Any

from app.graph.state import EngagementState
from app.graph.commanders.commanders import (
    VulnAnalysisCommander,
    ExploitationCommander,
    ReportingAgent,
)
from app.context_store.store import ContextStore, Aggregator

logger = logging.getLogger(__name__)


async def check_abort_node(state: EngagementState) -> dict[str, Any]:
    """Check if engagement abort was requested."""
    if state.get("abort_requested", False):
        return {"status": "aborted", "current_phase": "aborted"}
    return {}


async def recon_node(state: EngagementState) -> dict[str, Any]:
    """Recon phase (deterministic pipeline, no LLM)."""
    logger.info("Executing Recon phase for %s", state["engagement_id"])
    # Recon locks scope at completion
    domain = state["target_domain"]
    scope = [
        {"asset_type": "subdomain", "value": domain},
        {"asset_type": "url", "value": f"https://{domain}"},
    ]
    return {
        "current_phase": "enumeration",
        "status": "enumeration",
        "scope_entries": scope,
    }


async def enumeration_node(state: EngagementState) -> dict[str, Any]:
    """Enumeration phase (deterministic pipeline, no LLM)."""
    logger.info("Executing Enumeration phase for %s", state["engagement_id"])
    return {
        "current_phase": "vuln_analysis",
        "status": "vuln_analysis",
    }


async def vuln_analysis_node(state: EngagementState) -> dict[str, Any]:
    """Vuln-Analysis phase (Commander loop)."""
    logger.info("Executing Vuln-Analysis phase for %s", state["engagement_id"])
    cmd = VulnAnalysisCommander(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
        scope_entries=state.get("scope_entries", []),
    )
    # Perform reasoning step
    res = await cmd.step("Analyze current findings and propose next action.")
    logger.info("VulnAnalysis result: %s", res)

    return {
        "current_phase": "exploitation",
        "status": "exploitation",
        "iteration_count": cmd.iteration_count,
        "token_usage": cmd.token_usage,
    }


async def exploitation_node(state: EngagementState) -> dict[str, Any]:
    """Exploitation phase (Commander loop)."""
    logger.info("Executing Exploitation phase for %s", state["engagement_id"])
    cmd = ExploitationCommander(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
        scope_entries=state.get("scope_entries", []),
        risky_tools_enabled=state.get("risky_tools_enabled", False),
    )
    res = await cmd.step("Evaluate confirmed vulnerabilities for exploitation.")
    logger.info("Exploitation result: %s", res)

    return {
        "current_phase": "reporting",
        "status": "reporting",
        "iteration_count": cmd.iteration_count,
        "token_usage": cmd.token_usage,
    }


async def reporting_node(state: EngagementState) -> dict[str, Any]:
    """Reporting phase (single LLM call)."""
    logger.info("Executing Reporting phase for %s", state["engagement_id"])
    agent = ReportingAgent(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
    )
    store = ContextStore()
    summary = store.read_whiteboard_summary(state["engagement_id"]) or "No whiteboard summary provided."
    report = await agent.generate_report(summary)

    # Save final report
    rep_dir = store.get_engagement_dir(state["engagement_id"]) / "report"
    rep_dir.mkdir(parents=True, exist_ok=True)
    (rep_dir / "final_report.md").write_text(report, encoding="utf-8")

    return {
        "current_phase": "completed",
        "status": "completed",
    }
