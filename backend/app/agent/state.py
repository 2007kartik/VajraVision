"""
app/agent/state.py — AgentState TypedDict.
This is the single mutable object that flows through every node in the
LangGraph DAG. Every node reads from it and returns a partial update.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional, Annotated

from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import AnyMessage


class ImageData(TypedDict):
    """A single uploaded image represented as base64 inline data."""
    filename: str
    mime_type: str
    base64_data: str   # raw base64, no data-URI prefix


class ValidationResult(TypedDict):
    compatible: bool
    issues: list[str]
    file_infos: list[dict[str, Any]]
    crs: str


class TraceEventData(TypedDict):
    step_index: int
    node_name: str
    event_type: str   # node_start | node_end | routing | error
    payload: dict[str, Any]
    ts: str           # ISO-8601


class AgentState(TypedDict, total=False):
    # ── Identity ───────────────────────────────────────────────────────────────
    run_id: str               # UUID string
    session_id: str           # UUID string

    # ── Input ──────────────────────────────────────────────────────────────────
    messages: Annotated[list[AnyMessage], add_messages] # Memory
    query: str
    images: list[ImageData]
    image_count: int

    # ── Classification output ──────────────────────────────────────────────────
    task_type: str            # SINGLE_VQA | SINGLE_CAPTION | SINGLE_GROUNDING | CROSS_MODAL | BITEMPORAL_CHANGE
    detected_input_type: str  # single | cross-modal | bi-temporal
    specialist: str
    routing_confidence: int
    routing_reasoning: str
    classification_model: str

    # ── Validation output ──────────────────────────────────────────────────────
    validation: Optional[ValidationResult]

    # ── Specialist output ──────────────────────────────────────────────────────
    answer_text: str
    answer_confidence: int
    model_used: str

    # ── Timing ─────────────────────────────────────────────────────────────────
    started_at: str           # ISO-8601 timestamp
    finished_at: Optional[str]
    duration_ms: Optional[int]

    # ── Trace log (append-only across nodes) ───────────────────────────────────
    trace_events: list[TraceEventData]

    # ── Error propagation ──────────────────────────────────────────────────────
    error: Optional[str]
    error_node: Optional[str]
