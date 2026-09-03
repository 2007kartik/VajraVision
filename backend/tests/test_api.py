"""
tests/test_api.py — Integration tests for the FastAPI HTTP endpoints.
"""
import io
import uuid
import pytest


@pytest.mark.asyncio
async def test_create_session(client):
    """POST /sessions must return 201 with a valid UUID session id."""
    response = await client.post("/api/v1/sessions")
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert "created_at" in data
    # Verify the id is a valid UUID
    uuid.UUID(data["id"])


@pytest.mark.asyncio
async def test_create_session_twice_returns_different_ids(client):
    """Each session creation must return a unique UUID."""
    r1 = await client.post("/api/v1/sessions")
    r2 = await client.post("/api/v1/sessions")
    assert r1.json()["id"] != r2.json()["id"]


@pytest.mark.asyncio
async def test_get_run_not_found(client):
    """GET /runs/{run_id} with an unknown UUID must return 404."""
    fake_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/runs/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_run_invalid_uuid(client):
    """GET /runs/{run_id} with a non-UUID string must return 400."""
    response = await client.get("/api/v1/runs/not-a-uuid")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_history_invalid_session(client):
    """GET /history with invalid session_id must return 400."""
    response = await client.get("/api/v1/history?session_id=bad-id")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_analyze_missing_fields(client):
    """POST /analyze without required fields must return 422."""
    response = await client.post("/api/v1/analyze", data={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_analyze_invalid_session_uuid(client):
    """POST /analyze with non-UUID session_id must return 400."""
    img = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    response = await client.post(
        "/api/v1/analyze",
        data={"session_id": "not-a-uuid", "query": "Describe this"},
        files={"images": ("test.png", img, "image/png")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_docs_endpoint(client):
    """OpenAPI /docs must be accessible."""
    response = await client.get("/docs")
    assert response.status_code == 200
