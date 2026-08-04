import pytest
from app.graph.state import EngagementState
from app.graph.supervisor import build_supervisor_graph, route_after_abort_check


@pytest.mark.asyncio
async def test_supervisor_graph_assembly():
    graph = build_supervisor_graph()
    assert graph is not None


def test_route_after_abort_check_normal():
    state: EngagementState = {
        "status": "recon",
        "current_phase": "recon",
        "abort_requested": False,
    }
    next_node = route_after_abort_check(state)
    assert next_node == "recon"


def test_route_after_abort_check_aborted():
    state: EngagementState = {
        "status": "aborted",
        "current_phase": "recon",
        "abort_requested": True,
    }
    next_node = route_after_abort_check(state)
    assert next_node == "__end__"


@pytest.mark.asyncio
async def test_graph_execution_end_to_end(tmp_path, monkeypatch):
    """Test full LangGraph state transition through all 5 phases."""
    monkeypatch.setenv("ENGAGEMENTS_DIR", str(tmp_path))

    graph = build_supervisor_graph()

    initial_state: EngagementState = {
        "engagement_id": "test-eng-123",
        "target_domain": "example.com",
        "user_id": "user-456",
        "status": "pending",
        "current_phase": "recon",
        "abort_requested": False,
        "risky_tools_enabled": False,
        "iteration_count": 0,
        "token_usage": 0,
        "scope_entries": [],
        "assets": [],
        "findings": [],
        "messages": [],
    }

    # Execute graph
    final_state = await graph.ainvoke(initial_state)

    assert final_state["current_phase"] == "completed"
    assert final_state["status"] == "completed"
    assert len(final_state["scope_entries"]) > 0
