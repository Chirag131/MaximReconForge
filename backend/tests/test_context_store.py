import pytest
from app.context_store.store import ContextStore, Aggregator


def test_context_store_paths(tmp_path):
    store = ContextStore(base_dir=str(tmp_path))

    # Test private scratchpad
    store.write_private_note("eng-1", "vuln_analysis", "notes.txt", "found admin path")
    note = store.read_private_note("eng-1", "vuln_analysis", "notes.txt")
    assert note == "found admin path"

    # Verify role isolation: exploitation role can't read vuln_analysis private note
    other_note = store.read_private_note("eng-1", "exploitation", "notes.txt")
    assert other_note == ""


def test_aggregator_whiteboard(tmp_path):
    store = ContextStore(base_dir=str(tmp_path))
    agg = Aggregator(store=store)

    # Append finding
    finding = {"tool": "nuclei", "severity": "high", "template_id": "cve-2023-1234"}
    agg.append_finding("eng-1", finding)

    findings = store.read_whiteboard_findings("eng-1")
    assert len(findings) == 1
    assert findings[0]["tool"] == "nuclei"
    assert findings[0]["severity"] == "high"

    # Update summary
    agg.update_summary("eng-1", "# Executive Summary\nTarget shows CVE-2023-1234.")
    summary = store.read_whiteboard_summary("eng-1")
    assert "CVE-2023-1234" in summary
