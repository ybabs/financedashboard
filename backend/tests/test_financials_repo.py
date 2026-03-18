from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from core.config import settings
from repositories.financials_repo import FinancialsRepository


@dataclass
class _DictRow:
    metric_key: str
    xbrl_tag_normalized: str
    priority: int


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _SessionForDictionaryOnly:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, stmt, params=None):
        return _ScalarResult(self.rows)


@pytest.mark.anyio
async def test_get_company_metric_series_unsupported_metric():
    session = _SessionForDictionaryOnly(rows=[])
    repo = FinancialsRepository(session)

    with pytest.raises(ValueError, match="Unsupported metric"):
        await repo.get_company_metric_series(company_number="09092149", metric_key="net_profit")


@pytest.mark.anyio
async def test_get_company_metric_series_prefers_materialized_view(monkeypatch):
    rows = [_DictRow(metric_key="net_profit", xbrl_tag_normalized="profitloss", priority=10)]
    session = _SessionForDictionaryOnly(rows=rows)
    repo = FinancialsRepository(session)

    async def _fake_mv(company_number: str, metric_key: str):
        return [{"period_date": date(2024, 12, 31), "value": Decimal("10"), "source_count": 1, "priority": 10}]

    async def _fake_raw(company_number: str, tag_priority: dict[str, int], max_rows: int):
        raise AssertionError("raw fallback should not be called when materialized view has data")

    monkeypatch.setattr(repo, "_get_series_from_materialized_view", _fake_mv)
    monkeypatch.setattr(repo, "_get_series_from_raw", _fake_raw)

    series = await repo.get_company_metric_series(company_number="09092149", metric_key="net_profit")
    assert len(series) == 1
    assert series[0]["value"] == Decimal("10")


@pytest.mark.anyio
async def test_get_company_metric_series_falls_back_to_raw(monkeypatch):
    monkeypatch.setattr(settings, "financials_raw_fallback_enabled", True)
    rows = [_DictRow(metric_key="net_profit", xbrl_tag_normalized="profitloss", priority=10)]
    session = _SessionForDictionaryOnly(rows=rows)
    repo = FinancialsRepository(session)

    async def _fake_mv(company_number: str, metric_key: str):
        return []

    async def _fake_raw(company_number: str, tag_priority: dict[str, int], max_rows: int):
        assert tag_priority == {"profitloss": 10}
        return [{"period_date": date(2023, 12, 31), "value": Decimal("7.5"), "source_count": 2, "priority": 10}]

    monkeypatch.setattr(repo, "_get_series_from_materialized_view", _fake_mv)
    monkeypatch.setattr(repo, "_get_series_from_raw", _fake_raw)

    series = await repo.get_company_metric_series(company_number="09092149", metric_key="net_profit")
    assert len(series) == 1
    assert series[0]["value"] == Decimal("7.5")


@pytest.mark.anyio
async def test_get_company_metric_series_read_model_only_returns_empty(monkeypatch):
    monkeypatch.setattr(settings, "financials_raw_fallback_enabled", False)
    rows = [_DictRow(metric_key="net_profit", xbrl_tag_normalized="profitloss", priority=10)]
    session = _SessionForDictionaryOnly(rows=rows)
    repo = FinancialsRepository(session)

    async def _fake_mv(company_number: str, metric_key: str):
        return []

    async def _fake_raw(company_number: str, tag_priority: dict[str, int], max_rows: int):
        raise AssertionError("raw fallback should not run when read-model-only mode is enabled")

    monkeypatch.setattr(repo, "_get_series_from_materialized_view", _fake_mv)
    monkeypatch.setattr(repo, "_get_series_from_raw", _fake_raw)

    series = await repo.get_company_metric_series(company_number="09092149", metric_key="net_profit")
    assert series == []


