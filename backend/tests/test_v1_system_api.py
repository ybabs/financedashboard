from datetime import datetime, timezone

import pytest

import api.routers.v1_system as v1_system_router


@pytest.mark.anyio
async def test_v1_ingest_health_ok(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def ingest_health(self):
            now = datetime.now(timezone.utc)
            return {
                "status": "healthy",
                "generated_at": now,
                "max_lag_seconds": 120.0,
                "jobs": [
                    {
                        "job_name": "accounts_daily",
                        "last_success_at": now,
                        "last_error": None,
                        "updated_at": now,
                        "lag_seconds": 120.0,
                    }
                ],
                "artifacts": {
                    "success_count": 42,
                    "non_success_count": 1,
                    "last_finished_at": now,
                },
            }

    monkeypatch.setattr(v1_system_router, "SystemRepository", FakeRepo)
    res = await client.get("/v1/system/ingest-health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["artifacts"]["success_count"] == 42
    assert body["jobs"][0]["job_name"] == "accounts_daily"

