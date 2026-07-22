from arq import run_worker
from arq.connections import RedisSettings
import os

async def startup(ctx):
    pass

async def shutdown(ctx):
    pass

async def run_recon(ctx, engagement_id: str) -> None:
    """PLACEHOLDER — real dispatch to executor.execute_tool_call() lands with the tool registry."""
    raise NotImplementedError("Tool registry not yet implemented")

class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://redis:6379/0"))
    on_startup = startup
    on_shutdown = shutdown
    functions = [run_recon]  # more tool-call functions registered here once registry.py is implemented

if __name__ == "__main__":
    run_worker(WorkerSettings)
