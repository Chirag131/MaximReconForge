"""
LangGraph Supervisor graph definition for MaximReconForge.

Routes engagements through 5 phases:
Recon (no LLM) -> Enumeration (no LLM) -> Vuln-Analysis (Commander)
-> Exploitation (Commander) -> Reporting (LLM) -> Completed.
"""

from __future__ import annotations

import logging
from langgraph.graph import StateGraph, END

from app.graph.state import EngagementState
from app.graph.nodes import (
    check_abort_node,
    recon_node,
    enumeration_node,
    vuln_analysis_node,
    exploitation_node,
    reporting_node,
)

logger = logging.getLogger(__name__)


def route_after_abort_check(state: EngagementState) -> str:
    """Route to next phase or END if abort requested."""
    if state.get("status") == "aborted":
        return END
    return state.get("current_phase", "recon")


def build_supervisor_graph() -> StateGraph:
    """Assemble and return the compiled LangGraph supervisor workflow."""
    workflow = StateGraph(EngagementState)

    # Add phase nodes
    workflow.add_node("check_abort", check_abort_node)
    workflow.add_node("recon", recon_node)
    workflow.add_node("enumeration", enumeration_node)
    workflow.add_node("vuln_analysis", vuln_analysis_node)
    workflow.add_node("exploitation", exploitation_node)
    workflow.add_node("reporting", reporting_node)

    # Entry point
    workflow.set_entry_point("check_abort")

    # Routing
    workflow.add_conditional_edges(
        "check_abort",
        route_after_abort_check,
        {
            "recon": "recon",
            "enumeration": "enumeration",
            "vuln_analysis": "vuln_analysis",
            "exploitation": "exploitation",
            "reporting": "reporting",
            END: END,
        },
    )

    # Linear phase transitions with abort check step before transitions
    workflow.add_edge("recon", "enumeration")
    workflow.add_edge("enumeration", "vuln_analysis")
    workflow.add_edge("vuln_analysis", "exploitation")
    workflow.add_edge("exploitation", "reporting")
    workflow.add_edge("reporting", END)

    return workflow.compile()
