from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

from repositories.companies_repo import CompaniesRepository


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalar_one(self):
        return self._value

    def one_or_none(self):
        return self._value


class _AllResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _SessionForOverviewFallback:
    async def execute(self, stmt, params=None):
        sql_text = str(stmt)
        if "FROM companies" in sql_text:
            return _ScalarResult(
                SimpleNamespace(
                    company_number="00000118",
                    name="Example Co",
                    status="Active",
                    region="kent",
                    account_type="FULL",
                    incorporation_date=date(1900, 1, 1),
                    last_accounts_made_up_to=date(2024, 7, 31),
                    turnover=None,
                    employees=None,
                    net_assets=None,
                    current_assets=None,
                    creditors=None,
                    cash=None,
                    updated_at=datetime(2026, 3, 16, tzinfo=timezone.utc),
                )
            )
        if "count(" in sql_text and "FROM psc_persons" in sql_text:
            return _ScalarResult(2)
        if "financial_metric_series" in sql_text:
            return _AllResult(
                [
                    SimpleNamespace(metric_key="turnover", value=Decimal("957692")),
                    SimpleNamespace(metric_key="net_assets", value=Decimal("6153208")),
                    SimpleNamespace(metric_key="current_assets", value=Decimal("839417")),
                    SimpleNamespace(metric_key="creditors", value=Decimal("343598")),
                    SimpleNamespace(metric_key="cash", value=Decimal("600348")),
                ]
            )
        raise AssertionError(f"Unexpected SQL executed: {sql_text}")


@pytest.mark.anyio
async def test_get_overview_falls_back_to_metric_series():
    repo = CompaniesRepository(_SessionForOverviewFallback())

    overview = await repo.get_overview("00000118")

    assert overview is not None
    assert overview["turnover"] == Decimal("957692")
    assert overview["net_assets"] == Decimal("6153208")
    assert overview["current_assets"] == Decimal("839417")
    assert overview["creditors"] == Decimal("343598")
    assert overview["cash"] == Decimal("600348")
    assert overview["current_ratio"] == pytest.approx(839417 / 343598)


class _SessionForPscRelationships:
    def __init__(self):
        self.calls = 0

    async def execute(self, stmt, params=None):
        self.calls += 1
        if self.calls == 1:
            return _ScalarResult(
                (
                    SimpleNamespace(
                        company_number="14716438",
                        psc_key="seed-key",
                        name="Mr Example Person",
                        kind="individual-person-with-significant-control",
                        natures_of_control=["ownership-of-shares-25-to-50-percent"],
                        ceased=False,
                        dob_year=1994,
                        dob_month=6,
                        nationality="British",
                        country_of_residence="England",
                        notified_on=date(2023, 3, 8),
                        ceased_on=None,
                        link_self="/company/14716438/persons-with-significant-control/individual/seed-key",
                        is_sanctioned=False,
                        address=None,
                        principal_office_address=None,
                        identification=None,
                        identity_verification=None,
                        description=None,
                        updated_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
                    ),
                    "ParkingPennies Ltd",
                    "active",
                )
            )
        if self.calls == 2:
            return _AllResult(
                [
                    (
                        SimpleNamespace(
                            company_number="14716438",
                            psc_key="seed-key",
                            name="Mr Example Person",
                            kind="individual-person-with-significant-control",
                            natures_of_control=["ownership-of-shares-25-to-50-percent"],
                            ceased=False,
                            dob_year=1994,
                            dob_month=6,
                            nationality="British",
                            country_of_residence="England",
                            notified_on=date(2023, 3, 8),
                            ceased_on=None,
                            link_self="/company/14716438/persons-with-significant-control/individual/seed-key",
                            is_sanctioned=False,
                            address=None,
                            principal_office_address=None,
                            identification=None,
                            identity_verification=None,
                            description=None,
                            updated_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
                        ),
                        "ParkingPennies Ltd",
                        "active",
                    ),
                    (
                        SimpleNamespace(
                            company_number="00000042",
                            psc_key="other-key",
                            name=" Mr   Example Person ",
                            kind="individual-person-with-significant-control",
                            natures_of_control=["voting-rights-50-to-75-percent"],
                            ceased=False,
                            dob_year=1994,
                            dob_month=6,
                            nationality="British",
                            country_of_residence="England",
                            notified_on=date(2024, 4, 1),
                            ceased_on=None,
                            link_self="/company/00000042/persons-with-significant-control/individual/other-key",
                            is_sanctioned=False,
                            address=None,
                            principal_office_address=None,
                            identification=None,
                            identity_verification=None,
                            description=None,
                            updated_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
                        ),
                        "Other Co Ltd",
                        "active",
                    ),
                    (
                        SimpleNamespace(
                            company_number="00000099",
                            psc_key="excluded",
                            name="Different Person",
                            kind="individual-person-with-significant-control",
                            natures_of_control=["voting-rights-50-to-75-percent"],
                            ceased=False,
                            dob_year=1994,
                            dob_month=6,
                            nationality="British",
                            country_of_residence="England",
                            notified_on=date(2024, 4, 1),
                            ceased_on=None,
                            link_self="/company/00000099/persons-with-significant-control/individual/excluded",
                            is_sanctioned=False,
                            address=None,
                            principal_office_address=None,
                            identification=None,
                            identity_verification=None,
                            description=None,
                            updated_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
                        ),
                        "Excluded Co Ltd",
                        "active",
                    ),
                ]
            )
        raise AssertionError(f"Unexpected execute call {self.calls}")


