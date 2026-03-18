from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

import api.routers.v1_companies as v1_companies_router
from repositories.companies_repo import CompareSnapshot


@pytest.mark.anyio
async def test_v1_search_companies(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def search(self, q: str, limit: int, offset: int = 0):
            return [
                SimpleNamespace(
                    company_number="09092149",
                    name="Starling Bank Limited",
                    status="active",
                    sim_score=0.91234,
                )
            ]

    monkeypatch.setattr(v1_companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/companies/search",
        params={"q": "starling", "limit": 5},
        headers=make_auth_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["results"][0]["company_number"] == "09092149"
    assert body["results"][0]["score"] == 0.912


@pytest.mark.anyio
async def test_v1_company_overview_ok(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_overview(self, company_number: str):
            company = SimpleNamespace(
                company_number=company_number,
                name="Example Co",
                status="active",
                account_type="small",
                last_accounts_made_up_to=date(2025, 12, 31),
                turnover=Decimal("1000"),
                employees=10,
                net_assets=Decimal("500"),
                current_assets=Decimal("600"),
                creditors=Decimal("200"),
                cash=Decimal("150"),
                updated_at=datetime(2026, 2, 25, tzinfo=timezone.utc),
            )
            return {"company": company, "psc_count": 3, "current_ratio": 3.0}

    monkeypatch.setattr(v1_companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get("/v1/companies/09092149/overview", headers=make_auth_headers())
    assert res.status_code == 200
    body = res.json()
    assert body["company_number"] == "09092149"
    assert body["psc_count"] == 3
    assert body["current_ratio"] == 3.0


@pytest.mark.anyio
async def test_v1_financial_series_rejects_unknown_metric(client, monkeypatch, make_auth_headers):
    class FakeFinancialsRepo:
        def __init__(self, session):
            self.session = session

        async def list_metric_keys(self):
            return ["net_profit", "assets"]

    monkeypatch.setattr(v1_companies_router, "FinancialsRepository", FakeFinancialsRepo)
    res = await client.get(
        "/v1/companies/09092149/financials/series",
        params={"metric": "unknown_metric"},
        headers=make_auth_headers(),
    )
    assert res.status_code == 400
    assert "Unsupported metric" in res.json()["detail"]


@pytest.mark.anyio
async def test_v1_financial_series_ok(client, monkeypatch, make_auth_headers):
    class FakeFinancialsRepo:
        def __init__(self, session):
            self.session = session

        async def list_metric_keys(self):
            return ["net_profit", "assets"]

        async def get_company_metric_series(self, company_number: str, metric_key: str):
            return [
                {"period_date": date(2023, 12, 31), "value": Decimal("120.5")},
                {"period_date": date(2024, 12, 31), "value": Decimal("150.0")},
            ]

    monkeypatch.setattr(v1_companies_router, "FinancialsRepository", FakeFinancialsRepo)
    res = await client.get(
        "/v1/companies/09092149/financials/series",
        params={"metric": "net_profit"},
        headers=make_auth_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["metric"] == "net_profit"
    assert len(body["points"]) == 2


@pytest.mark.anyio
async def test_v1_compare_ok(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def compare_companies(self, left: str, right: str):
            return (
                CompareSnapshot(
                    company_number=left,
                    name="Left Co",
                    status="active",
                    region="london",
                    turnover=Decimal("100"),
                    employees=10,
                    net_assets=Decimal("50"),
                    current_assets=Decimal("20"),
                    creditors=Decimal("10"),
                    cash=Decimal("8"),
                    psc_count=1,
                    current_ratio=2.0,
                ),
                CompareSnapshot(
                    company_number=right,
                    name="Right Co",
                    status="active",
                    region="manchester",
                    turnover=Decimal("90"),
                    employees=8,
                    net_assets=Decimal("40"),
                    current_assets=Decimal("18"),
                    creditors=Decimal("12"),
                    cash=Decimal("5"),
                    psc_count=2,
                    current_ratio=1.5,
                ),
            )

    monkeypatch.setattr(v1_companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/companies/compare",
        params={"left": "A1", "right": "B2"},
        headers=make_auth_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["left"]["company_number"] == "A1"
    assert body["right"]["company_number"] == "B2"


@pytest.mark.anyio
async def test_v1_search_pagination_cursor(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def search(self, q: str, limit: int, offset: int = 0):
            assert offset == 0
            assert limit == 3
            return [
                SimpleNamespace(company_number="1", name="One", status="active", sim_score=0.9),
                SimpleNamespace(company_number="2", name="Two", status="active", sim_score=0.8),
                SimpleNamespace(company_number="3", name="Three", status="active", sim_score=0.7),
            ]

    monkeypatch.setattr(v1_companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/companies/search",
        params={"q": "oo", "limit": 2},
        headers=make_auth_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["results"]) == 2
    assert body["next_cursor"]


@pytest.mark.anyio
async def test_v1_search_rejects_invalid_cursor(client, make_auth_headers):
    res = await client.get(
        "/v1/companies/search",
        params={"q": "acme", "cursor": "not-a-real-cursor"},
        headers=make_auth_headers(),
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid cursor"


@pytest.mark.anyio
async def test_v1_company_psc_normalizes_missing_name(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_psc(self, company_number: str, limit: int):
            return [
                SimpleNamespace(
                    psc_key="psc-1",
                    name=None,
                    kind="individual-person-with-significant-control",
                    natures_of_control=["ownership-of-shares-25-to-50-percent"],
                    nationality="British",
                    country_of_residence="United Kingdom",
                    ceased=False,
                    notified_on=None,
                    ceased_on=None,
                )
            ]

    monkeypatch.setattr(v1_companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/companies/09092149/psc",
        params={"limit": 10},
        headers=make_auth_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["items"][0]["name"] == "Name unavailable"
