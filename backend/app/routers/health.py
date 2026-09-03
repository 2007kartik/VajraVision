"""app/routers/health.py — /health endpoint."""
import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.database import engine
from app.redis_client import get_redis

router = APIRouter(prefix="/api/v1", tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health", summary="Health check")
async def health():
    status = {"status": "ok", "postgres": "unknown", "redis": "unknown"}

    # PostgreSQL check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["postgres"] = "ok"
    except Exception as exc:
        logger.warning("Postgres health check failed: %s", exc)
        status["postgres"] = "error"
        status["status"] = "degraded"

    # Redis check
    try:
        r = await get_redis()
        await r.ping()
        status["redis"] = "ok"
    except Exception as exc:
        logger.warning("Redis health check failed: %s", exc)
        status["redis"] = "error"
        status["status"] = "degraded"

    return status
