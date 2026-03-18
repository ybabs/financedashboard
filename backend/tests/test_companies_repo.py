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
