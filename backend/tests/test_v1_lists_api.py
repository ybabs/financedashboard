from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

import api.routers.v1_lists as v1_lists_router


@pytest.mark.anyio
async def test_v1_lists_requires_tenant_header(client):
    res = await client.get("/v1/lists")
    assert res.status_code == 400
    assert "Missing required header" in res.json()["detail"]


@pytest.mark.anyio
async def test_v1_get_lists_ok(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def list_lists(self):
            now = datetime.now(timezone.utc)
            return [SimpleNamespace(id=9, name="Targets", created_at=now, updated_at=now)]

    monkeypatch.setattr(v1_lists_router, "WorkspaceRepository", FakeRepo)
    res = await client.get("/v1/lists", headers={"X-Tenant-Id": "acme"})
    assert res.status_code == 200
    assert res.json()["items"][0]["id"] == 9


@pytest.mark.anyio
async def test_v1_create_list_conflict(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def create_list(self, name: str):
            raise IntegrityError("", {}, Exception("duplicate key value"))

    monkeypatch.setattr(v1_lists_router, "WorkspaceRepository", FakeRepo)
    res = await client.post("/v1/lists", headers={"X-Tenant-Id": "acme"}, json={"name": "Targets"})
    assert res.status_code == 409
    assert res.json()["detail"] == "List already exists for tenant"


@pytest.mark.anyio
async def test_v1_add_item_fk_conflict(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def add_company(self, list_id: int, company_number: str):
            raise IntegrityError("", {}, Exception("insert violates foreign key constraint"))

    monkeypatch.setattr(v1_lists_router, "WorkspaceRepository", FakeRepo)
    res = await client.post(
        "/v1/lists/1/items",
        headers={"X-Tenant-Id": "acme"},
        json={"company_number": "09092149"},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "List or company not found"


@pytest.mark.anyio
async def test_v1_delete_item_not_found(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def remove_company(self, list_id: int, company_number: str):
            return False

    monkeypatch.setattr(v1_lists_router, "WorkspaceRepository", FakeRepo)
    res = await client.delete("/v1/lists/1/items/09092149", headers={"X-Tenant-Id": "acme"})
    assert res.status_code == 404
    assert res.json()["detail"] == "List item not found"

