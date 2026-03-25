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
async def test_get_company_reported_officers_dedupes_names_and_extracts_role():
    class SessionWithOfficerFacts:
        async def execute(self, stmt, params=None):
            sql_text = str(stmt)
            if "FROM ixbrl_documents" in sql_text:
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(
                            document_id=721679,
                            company_number="14716438",
                            source_path="Prod224_2503_14716438_20240331.html",
                            doc_type="IXBRL",
                            parsed_at=date(2026, 3, 11),
                            period_start=date(2023, 3, 8),
                            period_end=date(2024, 3, 31),
                            period_instant=date(2024, 3, 31),
                            current_period_date=date(2024, 3, 31),
                        )
                    ]
                )
            if "business:NameEntityOfficer" in sql_text:
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(officer_name="Kwaku Owusu Diabaa ANKOBIA", member_local="Director2"),
                        SimpleNamespace(officer_name="Kwaku Owusu Diabaa ANKOBIA", member_local="Director2"),
                        SimpleNamespace(officer_name="Kwabena Bonsu ANKOBIA", member_local="Director1"),
                    ]
                )
            raise AssertionError(f"Unexpected SQL: {sql_text}")

    repo = FinancialsRepository(SessionWithOfficerFacts())
    payload = await repo.get_company_reported_officers(company_number="14716438")
    assert payload["filing"].document_id == 721679
    assert len(payload["items"]) == 2
    assert payload["items"][0].role == "Director"
    assert payload["items"][1].role == "Director"
    assert payload["items"][0].officer_key.startswith("latest-filing:721679:")


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
async def test_get_company_filing_disclosures_returns_narrative_and_dimensional_facts():
    class SessionWithDisclosureFacts:
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
                            period_start=date(2025, 3, 1),
                            period_end=date(2026, 2, 28),
                            period_instant=date(2026, 2, 28),
                            current_period_date=date(2026, 2, 28),
                        )
                    ]
                )
            if "ARRAY_AGG" in sql_text:
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(
                            fact_id=1,
                            name_raw="uk-direp:StatementThatMembersHaveNotRequiredCompanyToObtainAnAudit",
                            name_local="StatementThatMembersHaveNotRequiredCompanyToObtainAnAudit",
                            value_text="The members have not required the company to obtain an audit.",
                            numeric_value=None,
                            period_date=date(2026, 2, 28),
                            dimensions=[],
                        ),
                        SimpleNamespace(
                            fact_id=2,
                            name_raw="uk-core:Creditors",
                            name_local="Creditors",
                            value_text="35,300",
                            numeric_value=Decimal("35300"),
                            period_date=date(2026, 2, 28),
                            dimensions=["MaturitiesOrExpirationPeriodsDimension:WithinOneYear"],
                        ),
                        SimpleNamespace(
                            fact_id=3,
                            name_raw="uk-bus:NameProductionSoftware",
                            name_local="NameProductionSoftware",
                            value_text="Companies House",
                            numeric_value=None,
                            period_date=date(2026, 2, 28),
                            dimensions=[],
                        ),
                    ]
                )
            if "financial_metric_dictionary" in sql_text:
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(metric_key="creditors", xbrl_tag_normalized="creditors"),
                        SimpleNamespace(metric_key="employees", xbrl_tag_normalized="averagenumberemployeesduringperiod"),
                    ]
                )
            raise AssertionError(f"Unexpected SQL executed: {sql_text}")

    repo = FinancialsRepository(SessionWithDisclosureFacts())
    payload = await repo.get_company_filing_disclosures(company_number="08875186", document_id=3394)

    assert payload is not None
    assert payload["filing"].document_id == 3394
    assert len(payload["items"]) == 2
    first, second = payload["items"]
    assert first.section == "Director Statements"
    assert first.is_narrative is True
    assert first.normalized_tag == "statementthatmembershavenotrequiredcompanytoobtainanaudit"
    assert first.linked_metric_keys == []
    assert second.section == "Note Balances"
    assert second.numeric_value == Decimal("35300")
    assert second.normalized_tag == "creditors"
    assert second.linked_metric_keys == ["creditors"]
    assert second.dimensions == ["Maturities Or Expiration Periods: Within One Year"]
    assert "Within One Year" in second.label


@pytest.mark.anyio
async def test_get_company_metric_detail_includes_series_filings_and_provenance(monkeypatch):
    dict_rows = [
        _DictRow(metric_key="turnover", xbrl_tag_normalized="turnoverrevenue", priority=10),
    ]

    class SessionWithMetricDetail:
        async def execute(self, stmt, params=None):
            sql_text = str(stmt)
            if "financial_metric_dictionary" in sql_text:
                return _ScalarResult(dict_rows)
            if "GROUP BY d.id, d.company_number, d.source_path, d.doc_type, d.parsed_at" in sql_text:
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
            if "JOIN ixbrl_facts f ON f.document_id = d.id" in sql_text:
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(
                            document_id=3394,
                            name_raw="core:TurnoverRevenue",
                            context_ref="CurrentYear",
                            numeric_value=Decimal("957692"),
                            has_dimensions=False,
                            period_date=date(2026, 2, 28),
                        ),
                        SimpleNamespace(
                            document_id=3394,
                            name_raw="core:TurnoverRevenue",
                            context_ref="DetailedBreakdown",
                            numeric_value=Decimal("950000"),
                            has_dimensions=True,
                            period_date=date(2026, 2, 28),
                        ),
                    ]
                )
            raise AssertionError(f"Unexpected SQL executed: {sql_text}")

    repo = FinancialsRepository(SessionWithMetricDetail())

    async def _fake_series(company_number: str, metric_key: str, max_rows: int = 10000):
        assert company_number == "08875186"
        assert metric_key == "turnover"
        return [
            {
                "period_date": date(2026, 2, 28),
                "value": Decimal("957692"),
                "source_count": 1,
                "priority": 10,
            }
        ]

    monkeypatch.setattr(repo, "get_company_metric_series", _fake_series)

    payload = await repo.get_company_metric_detail(company_number="08875186", metric_key="turnover")

    assert payload["metric_key"] == "turnover"
    assert payload["tags"] == ["turnoverrevenue"]
    assert payload["latest_value"] == Decimal("957692")
    assert payload["latest_period_date"] == date(2026, 2, 28)
    assert len(payload["series"]) == 1
    assert payload["series"][0].source_count == 1
    assert len(payload["filings"]) == 1
    assert payload["filings"][0].filing.document_id == 3394
    assert payload["filings"][0].value == Decimal("957692")
    assert len(payload["provenance_facts"]) == 1
    assert payload["provenance_facts"][0].raw_tag == "core:TurnoverRevenue"
    assert payload["provenance_facts"][0].normalized_tag == "turnoverrevenue"
    assert payload["provenance_facts"][0].has_dimensions is False


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
