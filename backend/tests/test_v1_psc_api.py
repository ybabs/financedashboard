from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

import api.routers.v1_psc as v1_psc_router


@pytest.mark.anyio
async def test_v1_psc_relationships_ok(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_psc_relationships(self, company_number: str, psc_key: str):
            assert company_number == "14716438"
            assert psc_key == "psc-seed"
            seed = SimpleNamespace(
                psc_key="psc-seed",
                name="Mr Example Person",
                kind="individual-person-with-significant-control",
                natures_of_control=["ownership-of-shares-25-to-50-percent"],
                nationality="British",
                country_of_residence="England",
                ceased=False,
                is_sanctioned=False,
                notified_on=date(2023, 3, 8),
                ceased_on=None,
                dob_year=1994,
                dob_month=6,
                description=None,
                address=None,
                principal_office_address=None,
                identification=None,
                identity_verification=None,
                link_self="/company/14716438/persons-with-significant-control/individual/psc-seed",
                link_statement=None,
                updated_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
            )
            return {
                "seed_company_number": "14716438",
                "seed_company_name": "ParkingPennies Ltd",
                "seed_company_status": "active",
                "seed": seed,
                "linkable": True,
                "match_basis": "strict_name_and_dob",
                "link_issue": None,
                "linked_companies": [
                    {
                        "company_number": "14716438",
                        "company_name": "ParkingPennies Ltd",
                        "company_status": "active",
                        "is_seed": True,
                        "psc": seed,
                    }
                ],
            }

    monkeypatch.setattr(v1_psc_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/psc/relationships",
        params={"company": "14716438", "psc": "psc-seed"},
        headers=make_auth_headers(),
    )

    assert res.status_code == 200
    body = res.json()
    assert body["seed_company_number"] == "14716438"
    assert body["linkable"] is True
    assert body["seed"]["name"] == "Mr Example Person"
    assert body["linked_companies"][0]["is_seed"] is True


@pytest.mark.anyio
async def test_v1_psc_relationships_returns_404_when_missing(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_psc_relationships(self, company_number: str, psc_key: str):
            return None

    monkeypatch.setattr(v1_psc_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/psc/relationships",
        params={"company": "14716438", "psc": "missing"},
        headers=make_auth_headers(),
    )

    assert res.status_code == 404
    assert res.json()["detail"] == "PSC not found"


@pytest.mark.anyio
async def test_v1_psc_relationships_infers_ceased_from_ceased_on(client, monkeypatch, make_auth_headers):
    class FakeRepo:
        def __init__(self, session):
            self.session = session

        async def get_psc_relationships(self, company_number: str, psc_key: str):
            seed = SimpleNamespace(
                psc_key="psc-seed",
                name="Mr Example Person",
                kind="individual-person-with-significant-control",
                natures_of_control=["ownership-of-shares-25-to-50-percent"],
                nationality="British",
                country_of_residence="England",
                ceased=False,
                is_sanctioned=False,
                notified_on=date(2023, 3, 8),
                ceased_on=date(2025, 4, 1),
                dob_year=1994,
                dob_month=6,
                description=None,
                address=None,
                principal_office_address=None,
                identification=None,
                identity_verification=None,
                link_self="/company/14716438/persons-with-significant-control/individual/psc-seed",
                link_statement=None,
                updated_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
            )
            return {
                "seed_company_number": "14716438",
                "seed_company_name": "ParkingPennies Ltd",
                "seed_company_status": "active",
                "seed": seed,
                "linkable": True,
                "match_basis": "strict_name_and_dob",
                "link_issue": None,
                "linked_companies": [
                    {
                        "company_number": "14716438",
                        "company_name": "ParkingPennies Ltd",
                        "company_status": "active",
                        "is_seed": True,
                        "psc": seed,
                    }
                ],
            }

    monkeypatch.setattr(v1_psc_router, "CompaniesRepository", FakeRepo)
    res = await client.get(
        "/v1/psc/relationships",
        params={"company": "14716438", "psc": "psc-seed"},
        headers=make_auth_headers(),
    )

    assert res.status_code == 200
    body = res.json()
    assert body["seed"]["ceased"] is True
    assert body["seed"]["ceased_on"] == "2025-04-01"
    assert body["linked_companies"][0]["psc"]["ceased"] is True
