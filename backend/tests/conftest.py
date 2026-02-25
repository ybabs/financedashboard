from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import FastAPI

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