@pytest.mark.anyio
async def test_get_series_from_raw_uses_best_priority(monkeypatch):
    monkeypatch.setattr(settings, "financials_raw_fallback_enabled", True)
    dict_rows = [
        _DictRow(metric_key="net_profit", xbrl_tag_normalized="profitloss", priority=10),
        _DictRow(metric_key="net_profit", xbrl_tag_normalized="profitforfinancialyear", priority=20),
    ]

    class SessionWithFacts:
        async def execute(self, stmt, params=None):
            sql_text = str(stmt)
            if "financial_metric_dictionary" in sql_text:
                return _ScalarResult(dict_rows)
            if "financial_metric_series" in sql_text:
                return SimpleNamespace(all=lambda: [])
            return SimpleNamespace(
                all=lambda: [
                    SimpleNamespace(
                        name_raw="uk-gaap:ProfitForFinancialYear",
                        numeric_value=Decimal("100"),
                        has_dimensions=False,
                        period_end=date(2024, 12, 31),
                        period_instant=None,
                    ),
                    SimpleNamespace(
                        name_raw="uk-gaap:ProfitLoss",
                        numeric_value=Decimal("120"),
                        has_dimensions=False,
                        period_end=date(2024, 12, 31),
                        period_instant=None,
                    ),
                ]
            )

    repo = FinancialsRepository(SessionWithFacts())
    series = await repo.get_company_metric_series(company_number="09092149", metric_key="net_profit")
    assert len(series) == 1
    # priority 10 tag should win over priority 20 for the same period
    assert series[0]["value"] == Decimal("120")
    assert series[0]["priority"] == 10


@pytest.mark.anyio
async def test_get_series_from_raw_prefers_undimensioned_facts_within_priority(monkeypatch):
    monkeypatch.setattr(settings, "financials_raw_fallback_enabled", True)
    dict_rows = [_DictRow(metric_key="fixed_assets", xbrl_tag_normalized="propertyplantequipment", priority=10)]

    class SessionWithFacts:
        async def execute(self, stmt, params=None):
            sql_text = str(stmt)
            if "financial_metric_dictionary" in sql_text:
                return _ScalarResult(dict_rows)
            if "financial_metric_series" in sql_text:
                return SimpleNamespace(all=lambda: [])
            return SimpleNamespace(
                all=lambda: [
                    SimpleNamespace(
                        name_raw="e:PropertyPlantEquipment",
                        numeric_value=Decimal("7637648"),
                        has_dimensions=True,
                        period_end=None,
                        period_instant=date(2024, 7, 31),
                    ),
                    SimpleNamespace(
                        name_raw="e:PropertyPlantEquipment",
                        numeric_value=Decimal("8007094"),
                        has_dimensions=False,
                        period_end=None,
                        period_instant=date(2024, 7, 31),
                    ),
                ]
            )

    repo = FinancialsRepository(SessionWithFacts())
    series = await repo.get_company_metric_series(company_number="00000118", metric_key="fixed_assets")
    assert len(series) == 1
    assert series[0]["value"] == Decimal("8007094")
    assert series[0]["priority"] == 10


@pytest.mark.anyio
async def test_get_series_from_raw_supports_zero_employee_values(monkeypatch):
    monkeypatch.setattr(settings, "financials_raw_fallback_enabled", True)
    dict_rows = [_DictRow(metric_key="employees", xbrl_tag_normalized="averagenumberemployeesduringperiod", priority=10)]

    class SessionWithFacts:
        async def execute(self, stmt, params=None):
            sql_text = str(stmt)
            if "financial_metric_dictionary" in sql_text:
                return _ScalarResult(dict_rows)
            if "financial_metric_series" in sql_text:
                return SimpleNamespace(all=lambda: [])
            return SimpleNamespace(
                all=lambda: [
                    SimpleNamespace(
                        name_raw="core:AverageNumberEmployeesDuringPeriod",
                        numeric_value=Decimal("0"),
                        has_dimensions=False,
                        period_end=date(2024, 3, 31),
                        period_instant=None,
                    ),
                ]
            )

    repo = FinancialsRepository(SessionWithFacts())
    series = await repo.get_company_metric_series(company_number="14716438", metric_key="employees")
    assert len(series) == 1
    assert series[0]["value"] == Decimal("0")
    assert series[0]["priority"] == 10
