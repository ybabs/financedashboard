import pytest

from core.config import settings


@pytest.mark.anyio
async def test_security_headers_are_set(client):
    res = await client.get("/")
    assert res.status_code == 200
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "content-security-policy" in res.headers


@pytest.mark.anyio
async def test_rate_limit_guardrail(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_requests", 1)
    monkeypatch.setattr(settings, "rate_limit_window_seconds", 60)
    first = await client.get("/ratelimit-probe")
    second = await client.get("/ratelimit-probe")
    assert first.status_code == 404
    assert second.status_code == 429
    assert second.json()["detail"] == "Rate limit exceeded"


@pytest.mark.anyio
async def test_body_size_limit_guardrail(client, monkeypatch):
    monkeypatch.setattr(settings, "max_request_body_bytes", 10)
    res = await client.post("/api/workspace/lists", content="x" * 64)
    assert res.status_code == 413
    assert res.json()["detail"] == "Request body too large"
