"""
app/services/run_service.py — CRUD helpers for AnalysisRun and TraceEvent.
Kept as free async functions (not a class) for simplicity.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import db_session
from app.models.run import AnalysisRun
from app.models.session import UserSession
from app.models.trace import TraceEvent


# ── Session ───────────────────────────────────────────────────────────────────

async def get_or_create_session(
    session_id: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> UserSession:
    """Return an existing session or create a new one with the given UUID."""
    sid = uuid.UUID(session_id)
    async with db_session() as db:
        row = await db.get(UserSession, sid)
        if row is None:
            row = UserSession(
                id=sid,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.add(row)
        return row


# ── Run ───────────────────────────────────────────────────────────────────────

async def create_run(
    run_id: str,
    session_id: str,
    query: str,
    image_count: int,
) -> AnalysisRun:
    """Insert a new run row with status='running'."""
    # Ensure the session exists to avoid foreign key violation
    await get_or_create_session(session_id)
    
    async with db_session() as db:
        run = AnalysisRun(
            id=uuid.UUID(run_id),
            session_id=uuid.UUID(session_id),
            query=query,
            image_count=image_count,
            status="running",
        )
        db.add(run)
        return run


async def update_run_completed(
    run_id: str,
    status: str,
    *,
    task_type: Optional[str] = None,
    specialist: Optional[str] = None,
    model_used: Optional[str] = None,
    confidence: Optional[int] = None,
    answer_text: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
    trace_events: Optional[list[dict[str, Any]]] = None,
) -> None:
    """Update the run row with results and persist trace events."""
    async with db_session() as db:
        run = await db.get(AnalysisRun, uuid.UUID(run_id))
        if run is None:
            return

        run.status = status
        if task_type:
            run.task_type = task_type
        if specialist:
            run.specialist = specialist
        if model_used:
            run.model_used = model_used
        if confidence is not None:
            run.confidence = confidence
        if answer_text:
            run.answer_text = answer_text
        if error_message:
            run.error_message = error_message
        if duration_ms is not None:
            run.duration_ms = duration_ms

        # Persist trace events
        if trace_events:
            for evt in trace_events:
                db.add(TraceEvent(
                    run_id=uuid.UUID(run_id),
                    step_index=evt.get("step_index", 0),
                    node_name=evt.get("node_name", "unknown"),
                    event_type=evt.get("event_type", "node_end"),
                    payload=evt.get("payload", {}),
                ))


async def get_run(run_id: str) -> Optional[AnalysisRun]:
    """Fetch a single run with its trace events eagerly loaded."""
    async with db_session() as db:
        result = await db.execute(
            select(AnalysisRun)
            .where(AnalysisRun.id == uuid.UUID(run_id))
            .options(selectinload(AnalysisRun.trace_events))
        )
        return result.scalar_one_or_none()


async def get_session_history(
    session_id: str,
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[AnalysisRun]]:
    """Return (total_count, paginated_runs) for a session."""
    sid = uuid.UUID(session_id)
    async with db_session() as db:
        total_result = await db.execute(
            select(func.count()).where(AnalysisRun.session_id == sid)
        )
        total = total_result.scalar_one()

        runs_result = await db.execute(
            select(AnalysisRun)
            .where(AnalysisRun.session_id == sid)
            .options(selectinload(AnalysisRun.trace_events))
            .order_by(AnalysisRun.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        runs = list(runs_result.scalars().all())
        return total, runs
