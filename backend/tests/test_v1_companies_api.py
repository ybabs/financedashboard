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
async def test_v1_company_filings_ok(client, monkeypatch, make_auth_headers):
    class FakeFinancialsRepo:
        def __init__(self, session):
            self.session = session

        async def list_company_filings(self, company_number: str):
            return [
                SimpleNamespace(
                    document_id=3394,
                    company_number=company_number,
                    source_path="Prod223_4173_08875186_20260228.html",
                    doc_type="IXBRL",
                    parsed_at=datetime(2026, 3, 11, 21, 55, 14, tzinfo=timezone.utc),
                    period_start=date(2024, 2, 29),
                    period_end=date(2026, 2, 28),
                    period_instant=date(2026, 2, 28),
                    current_period_date=date(2026, 2, 28),
                )
            ]

    monkeypatch.setattr(v1_companies_router, "FinancialsRepository", FakeFinancialsRepo)
    res = await client.get("/v1/companies/08875186/filings", headers=make_auth_headers())
    assert res.status_code == 200
    body = res.json()
    assert body["company_number"] == "08875186"
    assert body["items"][0]["document_id"] == 3394
    assert body["items"][0]["current_period_date"] == "2026-02-28"


@pytest.mark.anyio
async def test_v1_company_filing_snapshot_ok(client, monkeypatch, make_auth_headers):
    class FakeFinancialsRepo:
        def __init__(self, session):
            self.session = session

        async def get_company_filing_snapshot(self, company_number: str, document_id: int):
            return {
                "filing": SimpleNamespace(
                    document_id=document_id,
                    company_number=company_number,
                    source_path="Prod223_4173_08875186_20260228.html",
                    doc_type="IXBRL",
                    parsed_at=datetime(2026, 3, 11, 21, 55, 14, tzinfo=timezone.utc),
                    period_start=date(2024, 2, 29),
                    period_end=date(2026, 2, 28),
                    period_instant=date(2026, 2, 28),
                    current_period_date=date(2026, 2, 28),
                ),
                "metrics": [
                    SimpleNamespace(
                        metric_key="turnover",
                        value=Decimal("957692"),
                        period_date=date(2026, 2, 28),
                        source_count=1,
                        priority=10,
                    ),
                    SimpleNamespace(
                        metric_key="net_assets",
                        value=Decimal("6153208"),
                        period_date=date(2026, 2, 28),
                        source_count=1,
                        priority=10,
                    ),
                ],
            }

    monkeypatch.setattr(v1_companies_router, "FinancialsRepository", FakeFinancialsRepo)
    res = await client.get("/v1/companies/08875186/filings/3394/snapshot", headers=make_auth_headers())
    assert res.status_code == 200
    body = res.json()
    assert body["filing"]["document_id"] == 3394
    assert body["metrics"][0]["metric_key"] == "turnover"
    assert body["metrics"][0]["value"] == "957692"


@pytest.mark.anyio
async def test_v1_company_filing_compare_ok(client, monkeypatch, make_auth_headers):
    class FakeFinancialsRepo:
        def __init__(self, session):
            self.session = session

        async def compare_company_filings(self, company_number: str, left_document_id: int, right_document_id: int):
            return {
                "left_filing": SimpleNamespace(
                    document_id=left_document_id,
                    company_number=company_number,
                    source_path="Prod223_4173_08875186_20260228.html",
                    doc_type="IXBRL",
                    parsed_at=datetime(2026, 3, 11, 21, 55, 14, tzinfo=timezone.utc),
                    period_start=date(2024, 2, 29),
                    period_end=date(2026, 2, 28),
                    period_instant=date(2026, 2, 28),
                    current_period_date=date(2026, 2, 28),
                ),
                "right_filing": SimpleNamespace(
                    document_id=right_document_id,
                    company_number=company_number,
                    source_path="Prod223_4173_08875186_20250228.html",
                    doc_type="IXBRL",
                    parsed_at=datetime(2026, 3, 11, 21, 55, 14, tzinfo=timezone.utc),
                    period_start=date(2023, 2, 22),
                    period_end=date(2025, 2, 28),
                    period_instant=date(2025, 2, 28),
                    current_period_date=date(2025, 2, 28),
                ),
                "metrics": [
                    {
                        "metric_key": "turnover",
                        "left_value": Decimal("957692"),
                        "right_value": Decimal("900000"),
                        "delta": Decimal("57692"),
                        "delta_pct": 0.0641025641,
                    }
                ],
            }

    monkeypatch.setattr(v1_companies_router, "FinancialsRepository", FakeFinancialsRepo)
    res = await client.get(
        "/v1/companies/08875186/filings/compare",
        params={"left_document_id": 3394, "right_document_id": 3392},
        headers=make_auth_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["left_filing"]["document_id"] == 3394
    assert body["right_filing"]["document_id"] == 3392
    assert body["metrics"][0]["metric_key"] == "turnover"


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


@pytest.mark.anyio
async def test_v1_company_psc_infers_ceased_from_ceased_on(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_psc(self, company_number: str, limit: int):
            return [
                SimpleNamespace(
                    psc_key="psc-ceased",
                    name="Example Ceased PSC",
                    kind="individual-person-with-significant-control",
                    natures_of_control=[],
                    nationality="British",
                    country_of_residence="United Kingdom",
                    ceased=False,
                    notified_on=date(2020, 1, 1),
                    ceased_on=date(2025, 4, 1),
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
    assert body["items"][0]["ceased"] is True
    assert body["items"][0]["ceased_on"] == "2025-04-01"