@pytest.mark.anyio
async def test_get_psc_relationships_strictly_matches_name_and_dob():
    repo = CompaniesRepository(_SessionForPscRelationships())

    payload = await repo.get_psc_relationships("14716438", "seed-key")

    assert payload is not None
    assert payload["linkable"] is True
    assert payload["match_basis"] == "strict_name_and_dob"
    assert len(payload["linked_companies"]) == 2
    assert payload["linked_companies"][0]["is_seed"] is True
    assert payload["linked_companies"][1]["company_number"] == "00000042"


class _SessionForPscRelationshipsMissingDob:
    async def execute(self, stmt, params=None):
        return _ScalarResult(
            (
                SimpleNamespace(
                    company_number="14716438",
                    psc_key="seed-key",
                    name="Mr Example Person",
                    kind="individual-person-with-significant-control",
                    natures_of_control=[],
                    ceased=False,
                    dob_year=None,
                    dob_month=None,
                    nationality="British",
                    country_of_residence="England",
                    notified_on=date(2023, 3, 8),
                    ceased_on=None,
                    link_self="/company/14716438/persons-with-significant-control/individual/seed-key",
                    is_sanctioned=False,
                    address=None,
                    principal_office_address=None,
                    identification=None,
                    identity_verification=None,
                    description=None,
                    updated_at=datetime(2026, 3, 11, tzinfo=timezone.utc),
                ),
                "ParkingPennies Ltd",
                "active",
            )
        )


@pytest.mark.anyio
async def test_get_psc_relationships_returns_seed_only_when_dob_missing():
    repo = CompaniesRepository(_SessionForPscRelationshipsMissingDob())

    payload = await repo.get_psc_relationships("14716438", "seed-key")

    assert payload is not None
    assert payload["linkable"] is False
    assert payload["link_issue"] == "missing_name_or_date_of_birth"
    assert len(payload["linked_companies"]) == 1
    assert payload["linked_companies"][0]["is_seed"] is True


@pytest.mark.anyio
async def test_search_psc_returns_empty_for_short_queries_without_hitting_db():
    class SessionShouldNotExecute:
        async def execute(self, stmt, params=None):
            raise AssertionError("search_psc should not execute SQL for short queries")

    repo = CompaniesRepository(SessionShouldNotExecute())
    results = await repo.search_psc("pa", limit=6)

    assert results == []
