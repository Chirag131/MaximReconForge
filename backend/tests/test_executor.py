import sys
from pathlib import Path

# Add repo root to sys.path so worker module can be imported
repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import pytest
from worker.runner.executor import build_cli_command, _truncate


def test_truncate_never_exceeds_cap():
    marker = b"\n[STDOUT TRUNCATED]"
    cap = 100
    data = b"x" * 500
    out = _truncate(data, cap, marker)
    # The whole payload (data slice + marker) must fit within the cap.
    assert len(out) <= cap
    assert out.endswith(marker)


def test_truncate_leaves_small_output_untouched():
    marker = b"\n[STDERR TRUNCATED]"
    data = b"short output"
    assert _truncate(data, 1000, marker) == data


def test_build_cli_command_subfinder():
    cmd = build_cli_command("run_subfinder", {"domain": "example.com"})
    assert cmd == ["subfinder", "-d", "example.com", "-silent", "-json"]


def test_build_cli_command_httpx():
    cmd = build_cli_command("run_httpx", {"targets": ["example.com", "sub.example.com"]})
    assert "httpx" in cmd[0]
    assert "-u" in cmd
    assert "example.com" in cmd
    assert "sub.example.com" in cmd


def test_build_cli_command_naabu():
    cmd = build_cli_command("run_naabu", {"target": "192.168.1.1", "ports": "80,443"})
    assert cmd == ["naabu", "-host", "192.168.1.1", "-silent", "-json", "-p", "80,443"]


def test_build_cli_command_nuclei():
    cmd = build_cli_command("run_nuclei", {"target": "example.com", "templates": ["cve-2023-1234"], "severity": "high"})
    assert "nuclei" in cmd[0]
    assert "-t" in cmd
    assert "cve-2023-1234" in cmd
    assert "-severity" in cmd
    assert "high" in cmd


def test_build_cli_command_sqlmap():
    cmd = build_cli_command("run_sqlmap", {"target_url": "http://example.com/item?id=1", "level": 2, "risk": 1})
    assert "sqlmap" in cmd[0]
    assert "http://example.com/item?id=1" in cmd
    assert "--level=2" in cmd
    assert "--risk=1" in cmd


def test_build_cli_command_invalid_tool():
    with pytest.raises(ValueError, match="Unsupported tool binary"):
        build_cli_command("unknown_tool", {})
