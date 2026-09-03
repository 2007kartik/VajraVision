"""
app/main.py — FastAPI application entry point.

Responsibilities:
- Create the FastAPI app with metadata and CORS
- Register all routers
- Manage database + Redis lifecycle via async lifespan
- Run Alembic migrations on startup (dev/staging only)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine
from app.redis_client import close_redis, get_redis
from app.routers import health, sessions, analyze, stream, runs
from app.routers import audit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    logger.info("=== SatQuery AI Backend starting ===")

    # ── Verify DB tables exist (create them if not — for dev convenience)
    from app.database import Base
    from app.models import UserSession, AnalysisRun, TraceEvent  # noqa: F401 — register models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("PostgreSQL tables verified / created.")

    # ── Verify Redis connectivity
    try:
        r = await get_redis()
        await r.ping()
        logger.info("Redis connection OK.")
    except Exception as exc:
        logger.warning("Redis unavailable at startup: %s", exc)

    # ── Pre-compile LangGraph agent (eager, so first request is fast)
    from app.agent.graph import get_compiled_graph
    get_compiled_graph()

    yield   # app runs here

    # ── Teardown
    await engine.dispose()
    await close_redis()
    logger.info("=== SatQuery AI Backend stopped ===")


def create_app() -> FastAPI:
    app = FastAPI(
        title="SatQuery AI — Backend",
        description=(
            "Agentic backend for satellite image analysis. "
            "Powered by LangGraph + Gemini VLMs."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ───────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Run-Id"],
    )

    # ── Routers ────────────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(sessions.router)
    app.include_router(analyze.router)
    app.include_router(stream.router)
    app.include_router(runs.router)
    app.include_router(audit.router)

    return app


app = create_app()
