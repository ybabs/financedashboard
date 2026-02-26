import pytest


@pytest.mark.anyio
async def test_v1_route_rejects_missing_bearer_token(client):
    res = await client.get("/v1/companies/search", params={"q": "acme"})
    assert res.status_code == 401
    assert "Missing bearer token" in res.json()["detail"]


@pytest.mark.anyio
async def test_v1_route_rejects_invalid_signature(client, make_auth_headers):
    res = await client.get(
        "/v1/companies/search",
        params={"q": "acme"},
        headers=make_auth_headers(secret="wrong-secret"),
    )
    assert res.status_code == 401
    assert "Invalid JWT signature" in res.json()["detail"]


@pytest.mark.anyio
async def test_lists_rejects_tenant_header_mismatch(client, make_auth_headers):
    headers = make_auth_headers(tenant_id="tenant-a")
    headers["X-Tenant-Id"] = "tenant-b"
    res = await client.get("/v1/lists", headers=headers)
    assert res.status_code == 403
    assert "does not match token tenant" in res.json()["detail"]


@pytest.mark.anyio
async def test_lists_rejects_missing_tenant_claim(client, make_auth_headers):
    res = await client.get(
        "/v1/lists",
        headers=make_auth_headers(extra_claims={"tenant_id": None}, include_tenant_header=False),
    )
    assert res.status_code == 401
    assert "Missing tenant claim" in res.json()["detail"]
