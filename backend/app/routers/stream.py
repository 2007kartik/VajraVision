"""
app/routers/stream.py — GET /api/v1/stream/{run_id}

Server-Sent Events endpoint. The client connects here after POSTing to /analyze
and receives real-time trace events as the LangGraph pipeline executes.

Protocol:
  - Each SSE message is: data: <JSON>\n\n
  - The stream terminates when the backend pushes { "event": "__end__" }
  - Heartbeat (comment) sent every 15 s to keep the connection alive
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.redis_client import get_redis

router = APIRouter(prefix="/api/v1", tags=["stream"])
logger = logging.getLogger(__name__)

POLL_INTERVAL = 0.25      # seconds between Redis LRANGE polls
HEARTBEAT_INTERVAL = 15   # seconds between keepalive comments
STREAM_TIMEOUT = 300      # 5-minute hard timeout per stream


@router.get(
    "/stream/{run_id}",
    summary="SSE stream for agent trace events",
    response_class=StreamingResponse,
)
async def stream_events(run_id: str):
    """
    Subscribe to real-time agent trace events for a given run.
    Returns text/event-stream; terminates on 'done' or 'error' event.
    """
    return StreamingResponse(
        _event_generator(run_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",    # disable nginx buffering
            "Connection": "keep-alive",
        },
    )


async def _event_generator(run_id: str):
    """
    Async generator that polls the Redis list run:{run_id}:events
    and yields SSE-formatted lines.
    """
    redis = await get_redis()
    key = f"run:{run_id}:events"
    cursor = 0
    elapsed = 0.0
    last_heartbeat = 0.0

    while elapsed < STREAM_TIMEOUT:
        # Send heartbeat comment to keep connection alive
        if elapsed - last_heartbeat >= HEARTBEAT_INTERVAL:
            yield ": heartbeat\n\n"
            last_heartbeat = elapsed

        # Fetch any new events since last cursor
        raw_events = await redis.lrange(key, cursor, -1)

        for raw in raw_events:
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue

            yield f"data: {json.dumps(event)}\n\n"
            cursor += 1

            # Terminate stream on sentinel events
            if event.get("event") in ("__end__", "done", "error"):
                logger.info("SSE stream for run %s closed (event=%s)", run_id, event.get("event"))
                return

        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

    # Hard timeout reached
    yield f"data: {json.dumps({'event': 'timeout', 'run_id': run_id})}\n\n"
    logger.warning("SSE stream for run %s timed out after %ds", run_id, STREAM_TIMEOUT)
