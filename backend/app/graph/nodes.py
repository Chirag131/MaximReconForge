"""
LangGraph nodes for engagement supervisor and phase execution.
"""

from __future__ import annotations

import json
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
    store = ContextStore()
    findings = store.read_whiteboard_findings(state["engagement_id"])
    summary = store.read_whiteboard_summary(state["engagement_id"])

    context = f"Whiteboard Summary:\n{summary}\n\nFindings JSONL:\n{json.dumps(findings, default=str)}"

    cmd = VulnAnalysisCommander(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
        scope_entries=state.get("scope_entries", []),
    )
    res = await cmd.step(f"Analyze current findings and propose next action.\n\n{context}")
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
    store = ContextStore()
    findings = store.read_whiteboard_findings(state["engagement_id"])
    summary = store.read_whiteboard_summary(state["engagement_id"])

    context = f"Whiteboard Summary:\n{summary}\n\nFindings JSONL:\n{json.dumps(findings, default=str)}"

    cmd = ExploitationCommander(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
        scope_entries=state.get("scope_entries", []),
        risky_tools_enabled=state.get("risky_tools_enabled", False),
    )
    res = await cmd.step(f"Evaluate confirmed vulnerabilities for exploitation.\n\n{context}")
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
    findings = store.read_whiteboard_findings(state["engagement_id"])

    context = f"Whiteboard Summary:\n{summary}\n\nRecorded Findings JSONL ({len(findings)} items):\n{json.dumps(findings, default=str)}"
    report = await agent.generate_report(context)

    # Save final report
    rep_dir = store.get_engagement_dir(state["engagement_id"]) / "report"
    rep_dir.mkdir(parents=True, exist_ok=True)
    (rep_dir / "final_report.md").write_text(report, encoding="utf-8")

    return {
        "current_phase": "completed",
        "status": "completed",
    }
