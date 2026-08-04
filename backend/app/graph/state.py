"""
LangGraph state schema for the engagement supervisor graph.

This TypedDict defines the shared state passed between the Supervisor
and all phase subgraphs. It carries everything needed for phase routing,
abort checks, circuit breakers, and accumulated findings.
"""

from __future__ import annotations

from typing import Any, Literal
from typing_extensions import TypedDict

from langgraph.graph import MessagesState


Phase = Literal[
    "pending",
    "recon",
    "enumeration",
    "vuln_analysis",
    "exploitation",
    "reporting",
    "completed",
    "aborted",
    "failed",
]


class EngagementState(TypedDict, total=False):
    """Top-level state for the engagement supervisor graph.

    Fields marked total=False are optional — they get populated
    as the engagement progresses through phases.
    """

    # --- Identity ---
    engagement_id: str
    target_domain: str
    user_id: str

    # --- Phase routing ---
    current_phase: Phase
    status: Phase

    # --- Scope (locked at end of Recon, immutable after) ---
    scope_entries: list[dict[str, str]]  # [{asset_type, value}, ...]

    # --- Abort ---
    abort_requested: bool

    # --- Circuit breakers (reset per phase) ---
    iteration_count: int
    token_usage: int  # total tokens consumed this phase

    # --- Risky tools ---
    risky_tools_enabled: bool

    # --- Accumulated data ---
    assets: list[dict[str, Any]]      # discovered hosts/IPs/ports
    findings: list[dict[str, Any]]    # vuln/exploit findings
    audit_events: list[dict[str, Any]]  # in-memory audit buffer

    # --- LLM conversation (for Commander loops) ---
    messages: list[dict[str, Any]]  # OpenAI-format message history


class CommanderState(TypedDict, total=False):
    """State scoped to a single Commander loop iteration.

    The Commander subgraph uses this internally; the Supervisor
    only sees EngagementState.
    """

    engagement_id: str
    phase: str
    iteration_count: int
    token_usage: int
    messages: list[dict[str, Any]]
    findings: list[dict[str, Any]]
    scope_entries: list[dict[str, str]]
    risky_tools_enabled: bool
    abort_requested: bool
    phase_complete: bool
    phase_complete_summary: str
