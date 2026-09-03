"""app/schemas/run.py — Run and trace response schemas."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class TraceEventResponse(BaseModel):
    id: int
    step_index: int
    node_name: str
    event_type: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class RunResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    query: str
    image_count: int
    task_type: str | None
    specialist: str | None
    model_used: str | None
    confidence: int | None
    answer_text: str | None
    status: str
    error_message: str | None
    duration_ms: int | None
    created_at: datetime
    trace_events: list[TraceEventResponse] = []

    model_config = {"from_attributes": True}


class HistoryResponse(BaseModel):
    session_id: uuid.UUID
    total: int
    runs: list[RunResponse]
