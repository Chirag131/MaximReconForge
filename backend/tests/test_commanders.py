import pytest
from app.graph.commanders.commanders import (
    VulnAnalysisCommander,
    ExploitationCommander,
    ReportingAgent,
)
from app.llm.client import ToolCallRequest


def test_vuln_analysis_commander_init():
    scope = [{"asset_type": "subdomain", "value": "example.com"}]
    cmd = VulnAnalysisCommander(
        engagement_id="eng-123",
        target_domain="example.com",
        scope_entries=scope,
    )
    assert cmd.role == "vuln_analysis"
    assert cmd.risky_tools_enabled is False
    assert cmd.is_cap_exceeded() is False


def test_commander_tool_validation():
    scope = [{"asset_type": "subdomain", "value": "example.com"}]
    cmd = VulnAnalysisCommander(
        engagement_id="eng-123",
        target_domain="example.com",
        scope_entries=scope,
    )

    # Valid in-scope proposal
    valid_tc = ToolCallRequest(
        tool_name="run_ffuf",
        arguments={"target_url": "https://example.com/FUZZ", "wordlist": "common.txt"},
    )
    ok, err = cmd.validate_proposal(valid_tc)
    assert ok is True
    assert err == ""

    # Out-of-scope proposal
    invalid_tc = ToolCallRequest(
        tool_name="run_ffuf",
        arguments={"target_url": "https://evil.com/FUZZ", "wordlist": "common.txt"},
    )
    ok, err = cmd.validate_proposal(invalid_tc)
    assert ok is False
    assert "ScopeGuard rejected target" in err


def test_exploitation_commander_risky_gating():
    scope = [{"asset_type": "subdomain", "value": "example.com"}]
    cmd_no_risky = ExploitationCommander(
        engagement_id="eng-123",
        target_domain="example.com",
        scope_entries=scope,
        risky_tools_enabled=False,
    )
    assert cmd_no_risky.risky_tools_enabled is False

    cmd_risky = ExploitationCommander(
        engagement_id="eng-123",
        target_domain="example.com",
        scope_entries=scope,
        risky_tools_enabled=True,
    )
    assert cmd_risky.risky_tools_enabled is True
