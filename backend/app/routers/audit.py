"""
app/routers/audit.py — GET /api/v1/audit/{run_id}

Returns a structured evidence trail merging:
  - PostgreSQL run record + trace events
  - Redis real-time SSE events (if still cached)
  - LangSmith span data (if tracing is enabled)

This is the primary endpoint for ISRO/SAC audit compliance and
SIH2026 demonstration of real agent traceability.
"""
from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.agent.tracing import build_evidence_trail
from app.redis_client import redis_get_events
from app.services.run_service import get_run

router = APIRouter(prefix="/api/v1", tags=["audit"])
logger = logging.getLogger(__name__)


@router.get(
    "/audit/{run_id}",
    summary="Full evidence trail for a run",
    response_class=JSONResponse,
)
async def get_audit_trail(run_id: str):
    """
    Return the full structured evidence/audit trail for an analysis run.

    Merges three data sources:
    1. **PostgreSQL** — run metadata + persisted trace events (permanent)
    2. **Redis** — real-time SSE events (available for 1 hour post-run)
    3. **LangSmith** — rich span data with token counts and cost (if configured)

    Use this endpoint to verify exactly what the agent did, step-by-step.
    """
    try:
        uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(400, "Invalid run_id.")

    # Fetch DB run
    db_run = await get_run(run_id)
    if db_run is None:
        raise HTTPException(404, f"Run {run_id} not found.")

    # Fetch Redis events (may be empty if TTL expired)
    redis_events = await redis_get_events(run_id)

    # Build merged evidence trail
    trail = await build_evidence_trail(
        run_id=run_id,
        redis_trace_events=[
            {
                "event_type": e.get("event"),
                "node_name": e.get("node", ""),
                "step_index": e.get("step", 0),
                "payload": e.get("data", {}),
                "ts": e.get("ts", ""),
            }
            for e in redis_events
        ],
        db_run=db_run,
    )

    # Also include DB trace events for permanent record
    trail["db_trace_events"] = [
        {
            "step": evt.step_index,
            "node": evt.node_name,
            "type": evt.event_type,
            "payload": evt.payload,
            "ts": evt.created_at.isoformat(),
        }
        for evt in (db_run.trace_events or [])
    ]

    return trail
