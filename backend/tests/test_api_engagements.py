import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import uuid
import pytest
from app.context_store.store import ContextStore


def test_context_store_report_filepath(tmp_path):
    store = ContextStore(base_dir=str(tmp_path))
    eng_id = str(uuid.uuid4())
    rep_dir = store.get_engagement_dir(eng_id) / "report"
    rep_dir.mkdir(parents=True, exist_ok=True)
    report_file = rep_dir / "final_report.md"
    report_file.write_text("# Test Report", encoding="utf-8")

    assert report_file.exists()
    assert report_file.read_text(encoding="utf-8") == "# Test Report"
