"""
ARQ Worker entry point for sandboxed security tool execution.

Jobs:
- run_tool_job: Executes a single tool call request (validated tool name + arguments).
- run_recon_pipeline: Deterministic recon pipeline (subfinder -> httpx -> naabu).
"""

from __future__ import annotations

import logging
import os
from typing import Any

from arq import run_worker
from arq.connections import RedisSettings

from worker.runner.executor import execute_tool_call

logger = logging.getLogger(__name__)


async def startup(ctx: dict[str, Any]) -> None:
    logger.info("Worker started up successfully.")


async def shutdown(ctx: dict[str, Any]) -> None:
    logger.info("Worker shut down cleanly.")


async def run_tool_job(
    ctx: dict[str, Any],
    engagement_id: str,
    tool_name: str,
    params: dict[str, Any],
    timeout_seconds: int = 300,
    output_cap_bytes: int = 1_000_000,
) -> dict[str, Any]:
    """ARQ job executing a single whitelisted tool call request."""
    logger.info("Worker received job: engagement=%s, tool=%s", engagement_id, tool_name)

    result = await execute_tool_call(
        tool_name=tool_name,
        params=params,
        timeout_seconds=timeout_seconds,
        output_cap_bytes=output_cap_bytes,
    )

    return {
        "engagement_id": engagement_id,
        "tool_name": tool_name,
        "success": result.success,
        "exit_code": result.exit_code,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "result_hash": result.result_hash,
        "error": result.error,
    }


async def run_recon(ctx: dict[str, Any], engagement_id: str) -> dict[str, Any]:
    """ARQ job executing the deterministic Recon pipeline."""
    logger.info("Worker starting Recon pipeline for engagement %s", engagement_id)
    # Stub for pipeline execution
    return {"engagement_id": engagement_id, "status": "recon_completed"}


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(
        os.environ.get("REDIS_URL", "redis://redis:6379/0")
    )
    on_startup = startup
    on_shutdown = shutdown
    functions = [run_tool_job, run_recon]


if __name__ == "__main__":
    run_worker(WorkerSettings)
