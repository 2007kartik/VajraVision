"""tests/test_health.py — Health endpoint tests."""
import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_schema(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert "status" in data
    assert "postgres" in data
    assert "redis" in data


@pytest.mark.asyncio
async def test_health_status_field(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    # status must be 'ok' or 'degraded' — never an unexpected value
    assert data["status"] in ("ok", "degraded")
