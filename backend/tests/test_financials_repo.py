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


@pytest.mark.anyio
async def test_get_company_filing_snapshot_resolves_current_period_metrics_only():
    dict_rows = [
        _DictRow(metric_key="turnover", xbrl_tag_normalized="turnoverrevenue", priority=10),
        _DictRow(metric_key="net_assets", xbrl_tag_normalized="netassetsliabilities", priority=10),
    ]

    class SessionWithFilingFacts:
        async def execute(self, stmt, params=None):
            sql_text = str(stmt)
            if "FROM ixbrl_documents" in sql_text:
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(
                            document_id=3394,
                            company_number="08875186",
                            source_path="Prod223_4173_08875186_20260228.html",
                            doc_type="IXBRL",
                            parsed_at=date(2026, 3, 11),
                            period_start=date(2024, 2, 29),
                            period_end=date(2026, 2, 28),
                            period_instant=date(2026, 2, 28),
                            current_period_date=date(2026, 2, 28),
                        )
                    ]
                )
            if "financial_metric_dictionary" in sql_text:
                return _ScalarResult(dict_rows)
            if "FROM ixbrl_facts" in sql_text:
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(
                            name_raw="core:TurnoverRevenue",
                            numeric_value=Decimal("957692"),
                            has_dimensions=False,
                            period_date=date(2026, 2, 28),
                        ),
                        SimpleNamespace(
                            name_raw="core:TurnoverRevenue",
                            numeric_value=Decimal("900000"),
                            has_dimensions=False,
                            period_date=date(2025, 2, 28),
                        ),
                        SimpleNamespace(
                            name_raw="core:NetAssetsLiabilities",
                            numeric_value=Decimal("6153208"),
                            has_dimensions=False,
                            period_date=date(2026, 2, 28),
                        ),
                    ]
                )
            raise AssertionError(f"Unexpected SQL executed: {sql_text}")

    repo = FinancialsRepository(SessionWithFilingFacts())
    payload = await repo.get_company_filing_snapshot(company_number="08875186", document_id=3394)

    assert payload is not None
    assert payload["filing"].document_id == 3394
    metrics = {item.metric_key: item for item in payload["metrics"]}
    assert metrics["turnover"].value == Decimal("957692")
    assert metrics["net_assets"].value == Decimal("6153208")
    assert metrics["turnover"].period_date == date(2026, 2, 28)


@pytest.mark.anyio
async def test_compare_company_filings_calculates_delta(monkeypatch):
    repo = FinancialsRepository(_SessionForDictionaryOnly(rows=[]))

    async def _fake_snapshot(company_number: str, document_id: int):
        if document_id == 3394:
            return {
                "filing": SimpleNamespace(document_id=3394),
                "metrics": [
                    SimpleNamespace(metric_key="turnover", value=Decimal("957692")),
                    SimpleNamespace(metric_key="net_assets", value=Decimal("6153208")),
                ],
            }
        if document_id == 3392:
            return {
                "filing": SimpleNamespace(document_id=3392),
                "metrics": [
                    SimpleNamespace(metric_key="turnover", value=Decimal("900000")),
                ],
            }
        return None

    monkeypatch.setattr(repo, "get_company_filing_snapshot", _fake_snapshot)

    payload = await repo.compare_company_filings(
        company_number="08875186",
        left_document_id=3394,
        right_document_id=3392,
    )

    assert payload is not None
    metrics = {item["metric_key"]: item for item in payload["metrics"]}
    assert metrics["turnover"]["delta"] == Decimal("57692")
    assert metrics["net_assets"]["right_value"] is None
