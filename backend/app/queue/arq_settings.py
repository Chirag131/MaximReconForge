from arq import create_pool
from arq.connections import RedisSettings, ArqRedis
from app.config import settings

_pool: ArqRedis | None = None

async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool

async def enqueue_recon_job(engagement_id: str) -> None:
    pool = await get_arq_pool()
    await pool.enqueue_job("run_recon", engagement_id)
