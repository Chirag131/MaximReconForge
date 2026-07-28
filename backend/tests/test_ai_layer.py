import pytest
from app.core.scope_guard import ScopeGuard, ScopeGuardRejection, extract_target_from_tool_call
from app.tools.registry import (
    TOOL_REGISTRY,
    get_tools_for_phase,
    validate_tool_call,
    PhaseCompleteInput,
)


def test_scope_guard_valid_targets():
    scope = [
        {"asset_type": "subdomain", "value": "example.com"},
        {"asset_type": "ip", "value": "192.168.1.50"},
        {"asset_type": "url", "value": "https://test.example.com/api"},
    ]
    guard = ScopeGuard(scope)

    # In scope tests
    guard.check("example.com")
    guard.check("sub.example.com")
    guard.check("192.168.1.50")
    guard.check("https://sub.example.com/path")


def test_scope_guard_rejections():
    scope = [
        {"asset_type": "subdomain", "value": "target.org"},
        {"asset_type": "ip", "value": "10.0.0.1"},
    ]
    guard = ScopeGuard(scope)

    with pytest.raises(ScopeGuardRejection):
        guard.check("evil.com")

    with pytest.raises(ScopeGuardRejection):
        guard.check("10.0.0.2")


def test_tool_registry_risky_gating():
    # Vuln analysis phase: sqlmap should not be listed
    vuln_tools = [t.name for t in get_tools_for_phase("vuln_analysis", risky_enabled=False)]
    assert "run_sqlmap" not in vuln_tools
    assert "run_ffuf" in vuln_tools

    # Exploitation phase without risky: sqlmap excluded
    exploit_no_risky = [t.name for t in get_tools_for_phase("exploitation", risky_enabled=False)]
    assert "run_sqlmap" not in exploit_no_risky

    # Exploitation phase with risky: sqlmap included
    exploit_risky = [t.name for t in get_tools_for_phase("exploitation", risky_enabled=True)]
    assert "run_sqlmap" in exploit_risky


def test_validate_tool_call():
    # Valid call
    validated = validate_tool_call("phase_complete", {"summary": "Finished analysis"})
    assert isinstance(validated, PhaseCompleteInput)
    assert validated.summary == "Finished analysis"

    # Invalid tool
    with pytest.raises(ValueError):
        validate_tool_call("nonexistent_tool", {})


def test_extract_target_from_tool_call():
    target = extract_target_from_tool_call("run_ffuf", {"target_url": "https://example.com/FUZZ"})
    assert target == "https://example.com/FUZZ"

    # phase_complete has no target
    assert extract_target_from_tool_call("phase_complete", {"summary": "done"}) is None
