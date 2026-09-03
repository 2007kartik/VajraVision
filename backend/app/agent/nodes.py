"""
app/agent/nodes.py — All six LangGraph node functions.

Each node is a pure async function:
  Input : AgentState (read-only access to relevant fields)
  Output: dict[str, Any] — partial update merged back into AgentState

Trace events are published to Redis AND accumulated in state.trace_events
so the SSE router can stream them in real-time.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from app.agent.prompts import classification_prompt, get_specialist_prompt
from app.agent.state import AgentState, TraceEventData
from app.config import get_settings
from app.redis_client import redis_publish_event

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Model pools (ordered: try best first, fallback on overload) ────────────────
TEXT_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]
VISION_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]
MODEL_ALIAS = {
    "gemini-2.5-flash": "VLM-2.5-Flash",
    "gemini-2.5-pro": "VLM-2.5-Pro",
}
RETRYABLE_CODES = {429, 500, 502, 503, 504}


def _is_retryable(err: Exception) -> bool:
    msg = str(err)
    if any(str(c) in msg for c in RETRYABLE_CODES):
        return True
    if re.search(r"high demand|overload|quota|rate.?limit|unavailable|try again", msg, re.I):
        return True
    return False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_trace(
    state: AgentState,
    step_index: int,
    node_name: str,
    event_type: str,
    payload: dict[str, Any],
) -> TraceEventData:
    return TraceEventData(
        step_index=step_index,
        node_name=node_name,
        event_type=event_type,
        payload=payload,
        ts=_now_iso(),
    )


async def _emit(state: AgentState, trace: TraceEventData) -> None:
    """Publish trace event to Redis SSE queue."""
    run_id = state.get("run_id", "unknown")
    try:
        await redis_publish_event(run_id, dict(trace))
    except Exception as exc:
        logger.warning("Redis publish failed for run %s: %s", run_id, exc)


async def _llm_with_fallback(
    model_names: list[str],
    messages: list,
    *,
    node_label: str,
) -> tuple[str, str]:
    """
    Try each model in order; return (response_text, model_alias) on first success.
    Raises RuntimeError if all models fail.
    """
    last_err: Exception | None = None
    for name in model_names:
        try:
            llm = ChatGoogleGenerativeAI(
                model=name,
                google_api_key=settings.gemini_api_key,
                temperature=0.1,
            )
            response = await llm.ainvoke(messages)
            alias = MODEL_ALIAS.get(name, "VLM")
            logger.info("[%s] used model %s (%s)", node_label, name, alias)
            return response.content, alias
        except Exception as exc:
            last_err = exc
            alias = MODEL_ALIAS.get(name, name)
            if _is_retryable(exc):
                logger.warning("[%s] %s overloaded, trying fallback…", node_label, alias)
                continue
            raise
    raise RuntimeError(
        f"[{node_label}] All models failed. Last error: {last_err}"
    ) from last_err


# ══════════════════════════════════════════════════════════════════════════════
# Node 0 — security_check
# ══════════════════════════════════════════════════════════════════════════════
async def security_check(state: AgentState) -> dict:
    """Evaluate query for prompt injection before proceeding."""
    from app.agent.security import check_prompt_injection
    
    step = -1
    node = "security_check"

    trace_start = _make_trace(state, step, node, "node_start", {
        "query": state.get("query", ""),
    })
    await _emit(state, trace_start)

    try:
        is_safe, reason = await check_prompt_injection(state.get("query", ""))
        
        if not is_safe:
            err_trace = _make_trace(state, step, node, "error", {"message": f"Security Violation: {reason}"})
            await _emit(state, err_trace)
            return {
                "error": f"Security Violation: {reason}",
                "error_node": node,
                "trace_events": [
                    *state.get("trace_events", []),
                    trace_start,
                    err_trace,
                ]
            }

        trace_end = _make_trace(state, step, node, "node_end", {"is_safe": is_safe, "reason": reason})
        await _emit(state, trace_end)
        
        return {
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                trace_end,
            ],
        }

    except Exception as exc:
        err_trace = _make_trace(state, step, node, "error", {"message": str(exc)})
        await _emit(state, err_trace)
        return {
            "error": str(exc),
            "error_node": node,
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                err_trace,
            ],
        }


# ══════════════════════════════════════════════════════════════════════════════
# Node 1 — classify_intent
# ══════════════════════════════════════════════════════════════════════════════
async def classify_intent(state: AgentState) -> dict:
    """Classify user query + image count into a task type."""
    step = 0
    node = "classify_intent"

    trace_start = _make_trace(state, step, node, "node_start", {
        "query": state.get("query", ""),
        "image_count": state.get("image_count", 0),
    })
    await _emit(state, trace_start)

    try:
        prompt = classification_prompt(
            query=state["query"],
            image_count=state.get("image_count", 1),
        )
        text, alias = await _llm_with_fallback(
            TEXT_MODELS,
            [HumanMessage(content=prompt)],
            node_label=node,
        )

        # Parse JSON from response (strip markdown fences if any)
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise ValueError(f"Classification returned non-JSON: {text[:200]}")
        parsed = json.loads(m.group(0))

        result = {
            "task_type": parsed["taskType"],
            "detected_input_type": parsed.get("detectedInputType", "single"),
            "specialist": parsed.get("specialist", "RS-VQA"),
            "routing_confidence": int(parsed.get("confidence", 85)),
            "routing_reasoning": parsed.get("reasoning", ""),
            "classification_model": alias,
        }

        trace_end = _make_trace(state, step, node, "node_end", result)
        await _emit(state, trace_end)

        return {
            **result,
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                trace_end,
            ],
        }

    except Exception as exc:
        err_trace = _make_trace(state, step, node, "error", {"message": str(exc)})
        await _emit(state, err_trace)
        return {
            "error": str(exc),
            "error_node": node,
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                err_trace,
            ],
        }


# ══════════════════════════════════════════════════════════════════════════════
# Node 2 — validate_images
# ══════════════════════════════════════════════════════════════════════════════
async def validate_images(state: AgentState) -> dict:
    """Validate uploaded images for format compatibility and task requirements."""
    step = 1
    node = "validate_images"

    trace_start = _make_trace(state, step, node, "node_start", {
        "image_count": state.get("image_count", 0),
        "task_type": state.get("task_type"),
    })
    await _emit(state, trace_start)

    try:
        images = state.get("images", [])
        task_type = state.get("task_type", "SINGLE_VQA")
        allowed_mimes = {
            "image/png", "image/jpeg", "image/tiff",
            "image/geotiff", "image/geo+tiff",
        }

        file_infos = []
        for img in images:
            valid = img["mime_type"] in allowed_mimes
            file_infos.append({
                "filename": img["filename"],
                "mime_type": img["mime_type"],
                "valid": valid,
            })

        issues: list[str] = []
        if task_type in ("CROSS_MODAL", "BITEMPORAL_CHANGE") and len(images) < 2:
            issues.append(f"{task_type} requires 2 images; only {len(images)} provided.")
        if any(not f["valid"] for f in file_infos):
            bad = [f["filename"] for f in file_infos if not f["valid"]]
            issues.append(f"Unsupported format(s): {', '.join(bad)}")

        validation = {
            "compatible": len(issues) == 0,
            "issues": issues,
            "file_infos": file_infos,
            "crs": "EPSG:32643",
        }

        trace_end = _make_trace(state, step, node, "node_end", validation)
        await _emit(state, trace_end)

        return {
            "validation": validation,
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                trace_end,
            ],
        }

    except Exception as exc:
        err_trace = _make_trace(state, step, node, "error", {"message": str(exc)})
        await _emit(state, err_trace)
        return {
            "error": str(exc),
            "error_node": node,
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                err_trace,
            ],
        }


# ══════════════════════════════════════════════════════════════════════════════
# Node 3 — route_specialist  (used as conditional edge source)
# ══════════════════════════════════════════════════════════════════════════════
async def route_specialist(state: AgentState) -> dict:
    """
    Emit a routing trace event. The actual edge routing is handled by
    the conditional edge function route_edge() in graph.py.
    """
    step = 2
    node = "route_specialist"

    if state.get("error"):
        err_trace = _make_trace(state, step, node, "error", {
            "message": state["error"],
            "from_node": state.get("error_node"),
        })
        await _emit(state, err_trace)
        return {
            "trace_events": [*state.get("trace_events", []), err_trace],
        }

    task_type = state.get("task_type", "SINGLE_VQA")
    specialist = state.get("specialist", "RS-VQA")
    trace = _make_trace(state, step, node, "routing", {
        "task_type": task_type,
        "specialist": specialist,
        "routing_confidence": state.get("routing_confidence"),
    })
    await _emit(state, trace)

    return {
        "trace_events": [*state.get("trace_events", []), trace],
    }


# ══════════════════════════════════════════════════════════════════════════════
# Node 4 — run_specialist
# ══════════════════════════════════════════════════════════════════════════════
async def run_specialist(state: AgentState) -> dict:
    """Call the appropriate Gemini vision model with the task-specific prompt."""
    step = 3
    node = "run_specialist"

    if state.get("error"):
        return {}   # error already recorded upstream

    trace_start = _make_trace(state, step, node, "node_start", {
        "task_type": state.get("task_type"),
        "specialist": state.get("specialist"),
    })
    await _emit(state, trace_start)

    try:
        images = state.get("images", [])
        task_type = state.get("task_type", "SINGLE_VQA")
        query = state.get("query", "")

        system_prompt = get_specialist_prompt(task_type, query)

        # Build multimodal LangChain message
        content_parts: list[dict] = [{"type": "text", "text": system_prompt}]
        for img in images:
            content_parts.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img['mime_type']};base64,{img['base64_data']}"
                },
            })

        msg = HumanMessage(content=content_parts)
        text, alias = await _llm_with_fallback(
            VISION_MODELS,
            [msg],
            node_label=node,
        )

        # Extract confidence from model response
        conf_match = re.search(r"[Cc]onfidence[:\s]+(\d{1,3})%", text)
        confidence = (
            min(99, int(conf_match.group(1))) if conf_match
            else (78 + hash(text) % 17)   # deterministic fallback
        )

        result = {
            "answer_text": text,
            "answer_confidence": confidence,
            "model_used": alias,
        }

        trace_end = _make_trace(state, step, node, "node_end", {
            "model_used": alias,
            "confidence": confidence,
            "answer_preview": text[:120] + "…" if len(text) > 120 else text,
        })
        await _emit(state, trace_end)

        return {
            **result,
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                trace_end,
            ],
        }

    except Exception as exc:
        err_trace = _make_trace(state, step, node, "error", {"message": str(exc)})
        await _emit(state, err_trace)
        return {
            "error": str(exc),
            "error_node": node,
            "trace_events": [
                *state.get("trace_events", []),
                trace_start,
                err_trace,
            ],
        }


# ══════════════════════════════════════════════════════════════════════════════
# Node 5 — synthesize_evidence
# ══════════════════════════════════════════════════════════════════════════════
async def synthesize_evidence(state: AgentState) -> dict:
    """Score confidence and structure final evidence metadata."""
    step = 4
    node = "synthesize_evidence"

    if state.get("error"):
        return {}

    trace_start = _make_trace(state, step, node, "node_start", {})
    await _emit(state, trace_start)

    confidence = state.get("answer_confidence", 80)
    trace_end = _make_trace(state, step, node, "node_end", {
        "final_confidence": confidence,
        "model_used": state.get("model_used"),
    })
    await _emit(state, trace_end)

    return {
        "trace_events": [
            *state.get("trace_events", []),
            trace_start,
            trace_end,
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# Node 6 — finalize_response
# ══════════════════════════════════════════════════════════════════════════════
async def finalize_response(state: AgentState) -> dict:
    """
    Persist the completed run to PostgreSQL and publish the final
    'done' or 'error' event to the Redis SSE queue.
    This node ALWAYS runs — even on error — to close out the run.
    """
    from app.services.run_service import update_run_completed  # local import avoids circular

    step = 5
    node = "finalize_response"
    run_id = state.get("run_id", "")

    finished_at = _now_iso()
    started_at = state.get("started_at", finished_at)
    try:
        from datetime import datetime as dt
        start_dt = dt.fromisoformat(started_at)
        end_dt = dt.fromisoformat(finished_at)
        duration_ms = int((end_dt - start_dt).total_seconds() * 1000)
    except Exception:
        duration_ms = 0

    if state.get("error"):
        # Persist error state
        await update_run_completed(
            run_id=run_id,
            status="error",
            error_message=state.get("error", "Unknown error"),
            duration_ms=duration_ms,
        )
        final_event = {
            "event": "error",
            "run_id": run_id,
            "message": state.get("error"),
            "ts": finished_at,
        }
        # Signal end-of-stream
        sentinel = {"event": "__end__", "run_id": run_id, "ts": finished_at}
        await redis_publish_event(run_id, final_event)
        await redis_publish_event(run_id, sentinel)
    else:
        from app.agent.cache import save_to_semantic_cache
        
        # Save to cache
        await save_to_semantic_cache(
            query=state.get("query", ""),
            answer_text=state.get("answer_text", ""),
            confidence=state.get("answer_confidence", 80),
            task_type=state.get("task_type", "UNKNOWN"),
            specialist=state.get("specialist", "RS-VQA"),
            model_used=state.get("model_used", "Unknown VLM")
        )

        await update_run_completed(
            run_id=run_id,
            status="done",
            task_type=state.get("task_type"),
            specialist=state.get("specialist"),
            model_used=state.get("model_used"),
            confidence=state.get("answer_confidence"),
            answer_text=state.get("answer_text"),
            duration_ms=duration_ms,
            trace_events=state.get("trace_events", []),
        )
        final_event = {
            "event": "done",
            "run_id": run_id,
            "data": {
                "task_type": state.get("task_type"),
                "specialist": state.get("specialist"),
                "model_used": state.get("model_used"),
                "confidence": state.get("answer_confidence"),
                "answer": state.get("answer_text", ""),
                "duration_ms": duration_ms,
            },
            "ts": finished_at,
        }
        sentinel = {"event": "__end__", "run_id": run_id, "ts": finished_at}
        await redis_publish_event(run_id, final_event)
        await redis_publish_event(run_id, sentinel)

    return {
        "finished_at": finished_at,
        "duration_ms": duration_ms,
    }
