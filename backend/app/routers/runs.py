"""
app/routers/runs.py — GET /api/v1/runs/{run_id} and GET /api/v1/history
"""
from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, HTTPException, Query

from app.schemas.run import RunResponse, HistoryResponse
from app.services.run_service import get_run, get_session_history

router = APIRouter(prefix="/api/v1", tags=["runs"])
logger = logging.getLogger(__name__)


@router.get("/runs/{run_id}", response_model=RunResponse, summary="Get run details")
async def get_run_details(run_id: str):
    """Fetch full run details including all agent trace events from PostgreSQL."""
    try:
        uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(400, "Invalid run_id.")

    run = await get_run(run_id)
    if run is None:
        raise HTTPException(404, f"Run {run_id} not found.")

    return RunResponse.model_validate(run)


@router.get("/history", response_model=HistoryResponse, summary="Get session history")
async def get_history(
    session_id: str = Query(..., description="Session UUID"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Return paginated analysis history for a session."""
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "Invalid session_id.")

    total, runs = await get_session_history(session_id, limit=limit, offset=offset)
    return HistoryResponse(
        session_id=uuid.UUID(session_id),
        total=total,
        runs=[RunResponse.model_validate(r) for r in runs],
    )
