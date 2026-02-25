from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

import api.routers.workspace as workspace_router


@pytest.mark.anyio
async def test_workspace_requires_tenant_header(client):
    res = await client.get("/api/workspace/lists")
    assert res.status_code == 400
    assert "Missing required header" in res.json()["detail"]


@pytest.mark.anyio
async def test_get_lists_ok(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def list_lists(self):
            now = datetime.now(timezone.utc)
            return [
                SimpleNamespace(
                    id=1,
                    name="My Targets",
                    created_at=now,
                    updated_at=now,
                )
            ]

    monkeypatch.setattr(workspace_router, "WorkspaceRepository", FakeRepo)
    res = await client.get("/api/workspace/lists", headers={"X-Tenant-Id": "acme"})
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == 1


@pytest.mark.anyio
async def test_create_list_blank_name_400(client):
    res = await client.post(
        "/api/workspace/lists",
        headers={"X-Tenant-Id": "acme"},
        json={"name": " "},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "List name cannot be blank"


@pytest.mark.anyio
async def test_create_list_conflict_409(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def create_list(self, name: str):
            raise IntegrityError("", {}, Exception("duplicate key value"))

    monkeypatch.setattr(workspace_router, "WorkspaceRepository", FakeRepo)
    res = await client.post(
        "/api/workspace/lists",
        headers={"X-Tenant-Id": "acme"},
        json={"name": "My Targets"},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "List already exists for tenant"


@pytest.mark.anyio
async def test_add_list_item_duplicate_409(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def add_company(self, list_id: int, company_number: str):
            raise IntegrityError("", {}, Exception("duplicate key value violates unique constraint"))

    monkeypatch.setattr(workspace_router, "WorkspaceRepository", FakeRepo)
    res = await client.post(
        "/api/workspace/lists/1/items",
        headers={"X-Tenant-Id": "acme"},
        json={"company_number": "09092149"},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "List item already exists"


@pytest.mark.anyio
async def test_add_list_item_fk_409(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def add_company(self, list_id: int, company_number: str):
            raise IntegrityError("", {}, Exception("insert violates foreign key constraint"))

    monkeypatch.setattr(workspace_router, "WorkspaceRepository", FakeRepo)
    res = await client.post(
        "/api/workspace/lists/1/items",
        headers={"X-Tenant-Id": "acme"},
        json={"company_number": "09092149"},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "List or company not found"


@pytest.mark.anyio
async def test_delete_list_item_404(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session, tenant_id):
            self.session = session
            self.tenant_id = tenant_id

        async def remove_company(self, list_id: int, company_number: str):
            return False

    monkeypatch.setattr(workspace_router, "WorkspaceRepository", FakeRepo)
    res = await client.delete(
        "/api/workspace/lists/1/items/09092149",
        headers={"X-Tenant-Id": "acme"},
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "List item not found"
