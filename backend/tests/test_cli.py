import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import pytest
from run_cli import parse_args


def test_cli_argument_parsing(monkeypatch):
    monkeypatch.setattr("sys.argv", ["run_cli.py", "--target", "example.com", "--risky"])
    args = parse_args()
    assert args.target == "example.com"
    assert args.risky is True
