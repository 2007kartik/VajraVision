"""
tests/test_agent.py — LangGraph graph compilation and node unit tests.
Uses mock Gemini responses so no real API key is needed.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.agent.graph import build_graph
from app.agent.state import AgentState
from app.agent.nodes import classify_intent, validate_images


# ── Graph compilation ─────────────────────────────────────────────────────────

def test_graph_compiles():
    """The LangGraph DAG must compile without errors."""
    graph = build_graph()
    assert graph is not None


def test_graph_has_nodes():
    """Compiled graph must expose all expected node names."""
    graph = build_graph()
    # LangGraph compiled graph exposes graph.nodes dict
    node_names = set(graph.graph.nodes.keys())
    expected = {
        "classify_intent", "validate_images", "route_specialist",
        "run_specialist", "synthesize_evidence", "finalize_response",
    }
    assert expected.issubset(node_names)


# ── Node unit tests ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.agent.nodes.redis_publish_event", new_callable=AsyncMock)
@patch("app.agent.nodes._llm_with_fallback", new_callable=AsyncMock)
async def test_classify_intent_success(mock_llm, mock_redis):
    """classify_intent should parse a valid JSON response correctly."""
    mock_llm.return_value = (
        '{"taskType": "SINGLE_VQA", "detectedInputType": "single", '
        '"specialist": "RS-VQA", "reasoning": "test", "confidence": 92}',
        "VLM-1",
    )
    mock_redis.return_value = None

    state = AgentState(
        run_id="test-run-id",
        session_id="test-session-id",
        query="What land cover is visible?",
        image_count=1,
        trace_events=[],
    )
    result = await classify_intent(state)

    assert result["task_type"] == "SINGLE_VQA"
    assert result["specialist"] == "RS-VQA"
    assert result["routing_confidence"] == 92
    assert len(result["trace_events"]) == 2  # node_start + node_end


@pytest.mark.asyncio
@patch("app.agent.nodes.redis_publish_event", new_callable=AsyncMock)
async def test_validate_images_compatible(mock_redis):
    """validate_images should pass 1 PNG for SINGLE_VQA."""
    mock_redis.return_value = None

    state = AgentState(
        run_id="test-run-id",
        session_id="test-session-id",
        query="Describe this image",
        image_count=1,
        task_type="SINGLE_VQA",
        images=[{
            "filename": "test.png",
            "mime_type": "image/png",
            "base64_data": "abc123",
        }],
        trace_events=[],
    )
    result = await validate_images(state)

    assert result["validation"]["compatible"] is True
    assert result["validation"]["issues"] == []


@pytest.mark.asyncio
@patch("app.agent.nodes.redis_publish_event", new_callable=AsyncMock)
async def test_validate_images_requires_two_for_cross_modal(mock_redis):
    """validate_images should flag CROSS_MODAL with only 1 image."""
    mock_redis.return_value = None

    state = AgentState(
        run_id="test-run-id",
        session_id="test-session-id",
        query="Compare optical vs SAR",
        image_count=1,
        task_type="CROSS_MODAL",
        images=[{
            "filename": "optical.png",
            "mime_type": "image/png",
            "base64_data": "abc123",
        }],
        trace_events=[],
    )
    result = await validate_images(state)

    assert result["validation"]["compatible"] is False
    assert any("2 images" in issue for issue in result["validation"]["issues"])


@pytest.mark.asyncio
@patch("app.agent.nodes.redis_publish_event", new_callable=AsyncMock)
async def test_classify_intent_handles_bad_llm_response(mock_redis):
    """classify_intent should capture error in state on non-JSON LLM response."""
    mock_redis.return_value = None

    with patch("app.agent.nodes._llm_with_fallback", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = ("This is not JSON at all!", "VLM-1")

        state = AgentState(
            run_id="err-run",
            session_id="err-session",
            query="test",
            image_count=1,
            trace_events=[],
        )
        result = await classify_intent(state)

    assert "error" in result
    assert result.get("error_node") == "classify_intent"
