from types import SimpleNamespace

import pytest

import api.routers.companies as companies_router


@pytest.mark.anyio
async def test_search_companies_maps_results(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def search(self, q: str, limit: int):
            return [
                SimpleNamespace(
                    company_number="09092149",
                    name="Starling Bank Limited",
                    status="active",
                    sim_score=0.98765,
                )
            ]

    monkeypatch.setattr(companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get("/api/search", params={"q": "starling", "limit": 5})
    assert res.status_code == 200
    data = res.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["company_number"] == "09092149"
    assert data["results"][0]["score"] == 0.988


@pytest.mark.anyio
async def test_get_company_404(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_company(self, company_number: str):
            return None

    monkeypatch.setattr(companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get("/api/companies/MISSING")
    assert res.status_code == 404
    assert res.json()["detail"] == "Company not found"


@pytest.mark.anyio
async def test_get_company_ok(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_company(self, company_number: str):
            return SimpleNamespace(
                company_number=company_number,
                name="Example Co",
                status="active",
                incorporation_date=None,
                account_type="total-exemption-full",
                last_accounts_made_up_to=None,
                region="london",
                turnover=None,
                employees=5,
                net_assets=None,
                current_assets=None,
                creditors=None,
                cash=None,
            )

    monkeypatch.setattr(companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get("/api/companies/123")
    assert res.status_code == 200
    data = res.json()
    assert data["company_number"] == "123"
    assert data["name"] == "Example Co"
    assert data["employees"] == 5


@pytest.mark.anyio
async def test_get_company_psc_ok(client, monkeypatch):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_psc(self, company_number: str, limit: int):
            return [
                SimpleNamespace(
                    psc_key="psc-1",
                    name="Jane Doe",
                    kind="individual-person-with-significant-control",
                    natures_of_control=["ownership-of-shares-25-to-50-percent"],
                    nationality="British",
                    country_of_residence="United Kingdom",
                    ceased=False,
                    notified_on=None,
                    ceased_on=None,
                )
            ]

    monkeypatch.setattr(companies_router, "CompaniesRepository", FakeRepo)
    res = await client.get("/api/companies/09092149/psc", params={"limit": 10})
    assert res.status_code == 200
    data = res.json()
    assert data["company_number"] == "09092149"
    assert len(data["items"]) == 1
    assert data["items"][0]["psc_key"] == "psc-1"
