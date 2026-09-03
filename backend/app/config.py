"""
app/config.py — Centralised settings via pydantic-settings.
All values are read from environment variables or the .env file in backend/.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Gemini ─────────────────────────────────────────────────────────────────
    gemini_api_key: str = ""

    # ── LangSmith Tracing ───────────────────────────────────────────────────────
    langchain_tracing_v2: bool = False
    langchain_endpoint: str = "https://api.smith.langchain.com"
    langchain_api_key: str = ""
    langchain_project: str = "satquery-ai"

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://satquery:satquery_secret@localhost:5432/satquery_db"
    )

    # ── Redis ──────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── App ────────────────────────────────────────────────────────────────────
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "info"

    # ── CORS ───────────────────────────────────────────────────────────────────
    cors_origins: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # ── Rate limiting ──────────────────────────────────────────────────────────
    rate_limit_requests: int = 10
    rate_limit_window_seconds: int = 60

    # ── Caching ────────────────────────────────────────────────────────────────
    cache_ttl_seconds: int = 21600        # 6 hours
    sse_event_ttl_seconds: int = 3600     # 1 hour


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton of Settings."""
    return Settings()
