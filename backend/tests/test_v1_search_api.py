from types import SimpleNamespace

import pytest

import api.routers.v1_search as v1_search_router


@pytest.mark.anyio
async def test_v1_global_search_returns_company_and_psc_sections(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def search_global(self, q: str, limit: int):
            assert q == "ankobia"
            assert limit == 6
            return {
                "companies": [
                    SimpleNamespace(
                        company_number="14716438",
                        name="ParkingPennies Ltd",
                        status="active",
                        sim_score=0.9345,
                    )
                ],
                "psc": [
                    SimpleNamespace(
                        psc_key="psc-1",
                        company_number="14716438",
                        company_name="ParkingPennies Ltd",
                        company_status="active",
                        name="Mr Kwabena Bonsu Ankobia",
                        psc_kind="individual-person-with-significant-control",
                        ceased=False,
                        dob_year=1999,
                        dob_month=11,
                        score=0.887,
                    )
                ],
            }

    monkeypatch.setattr(v1_search_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/search",
        params={"q": "ankobia", "limit": 6},
        headers=make_auth_headers(),
    )

    assert res.status_code == 200
    body = res.json()
    assert body["companies"][0]["kind"] == "company"
    assert body["companies"][0]["company_number"] == "14716438"
    assert body["psc"][0]["kind"] == "psc"
    assert body["psc"][0]["name"] == "Mr Kwabena Bonsu Ankobia"
    assert body["psc"][0]["company_name"] == "ParkingPennies Ltd"
