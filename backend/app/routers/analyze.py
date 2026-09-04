"""
app/routers/analyze.py — POST /api/v1/analyze

Accepts multipart/form-data with:
  - session_id (str)
  - query      (str)
  - images     (1 or 2 image files)

Spawns the LangGraph pipeline as a background task and returns run_id + SSE URL.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from app.agent.graph import get_compiled_graph
from app.agent.state import AgentState, ImageData
from app.redis_client import redis_rate_limit
from app.schemas.analyze import AnalyzeResponse
from app.services.run_service import create_run

router = APIRouter(prefix="/api/v1", tags=["analyze"])
logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/png", "image/jpeg", "image/jpg",
    "image/tiff", "image/geotiff", "image/geo+tiff",
}
MAX_IMAGE_SIZE_MB = 20


from typing import Optional

@router.post("/analyze", response_model=AnalyzeResponse, status_code=202)
async def analyze(
    background_tasks: BackgroundTasks,
    session_id: str = Form(...),
    query: str = Form(..., min_length=1, max_length=2000),
    images: Optional[list[UploadFile]] = File(None),
):
    """
    Submit a satellite image analysis request.
    Returns a run_id and SSE stream URL immediately;
    the actual pipeline runs in the background.
    """
    # ── Validate session UUID ──────────────────────────────────────────────────
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "Invalid session_id — must be a UUID.")

    # ── Rate limit ─────────────────────────────────────────────────────────────
    allowed = await redis_rate_limit(session_id)
    if not allowed:
        raise HTTPException(429, "Rate limit exceeded. Try again in a minute.")

    if images is None:
        images = []

    # ── Validate images ────────────────────────────────────────────────────────
    if len(images) > 2:
        raise HTTPException(400, "Send at most 2 images.")
    for img in images:
        if img.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                400, f"Unsupported image type: {img.content_type}. "
                     "Use PNG, JPEG, or TIFF."
            )

    # ── Read images into memory & base64 encode ────────────────────────────────
    image_data: list[ImageData] = []
    for img in images:
        raw = await img.read()
        size_mb = len(raw) / (1024 * 1024)
        if size_mb > MAX_IMAGE_SIZE_MB:
            raise HTTPException(413, f"{img.filename} exceeds {MAX_IMAGE_SIZE_MB} MB limit.")
        image_data.append(ImageData(
            filename=img.filename or "image",
            mime_type=img.content_type or "image/png",
            base64_data=base64.b64encode(raw).decode("utf-8"),
        ))

    # ── Create run record ──────────────────────────────────────────────────────
    run_id = str(uuid.uuid4())
    await create_run(
        run_id=run_id,
        session_id=session_id,
        query=query,
        image_count=len(image_data),
    )

    # ── Build initial agent state ──────────────────────────────────────────────
    initial_state = AgentState(
        run_id=run_id,
        session_id=session_id,
        query=query,
        images=image_data,
        image_count=len(image_data),
        trace_events=[],
        started_at=datetime.now(timezone.utc).isoformat(),
    )

    # ── Launch graph in background ─────────────────────────────────────────────
    background_tasks.add_task(_run_graph, initial_state)

    logger.info("Accepted run %s (session=%s, images=%d)", run_id, session_id, len(image_data))

    return AnalyzeResponse(
        run_id=uuid.UUID(run_id),
        status="pending",
        stream_url=f"/api/v1/stream/{run_id}",
    )


async def _run_graph(state: AgentState) -> None:
    """Execute the compiled LangGraph agent and handle top-level exceptions."""
    from app.agent.cache import check_semantic_cache
    from app.redis_client import redis_publish_event
    from datetime import datetime, timezone
    from app.services.run_service import update_run_completed
    
    run_id = state.get("run_id", "unknown")
    query = state.get("query", "")
    
    try:
        # Check Semantic Cache first
        cached_result = await check_semantic_cache(query)
        if cached_result:
            logger.info("Serving query from cache for run %s", run_id)
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Persist to DB
            await update_run_completed(
                run_id=run_id,
                status="done",
                task_type=cached_result["task_type"],
                specialist=cached_result["specialist"],
                model_used=cached_result["model_used"],
                confidence=cached_result["confidence"],
                answer_text=cached_result["answer_text"],
                duration_ms=50,  # Fast!
                trace_events=[],
            )
            
            final_event = {
                "event": "done",
                "run_id": run_id,
                "data": {
                    "task_type": cached_result["task_type"],
                    "specialist": cached_result["specialist"],
                    "model_used": cached_result["model_used"],
                    "confidence": cached_result["confidence"],
                    "answer": cached_result["answer_text"],
                    "duration_ms": 50,
                },
                "ts": now_iso,
            }
            await redis_publish_event(run_id, final_event)
            await redis_publish_event(run_id, {"event": "__end__", "run_id": run_id, "ts": now_iso})
            return

        # If miss, run the actual graph
        graph = await get_compiled_graph()
        config = {"configurable": {"thread_id": state.get("session_id", "default_session")}}
        await graph.ainvoke(state, config=config)
    except Exception as exc:
        logger.exception("Unhandled error in agent run %s: %s", state.get("run_id"), exc)
        # Best-effort: publish error to SSE queue
        from app.redis_client import redis_publish_event
        from datetime import datetime, timezone
        run_id = state.get("run_id", "unknown")
        await redis_publish_event(run_id, {
            "event": "error",
            "run_id": run_id,
            "message": str(exc),
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        await redis_publish_event(run_id, {
            "event": "__end__",
            "run_id": run_id,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
