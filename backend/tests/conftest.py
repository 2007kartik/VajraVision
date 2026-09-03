"""tests/conftest.py — Shared pytest fixtures."""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Point to a test SQLite DB so tests don't need a live Postgres
os.environ.setdefault(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./test_satquery.db",
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("GEMINI_API_KEY", "test-key-not-real")
os.environ.setdefault("APP_ENV", "test")

from app.main import app  # noqa: E402 — must import after env setup


@pytest_asyncio.fixture
async def client():
    """Async HTTP test client for the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
