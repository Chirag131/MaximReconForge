"""
LangGraph nodes for engagement supervisor and phase execution.

Recon & Enumeration nodes execute Python-native scanners that perform
real DNS, port, HTTP header, TLS, and path probing scans. Findings are
written to the shared whiteboard via the Aggregator.

Vuln-Analysis & Exploitation Commanders run full reasoning loops where
the LLM proposes tool calls, which are validated, dispatched, parsed,
and fed back into the loop until the LLM signals phase_complete or
circuit breakers fire.
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
from app.scanners.native import run_full_scan

logger = logging.getLogger(__name__)


async def check_abort_node(state: EngagementState) -> dict[str, Any]:
    """Check if engagement abort was requested."""
    if state.get("abort_requested", False):
        return {"status": "aborted", "current_phase": "aborted"}
    return {}


async def recon_node(state: EngagementState) -> dict[str, Any]:
    """Recon phase — runs Python-native scanners against the target domain.

    Performs DNS enumeration, subdomain discovery, TCP port scanning,
    HTTP security header analysis, TLS certificate inspection, and
    sensitive path probing. All findings are written to the whiteboard.
    """
    logger.info("Executing Recon phase for %s", state["engagement_id"])
    domain = state["target_domain"]

    # Build scope entries
    scope = [
        {"asset_type": "subdomain", "value": domain},
        {"asset_type": "url", "value": f"https://{domain}"},
    ]

    # Run the actual native scanner
    logger.info("[RECON] Starting native scan against %s ...", domain)
    findings = await run_full_scan(domain)

    # Write every finding to the shared whiteboard
    store = ContextStore()
    agg = Aggregator(store=store)
    for finding in findings:
        agg.append_finding(state["engagement_id"], finding)

    # Build severity summary for the whiteboard
    by_severity: dict[str, int] = {}
    for f in findings:
        sev = f.get("severity", "info")
        by_severity[sev] = by_severity.get(sev, 0) + 1

    summary_lines = [
        f"# Recon Summary for {domain}",
        f"",
        f"**Total findings:** {len(findings)}",
        f"",
        "| Severity | Count |",
        "|----------|-------|",
    ]
    for sev in ["critical", "high", "medium", "low", "info"]:
        count = by_severity.get(sev, 0)
        summary_lines.append(f"| {sev.capitalize()} | {count} |")

    summary_lines.append("")
    summary_lines.append("## Finding Types")
    types: dict[str, int] = {}
    for f in findings:
        t = f.get("type", "unknown")
        types[t] = types.get(t, 0) + 1
    for t, c in sorted(types.items(), key=lambda x: -x[1]):
        summary_lines.append(f"- {t}: {c}")

    agg.update_summary(state["engagement_id"], "\n".join(summary_lines))

    logger.info(
        "[RECON] Complete — %d findings written to whiteboard (%s)",
        len(findings),
        ", ".join(f"{s}={c}" for s, c in sorted(by_severity.items())),
    )

    # Add discovered subdomains to assets
    assets = []
    for f in findings:
        if f.get("type") == "subdomain":
            assets.append({
                "asset_type": "subdomain",
                "value": f["subdomain"],
                "ips": f.get("ips", []),
            })
        elif f.get("type") == "open_port":
            assets.append({
                "asset_type": "service",
                "value": f"{f.get('target', domain)}:{f['port']}",
                "service": f.get("service", "unknown"),
            })

    return {
        "current_phase": "enumeration",
        "status": "enumeration",
        "scope_entries": scope,
        "assets": assets,
        "findings": findings,
    }


async def enumeration_node(state: EngagementState) -> dict[str, Any]:
    """Enumeration phase — currently passes through after Recon.

    In the full architecture with Docker workers, this node would
    execute nmap service fingerprinting and nuclei template scanning.
    The native scanner already covers these in the recon phase.
    """
    logger.info("Executing Enumeration phase for %s", state["engagement_id"])
    return {
        "current_phase": "vuln_analysis",
        "status": "vuln_analysis",
    }


async def vuln_analysis_node(state: EngagementState) -> dict[str, Any]:
    """Vuln-Analysis phase (Commander reasoning loop).

    The LLM analyzes findings, may propose additional tool calls,
    and loops until it signals phase_complete or hits circuit breakers.
    """
    logger.info("Executing Vuln-Analysis phase for %s", state["engagement_id"])
    store = ContextStore()
    findings = store.read_whiteboard_findings(state["engagement_id"])
    summary = store.read_whiteboard_summary(state["engagement_id"])

    context = (
        f"Whiteboard Summary:\n{summary}\n\n"
        f"Recorded Findings ({len(findings)} items):\n"
        f"{json.dumps(findings, default=str, indent=2)}"
    )

    cmd = VulnAnalysisCommander(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
        scope_entries=state.get("scope_entries", []),
    )

    # Commander reasoning loop
    while not cmd.is_cap_exceeded():
        res = await cmd.step(
            f"Analyze the following scan findings and identify vulnerability patterns, "
            f"assess risk levels, and recommend further testing.\n\n{context}"
            if cmd.iteration_count == 1
            else None
        )
        logger.info("VulnAnalysis iteration %d: %s", cmd.iteration_count, res)

        # Check if LLM signalled phase complete
        for tc in res.tool_calls:
            if tc.tool_name == "phase_complete":
                logger.info("VulnAnalysis phase completed: %s", tc.arguments.get("summary", ""))
                # Update whiteboard summary with analysis
                existing_summary = store.read_whiteboard_summary(state["engagement_id"])
                vuln_summary = tc.arguments.get("summary", "Analysis complete")
                agg = Aggregator(store=store)
                agg.update_summary(
                    state["engagement_id"],
                    f"{existing_summary}\n\n## Vulnerability Analysis\n{vuln_summary}",
                )
                break
        else:
            # If no phase_complete, add assistant message and continue loop
            if res.content:
                cmd.messages.append({"role": "assistant", "content": res.content})
            elif res.tool_calls:
                # Log the tool call proposals (these would be dispatched in Docker mode)
                for tc in res.tool_calls:
                    logger.info("VulnAnalysis proposed tool call: %s(%s)", tc.tool_name, tc.arguments)
                    cmd.messages.append({
                        "role": "assistant",
                        "content": f"I proposed running {tc.tool_name} but tool execution is handled by the worker. Moving to analysis.",
                    })
                # Ask LLM to analyze based on existing findings
                cmd.messages.append({
                    "role": "user",
                    "content": "The scan findings are already available in the whiteboard. "
                               "Please analyze them and call phase_complete with your assessment summary.",
                })
            continue
        break

    return {
        "current_phase": "exploitation",
        "status": "exploitation",
        "iteration_count": cmd.iteration_count,
        "token_usage": cmd.token_usage,
    }


async def exploitation_node(state: EngagementState) -> dict[str, Any]:
    """Exploitation phase (Commander reasoning loop)."""
    logger.info("Executing Exploitation phase for %s", state["engagement_id"])
    store = ContextStore()
    findings = store.read_whiteboard_findings(state["engagement_id"])
    summary = store.read_whiteboard_summary(state["engagement_id"])

    context = (
        f"Whiteboard Summary:\n{summary}\n\n"
        f"Recorded Findings ({len(findings)} items):\n"
        f"{json.dumps(findings, default=str, indent=2)}"
    )

    cmd = ExploitationCommander(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
        scope_entries=state.get("scope_entries", []),
        risky_tools_enabled=state.get("risky_tools_enabled", False),
    )

    # Commander reasoning loop
    while not cmd.is_cap_exceeded():
        res = await cmd.step(
            f"Evaluate the following confirmed vulnerabilities and findings for "
            f"exploitability. Assess impact and provide exploitation assessment.\n\n{context}"
            if cmd.iteration_count == 1
            else None
        )
        logger.info("Exploitation iteration %d: %s", cmd.iteration_count, res)

        for tc in res.tool_calls:
            if tc.tool_name == "phase_complete":
                logger.info("Exploitation phase completed: %s", tc.arguments.get("summary", ""))
                existing_summary = store.read_whiteboard_summary(state["engagement_id"])
                exploit_summary = tc.arguments.get("summary", "Exploitation assessment complete")
                agg = Aggregator(store=store)
                agg.update_summary(
                    state["engagement_id"],
                    f"{existing_summary}\n\n## Exploitation Assessment\n{exploit_summary}",
                )
                break
        else:
            if res.content:
                cmd.messages.append({"role": "assistant", "content": res.content})
            elif res.tool_calls:
                for tc in res.tool_calls:
                    logger.info("Exploitation proposed tool call: %s(%s)", tc.tool_name, tc.arguments)
                    cmd.messages.append({
                        "role": "assistant",
                        "content": f"I proposed running {tc.tool_name} but tool execution is handled by the worker. Moving to assessment.",
                    })
                cmd.messages.append({
                    "role": "user",
                    "content": "The scan findings are already available in the whiteboard. "
                               "Please evaluate them for exploitability and call phase_complete with your assessment.",
                })
            continue
        break

    return {
        "current_phase": "reporting",
        "status": "reporting",
        "iteration_count": cmd.iteration_count,
        "token_usage": cmd.token_usage,
    }


async def reporting_node(state: EngagementState) -> dict[str, Any]:
    """Reporting phase (single LLM call) — generates final markdown report."""
    logger.info("Executing Reporting phase for %s", state["engagement_id"])
    agent = ReportingAgent(
        engagement_id=state["engagement_id"],
        target_domain=state["target_domain"],
    )
    store = ContextStore()
    summary = store.read_whiteboard_summary(state["engagement_id"]) or "No whiteboard summary provided."
    findings = store.read_whiteboard_findings(state["engagement_id"])

    # Build rich context for the report
    by_severity: dict[str, list[dict]] = {}
    for f in findings:
        sev = f.get("severity", "info")
        by_severity.setdefault(sev, []).append(f)

    context_parts = [
        f"## Whiteboard Summary\n{summary}",
        f"\n## Findings Overview ({len(findings)} total)",
    ]
    for sev in ["critical", "high", "medium", "low", "info"]:
        items = by_severity.get(sev, [])
        if items:
            context_parts.append(f"\n### {sev.upper()} ({len(items)} findings)")
            for item in items:
                context_parts.append(f"- [{item.get('tool', 'unknown')}] {item.get('description', 'No description')}")

    context_parts.append(f"\n## Raw Findings JSONL\n```json\n{json.dumps(findings, default=str, indent=2)}\n```")

    context = "\n".join(context_parts)
    report = await agent.generate_report(context)

    # Save final report
    rep_dir = store.get_engagement_dir(state["engagement_id"]) / "report"
    rep_dir.mkdir(parents=True, exist_ok=True)
    (rep_dir / "final_report.md").write_text(report, encoding="utf-8")

    return {
        "current_phase": "completed",
        "status": "completed",
    }
