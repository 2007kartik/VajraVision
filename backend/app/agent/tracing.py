"""
app/agent/tracing.py — LangSmith audit and evidence helpers.

This module provides:
1. A `RunTracer` context manager that tags each LangGraph run with
   run_id + session_id so traces are searchable in LangSmith.
2. Helper functions to fetch run metadata from LangSmith for the
   audit log / evidence trail.
3. A `build_evidence_trail` function that merges Redis trace events
   (real-time) with LangSmith spans (post-run rich detail) into a
   single structured audit record.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── LangSmith client (optional — degrades gracefully if no API key) ────────────

def _get_langsmith_client():
    """Return a LangSmith Client or None if tracing is disabled."""
    try:
        from langsmith import Client
        from app.config import get_settings
        s = get_settings()
        if s.langchain_api_key:
            return Client(
                api_url=s.langchain_endpoint,
                api_key=s.langchain_api_key,
            )
    except Exception as exc:
        logger.debug("LangSmith client unavailable: %s", exc)
    return None


# ── Run-level metadata tagging ─────────────────────────────────────────────────

def get_run_metadata(run_id: str, session_id: str, query: str) -> dict[str, Any]:
    """
    Build the metadata dict passed to langchain_core tracing hooks.
    All LangGraph runs tagged with this show up in LangSmith filtered
    by run_id and session_id.
    """
    return {
        "run_id": run_id,
        "session_id": session_id,
        "query_preview": query[:80] if query else "",
        "project": "satquery-ai",
        "source": "langgraph-agent",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── LangSmith run fetch ────────────────────────────────────────────────────────

async def fetch_langsmith_run(run_id: str) -> Optional[dict[str, Any]]:
    """
    Attempt to fetch the LangSmith run record for a given run_id.
    Returns a dict of span data or None if unavailable.
    """
    client = _get_langsmith_client()
    if client is None:
        return None

    try:
        import asyncio
        # LangSmith client is sync — run in thread pool
        loop = asyncio.get_event_loop()
        runs = await loop.run_in_executor(
            None,
            lambda: list(client.list_runs(
                project_name="satquery-ai",
                filter=f'has(metadata, \'{"run_id": "{run_id}"}\')',
                limit=10,
            ))
        )
        if not runs:
            return None

        # Return the root run (first/longest span)
        root = runs[0]
        return {
            "langsmith_id": str(root.id),
            "name": root.name,
            "status": root.status,
            "start_time": root.start_time.isoformat() if root.start_time else None,
            "end_time": root.end_time.isoformat() if root.end_time else None,
            "total_tokens": getattr(root, "total_tokens", None),
            "prompt_tokens": getattr(root, "prompt_tokens", None),
            "completion_tokens": getattr(root, "completion_tokens", None),
            "total_cost": getattr(root, "total_cost", None),
            "child_run_count": len(runs) - 1,
            "url": f"https://smith.langchain.com/o/public/projects/satquery-ai/runs/{root.id}",
        }
    except Exception as exc:
        logger.warning("Failed to fetch LangSmith run %s: %s", run_id, exc)
        return None


# ── Evidence trail builder ─────────────────────────────────────────────────────

async def build_evidence_trail(
    run_id: str,
    redis_trace_events: list[dict],
    db_run: Optional[Any] = None,
) -> dict[str, Any]:
    """
    Merge Redis SSE events (real-time node trace) + LangSmith spans (rich detail)
    + PostgreSQL run record into a single structured evidence audit object.

    This is the primary output for ISRO/SAC auditing and SIH demonstration.
    """
    langsmith_data = await fetch_langsmith_run(run_id)

    # Summarise node-level trace
    node_summary = []
    for evt in redis_trace_events:
        if evt.get("event_type") == "node_end":
            node_summary.append({
                "step": evt.get("step_index"),
                "node": evt.get("node_name"),
                "payload": evt.get("payload", {}),
                "ts": evt.get("ts"),
            })

    evidence = {
        "run_id": run_id,
        "agent_dag": "SatQuery-AI LangGraph DAG v1",
        "nodes_executed": node_summary,
        "langsmith": langsmith_data,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    if db_run:
        evidence["db_record"] = {
            "task_type": getattr(db_run, "task_type", None),
            "specialist": getattr(db_run, "specialist", None),
            "model_used": getattr(db_run, "model_used", None),
            "confidence": getattr(db_run, "confidence", None),
            "duration_ms": getattr(db_run, "duration_ms", None),
            "status": getattr(db_run, "status", None),
            "created_at": getattr(db_run, "created_at", datetime.now(timezone.utc)).isoformat(),
        }

    return evidence
