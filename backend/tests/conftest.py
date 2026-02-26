import base64
import hashlib
import hmac
import json
import time
from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import FastAPI

from core.config import settings
from db.session import get_session
from main import app


class _FakeSession:
    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None


@pytest.fixture()
def test_app() -> AsyncIterator[FastAPI]:
    async def _fake_get_session() -> AsyncIterator[_FakeSession]:
        yield _FakeSession()

    app.dependency_overrides[get_session] = _fake_get_session
    try:
        yield app
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
async def client(test_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _build_jwt(
    tenant_id: str = "acme",
    *,
    secret: str | None = None,
    issuer: str | None = None,
    audience: str | None = None,
    exp_delta_seconds: int = 3600,
    nbf_delta_seconds: int = -60,
    extra_claims: dict | None = None,
) -> str:
    now = int(time.time())
    header = {"alg": settings.auth_jwt_algorithm, "typ": "JWT"}
    payload = {
        "sub": "test-user",
        "iss": issuer or settings.auth_jwt_issuer,
        "aud": audience or settings.auth_jwt_audience,
        "exp": now + exp_delta_seconds,
        "nbf": now + nbf_delta_seconds,
        settings.auth_tenant_claim: tenant_id,
    }
    if extra_claims:
        payload.update(extra_claims)

    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}"

    digest = hmac.new(
        (secret or settings.auth_jwt_secret).encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig_b64 = _b64url(digest)
    return f"{signing_input}.{sig_b64}"


@pytest.fixture()
def make_auth_headers():
    def _make(
        tenant_id: str = "acme",
        *,
        include_tenant_header: bool = True,
        secret: str | None = None,
        issuer: str | None = None,
        audience: str | None = None,
        exp_delta_seconds: int = 3600,
        nbf_delta_seconds: int = -60,
        extra_claims: dict | None = None,
    ) -> dict[str, str]:
        token = _build_jwt(
            tenant_id=tenant_id,
            secret=secret,
            issuer=issuer,
            audience=audience,
            exp_delta_seconds=exp_delta_seconds,
            nbf_delta_seconds=nbf_delta_seconds,
            extra_claims=extra_claims,
        )
        headers = {"Authorization": f"Bearer {token}"}
        if include_tenant_header:
            headers[settings.tenant_header_name] = tenant_id
        return headers

    return _make
