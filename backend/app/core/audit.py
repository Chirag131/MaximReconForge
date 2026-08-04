"""
Async audit logger — writes hash-chained event logs to Supabase audit_log table.

Per AGENTS.md §4:
- prev_hash and entry_hash are computed by a DB trigger (0003_audit_hash_chain.sql).
- NEVER set prev_hash or entry_hash from application code on insert.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


async def log_audit_event(
    db: AsyncSession,
    *,
    engagement_id: str,
    agent: str,
    action: str,
    params: dict[str, Any] | None = None,
    target: str | None = None,
    result_hash: str | None = None,
) -> None:
    """Write an audit log row to the audit_log table via raw SQL or SQLAlchemy.

    DB trigger `trg_audit_log_chain` handles prev_hash and entry_hash automatically.
    """
    params_json = params or {}

    query = text("""
        INSERT INTO audit_log (engagement_id, agent, action, params, target, result_hash, occurred_at)
        VALUES (:engagement_id, :agent, :action, :params, :target, :result_hash, :occurred_at)
    """)

    try:
        await db.execute(
            query,
            {
                "engagement_id": engagement_id,
                "agent": agent,
                "action": action,
                "params": json_dumps(params_json),
                "target": target,
                "result_hash": result_hash,
                "occurred_at": datetime.now(timezone.utc),
            },
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to write audit log event: %s", exc, exc_info=True)


def json_dumps(obj: Any) -> str:
    import json
    return json.dumps(obj, default=str)
