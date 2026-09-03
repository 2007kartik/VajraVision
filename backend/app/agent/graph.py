"""
app/agent/graph.py — LangGraph StateGraph definition and compiled singleton.

DAG structure:
  START
    ↓
  classify_intent
    ↓
  validate_images
    ↓
  route_specialist  ──[conditional edge]──→  run_specialist
    ↓ (on error)                               ↓
  finalize_response ←──────────────── synthesize_evidence
    ↓
  END

LangSmith tracing is enabled automatically when LANGCHAIN_TRACING_V2=true
and LANGCHAIN_API_KEY is set — every run appears as a traced call in
https://smith.langchain.com with full input/output at each node.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.agent.nodes import (
    security_check,
    classify_intent,
    finalize_response,
    route_specialist,
    run_specialist,
    synthesize_evidence,
    validate_images,
)
from app.agent.state import AgentState
from app.redis_client import get_redis
from langgraph.checkpoint.redis import AsyncRedisSaver

logger = logging.getLogger(__name__)


def _configure_langsmith() -> None:
    """
    Set LangSmith environment variables from app settings so that LangChain's
    automatic instrumentation picks them up before the graph is compiled.
    """
    from app.config import get_settings
    s = get_settings()

    if s.langchain_tracing_v2 and s.langchain_api_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_ENDPOINT"] = s.langchain_endpoint
        os.environ["LANGCHAIN_API_KEY"] = s.langchain_api_key
        os.environ["LANGCHAIN_PROJECT"] = s.langchain_project
        logger.info(
            "LangSmith tracing enabled → project='%s' endpoint='%s'",
            s.langchain_project, s.langchain_endpoint,
        )
    else:
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        logger.info("LangSmith tracing disabled (set LANGCHAIN_API_KEY to enable).")


def _route_edge(state: AgentState) -> str:
    """
    Conditional edge function called after route_specialist.
    - If an error occurred upstream → jump straight to finalize_response
    - Otherwise → proceed to run_specialist
    """
    if state.get("error"):
        return "finalize_response"
    return "run_specialist"

def _route_security(state: AgentState) -> str:
    if state.get("error"):
        return "finalize_response"
    return "classify_intent"


def build_graph(checkpointer=None) -> StateGraph:
    """Construct and return the compiled LangGraph agent."""
    _configure_langsmith()

    graph = StateGraph(AgentState)

    # ── Register nodes ─────────────────────────────────────────────────────────
    graph.add_node("security_check", security_check)
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("validate_images", validate_images)
    graph.add_node("route_specialist", route_specialist)
    graph.add_node("run_specialist", run_specialist)
    graph.add_node("synthesize_evidence", synthesize_evidence)
    graph.add_node("finalize_response", finalize_response)

    # ── Linear edges ───────────────────────────────────────────────────────────
    graph.add_edge(START, "security_check")
    graph.add_conditional_edges(
        "security_check",
        _route_security,
        {
            "classify_intent": "classify_intent",
            "finalize_response": "finalize_response"
        }
    )
    graph.add_edge("classify_intent", "validate_images")
    graph.add_edge("validate_images", "route_specialist")

    # ── Conditional edge: route_specialist → run_specialist OR finalize_response
    graph.add_conditional_edges(
        "route_specialist",
        _route_edge,
        {
            "run_specialist": "run_specialist",
            "finalize_response": "finalize_response",
        },
    )

    graph.add_edge("run_specialist", "synthesize_evidence")
    graph.add_edge("synthesize_evidence", "finalize_response")
    graph.add_edge("finalize_response", END)

    return graph.compile(checkpointer=checkpointer)


@lru_cache(maxsize=1)
async def get_compiled_graph():
    """
    Return the compiled LangGraph agent configured with a Redis checkpointer.
    LangSmith env vars are configured once here at startup.
    """
    logger.info("Compiling LangGraph SatQuery agent DAG…")
    
    # We must rebuild the graph instance if we want to attach a dynamic checkpointer,
    # or just attach it once using a global pool.
    pool = await get_redis()
    checkpointer = AsyncRedisSaver(pool)
    
    _configure_langsmith()
    compiled = build_graph(checkpointer=checkpointer)
    logger.info("LangGraph agent compiled with Redis memory checkpointer.")
    return compiled
