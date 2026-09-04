"""app/schemas/analyze.py — Analyze request/response schemas."""
import uuid
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    session_id: uuid.UUID
    query: str = Field(..., min_length=1, max_length=2000)
    # images come via multipart/form-data — not in this schema


class AnalyzeResponse(BaseModel):
    run_id: uuid.UUID
    status: str = "pending"
    stream_url: str   # e.g. "/api/v1/stream/{run_id}"
