from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
import re

from sqlalchemy import asc, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import ProgrammingError

from core.config import settings
from core.financial_metrics import normalize_tag_name
from models.financial_metric import FinancialMetricDictionary


@dataclass(slots=True)
class MetricDefinition:
    metric_key: str
    tags: list[str]


@dataclass(slots=True)
class CompanyFilingRecord:
    document_id: int
    company_number: str
    source_path: str
    doc_type: str
    parsed_at: datetime
    period_start: date | None
    period_end: date | None
    period_instant: date | None
    current_period_date: date | None


@dataclass(slots=True)
class FilingMetricValue:
    metric_key: str
    value: Decimal
    period_date: date | None
    source_count: int
    priority: int


@dataclass(slots=True)
class CompanyOfficerRecord:
    officer_key: str
    name: str
    role: str | None
    source_kind: str
    source_document_id: int
    source_path: str
    reported_period_date: date | None


@dataclass(slots=True)
class CompanyMetricSeriesPoint:
    period_date: date
    value: Decimal
    source_count: int
    priority: int


@dataclass(slots=True)
class CompanyMetricFilingValue:
    filing: CompanyFilingRecord
    value: Decimal
    period_date: date | None
    source_count: int
    priority: int


@dataclass(slots=True)
class CompanyMetricProvenanceFact:
    document_id: int
    source_path: str
    period_date: date | None
    raw_tag: str
    normalized_tag: str
    value: Decimal
    has_dimensions: bool
    context_ref: str | None


@dataclass(slots=True)
class CompanyFilingDisclosureItem:
    fact_id: int
    section: str
    label: str
    raw_tag: str
    normalized_tag: str
    period_date: date | None
    value_text: str | None
    numeric_value: Decimal | None
    dimensions: list[str]
    linked_metric_keys: list[str]
    is_narrative: bool


class FinancialsRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_metric_definitions(self) -> list[MetricDefinition]:
        stmt = (
            select(FinancialMetricDictionary)
            .where(FinancialMetricDictionary.is_active.is_(True))
            .order_by(
                asc(FinancialMetricDictionary.metric_key),
                asc(FinancialMetricDictionary.priority),
                asc(FinancialMetricDictionary.xbrl_tag_normalized),
            )
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        grouped: dict[str, list[str]] = defaultdict(list)
        for row in rows:
            grouped[row.metric_key].append(row.xbrl_tag_normalized)
        return [MetricDefinition(metric_key=k, tags=v) for k, v in grouped.items()]

    async def _get_metric_tag_link_map(self) -> dict[str, list[str]]:
        stmt = (
            select(
                FinancialMetricDictionary.metric_key,
                FinancialMetricDictionary.xbrl_tag_normalized,
            )
            .where(FinancialMetricDictionary.is_active.is_(True))
            .order_by(
                asc(FinancialMetricDictionary.xbrl_tag_normalized),
                asc(FinancialMetricDictionary.metric_key),
                asc(FinancialMetricDictionary.priority),
            )
        )
        rows = (await self._session.execute(stmt)).all()
        linked: dict[str, list[str]] = defaultdict(list)
        for row in rows:
            normalized_tag = row.xbrl_tag_normalized
            metric_key = row.metric_key
            if metric_key not in linked[normalized_tag]:
                linked[normalized_tag].append(metric_key)
        return dict(linked)

    async def list_metric_keys(self) -> list[str]:
        defs = await self.list_metric_definitions()
        return [d.metric_key for d in defs]

    async def _get_metric_dictionary_rows(self, metric_key: str):
        metric_stmt = (
            select(FinancialMetricDictionary)
            .where(
                FinancialMetricDictionary.metric_key == metric_key,
                FinancialMetricDictionary.is_active.is_(True),
            )
            .order_by(asc(FinancialMetricDictionary.priority))
        )
        return (await self._session.execute(metric_stmt)).scalars().all()

    async def get_company_metric_series(
        self,
        company_number: str,
        metric_key: str,
        max_rows: int = 10000,
    ) -> list[dict]:
        metric_rows = await self._get_metric_dictionary_rows(metric_key)
        if not metric_rows:
            raise ValueError("Unsupported metric")

        tag_priority = {row.xbrl_tag_normalized: int(row.priority) for row in metric_rows}
        mv_points = await self._get_series_from_materialized_view(
            company_number=company_number,
            metric_key=metric_key,
        )
        if mv_points:
            return mv_points
        if not settings.financials_raw_fallback_enabled:
            return []

        return await self._get_series_from_raw(
            company_number=company_number,
            tag_priority=tag_priority,
            max_rows=max_rows,
        )

    async def _get_series_from_materialized_view(self, company_number: str, metric_key: str) -> list[dict]:
        mv_stmt = text(
            """
            SELECT period_date, value, source_count, priority
            FROM financial_metric_series
            WHERE company_number = :company_number
              AND metric_key = :metric_key
            ORDER BY period_date ASC
            """
        )
        try:
            rows = (
                await self._session.execute(
                    mv_stmt,
                    {"company_number": company_number, "metric_key": metric_key},
                )
            ).all()
        except ProgrammingError:
            # Materialized view may not exist / be populated in early environments.
            return []
        return [
            {
                "period_date": row.period_date,
                "value": row.value,
                "source_count": int(row.source_count or 0),
                "priority": int(row.priority or 0),
            }
            for row in rows
        ]

    async def _get_series_from_raw(
        self,
        company_number: str,
        tag_priority: dict[str, int],
        max_rows: int,
    ) -> list[dict]:

        facts_stmt = text(
            """
            SELECT
              f.name_raw,
              f.numeric_value,
              EXISTS (
                SELECT 1
                FROM ixbrl_context_dimensions cd
                WHERE cd.context_pk = c.id
              ) AS has_dimensions,
              c.period_end,
              c.period_instant
            FROM ixbrl_documents d
            JOIN ixbrl_facts f ON f.document_id = d.id
            LEFT JOIN ixbrl_contexts c
              ON c.document_id = d.id
             AND c.context_id = f.context_ref
            WHERE d.company_number = :company_number
              AND f.numeric_value IS NOT NULL
            ORDER BY COALESCE(c.period_end, c.period_instant) DESC NULLS LAST
            LIMIT :row_limit
            """
        )
        fact_rows = (
            await self._session.execute(
                facts_stmt,
                {"company_number": company_number, "row_limit": max_rows},
            )
        ).all()

        # Normalize by period and prefer undimensioned headline facts over note breakdowns.
        by_period: dict[date, dict[tuple[int, bool], list[Decimal]]] = defaultdict(lambda: defaultdict(list))
        for row in fact_rows:
            normalized = normalize_tag_name(row.name_raw)
            priority = tag_priority.get(normalized)
            if priority is None:
                continue

            period = row.period_end or row.period_instant
            if period is None:
                continue
            by_period[period][(priority, bool(row.has_dimensions))].append(row.numeric_value)

        points: list[dict] = []
        for period in sorted(by_period):
            values_by_rank = by_period[period]
            best_rank = min(values_by_rank.keys())
            best_priority, _ = best_rank
            values = values_by_rank[best_rank]
            avg_value = sum(values) / Decimal(len(values))
            points.append(
                {
                    "period_date": period,
                    "value": avg_value,
                    "source_count": len(values),
                    "priority": best_priority,
                }
            )
        return points

    async def get_company_metric_detail(
        self,
        company_number: str,
        metric_key: str,
    ) -> dict:
        normalized_metric_key = metric_key.strip().lower()
        if normalized_metric_key == "current_ratio":
            return await self._get_company_current_ratio_detail(company_number=company_number)

        metric_rows = await self._get_metric_dictionary_rows(normalized_metric_key)
        if not metric_rows:
            raise ValueError("Unsupported metric")

        tag_priority: dict[str, int] = {}
        tags: list[str] = []
        for row in metric_rows:
            normalized_tag = row.xbrl_tag_normalized
            if normalized_tag not in tag_priority:
                tags.append(normalized_tag)
            tag_priority[normalized_tag] = int(row.priority)

        series_rows = await self.get_company_metric_series(
            company_number=company_number,
            metric_key=normalized_metric_key,
        )
        series = [
            CompanyMetricSeriesPoint(
                period_date=item["period_date"],
                value=item["value"],
                source_count=int(item.get("source_count") or 0),
                priority=int(item.get("priority") or 0),
            )
            for item in series_rows
        ]
        filings = await self.list_company_filings(company_number)
        filing_values, latest_filing, provenance_facts = await self._get_metric_filing_values(
            company_number=company_number,
            filings=filings,
            tag_priority=tag_priority,
        )

        latest_value = filing_values[0].value if filing_values else (series[-1].value if series else None)
        latest_period_date = filing_values[0].period_date if filing_values else (series[-1].period_date if series else None)
        if latest_filing is None and latest_period_date is not None:
            latest_filing = next(
                (filing for filing in filings if filing.current_period_date == latest_period_date),
                None,
            )

        return {
            "company_number": company_number,
            "metric_key": normalized_metric_key,
            "tags": tags,
            "derived_from": [],
            "latest_value": latest_value,
            "latest_period_date": latest_period_date,
            "latest_filing": latest_filing,
            "series": series,
            "filings": filing_values,
            "provenance_facts": provenance_facts,
        }

    async def _get_company_current_ratio_detail(self, company_number: str) -> dict:
        current_assets_detail = await self.get_company_metric_detail(company_number=company_number, metric_key="current_assets")
        creditors_detail = await self.get_company_metric_detail(company_number=company_number, metric_key="creditors")

        creditors_series_by_period = {
            item.period_date: item
            for item in creditors_detail["series"]
        }
        series: list[CompanyMetricSeriesPoint] = []
        for asset_point in current_assets_detail["series"]:
            liability_point = creditors_series_by_period.get(asset_point.period_date)
            if liability_point is None or liability_point.value == 0:
                continue
            series.append(
                CompanyMetricSeriesPoint(
                    period_date=asset_point.period_date,
                    value=asset_point.value / liability_point.value,
                    source_count=asset_point.source_count + liability_point.source_count,
                    priority=min(asset_point.priority, liability_point.priority),
                )
            )

        creditors_filing_by_document = {
            item.filing.document_id: item
            for item in creditors_detail["filings"]
        }
        filings: list[CompanyMetricFilingValue] = []
        latest_filing: CompanyFilingRecord | None = None
        latest_provenance_facts: list[CompanyMetricProvenanceFact] = []
        for asset_item in current_assets_detail["filings"]:
            liability_item = creditors_filing_by_document.get(asset_item.filing.document_id)
            if liability_item is None or liability_item.value == 0:
                continue
            filings.append(
                CompanyMetricFilingValue(
                    filing=asset_item.filing,
                    value=asset_item.value / liability_item.value,
                    period_date=asset_item.period_date if asset_item.period_date == liability_item.period_date else asset_item.period_date,
                    source_count=asset_item.source_count + liability_item.source_count,
                    priority=min(asset_item.priority, liability_item.priority),
                )
            )
            if latest_filing is None:
                latest_filing = asset_item.filing
                latest_provenance_facts = [
                    *[
                        fact
                        for fact in current_assets_detail["provenance_facts"]
                        if fact.document_id == asset_item.filing.document_id
                    ],
                    *[
                        fact
                        for fact in creditors_detail["provenance_facts"]
                        if fact.document_id == asset_item.filing.document_id
                    ],
                ]

        combined_tags = list(
            dict.fromkeys([*current_assets_detail["tags"], *creditors_detail["tags"]])
        )
        latest_value = filings[0].value if filings else (series[-1].value if series else None)
        latest_period_date = filings[0].period_date if filings else (series[-1].period_date if series else None)

        return {
            "company_number": company_number,
            "metric_key": "current_ratio",
            "tags": combined_tags,
            "derived_from": ["current_assets", "creditors"],
            "latest_value": latest_value,
            "latest_period_date": latest_period_date,
            "latest_filing": latest_filing,
            "series": series,
            "filings": filings,
            "provenance_facts": latest_provenance_facts,
        }

    async def _get_metric_filing_values(
        self,
        company_number: str,
        filings: list[CompanyFilingRecord],
        tag_priority: dict[str, int],
    ) -> tuple[list[CompanyMetricFilingValue], CompanyFilingRecord | None, list[CompanyMetricProvenanceFact]]:
        if not filings or not tag_priority:
            return [], None, []

        fact_rows = await self._get_company_metric_fact_rows(company_number=company_number)
        filing_lookup = {item.document_id: item for item in filings}
        values_by_document: dict[int, dict[tuple[int, bool], list]] = defaultdict(lambda: defaultdict(list))

        for row in fact_rows:
            filing = filing_lookup.get(int(row.document_id))
            if filing is None or filing.current_period_date is None:
                continue
            if row.period_date != filing.current_period_date:
                continue

            normalized_tag = normalize_tag_name(row.name_raw)
            priority = tag_priority.get(normalized_tag)
            if priority is None:
                continue
            values_by_document[int(row.document_id)][(priority, bool(row.has_dimensions))].append((row, normalized_tag))

        filing_values: list[CompanyMetricFilingValue] = []
        latest_filing: CompanyFilingRecord | None = None
        latest_provenance_facts: list[CompanyMetricProvenanceFact] = []
        for filing in filings:
            values_by_rank = values_by_document.get(filing.document_id)
            if not values_by_rank:
                continue

            best_rank = min(values_by_rank.keys())
            best_priority, _ = best_rank
            best_rows = values_by_rank[best_rank]
            filing_values.append(
                CompanyMetricFilingValue(
                    filing=filing,
                    value=sum(item[0].numeric_value for item in best_rows) / Decimal(len(best_rows)),
                    period_date=filing.current_period_date,
                    source_count=len(best_rows),
                    priority=best_priority,
                )
            )
            if latest_filing is None:
                latest_filing = filing
                latest_provenance_facts = [
                    CompanyMetricProvenanceFact(
                        document_id=filing.document_id,
                        source_path=filing.source_path,
                        period_date=filing.current_period_date,
                        raw_tag=row.name_raw,
                        normalized_tag=normalized_tag,
                        value=row.numeric_value,
                        has_dimensions=bool(row.has_dimensions),
                        context_ref=row.context_ref,
                    )
                    for row, normalized_tag in sorted(
                        best_rows,
                        key=lambda item: (bool(item[0].has_dimensions), item[0].name_raw or "", item[0].context_ref or ""),
                    )
                ]

        return filing_values, latest_filing, latest_provenance_facts

    async def _get_company_metric_fact_rows(self, company_number: str):
        facts_stmt = text(
            """
            SELECT
              d.id AS document_id,
              f.name_raw,
              f.context_ref,
              f.numeric_value,
              EXISTS (
                SELECT 1
                FROM ixbrl_context_dimensions cd
                WHERE cd.context_pk = c.id
              ) AS has_dimensions,
              COALESCE(c.period_instant, c.period_end) AS period_date
            FROM ixbrl_documents d
            JOIN ixbrl_facts f ON f.document_id = d.id
            LEFT JOIN ixbrl_contexts c
              ON c.document_id = d.id
             AND c.context_id = f.context_ref
            WHERE d.company_number = :company_number
              AND f.numeric_value IS NOT NULL
            """
        )
        return (await self._session.execute(facts_stmt, {"company_number": company_number})).all()

    async def refresh_materialized_series(self, concurrently: bool = True) -> None:
        statement = (
            "REFRESH MATERIALIZED VIEW CONCURRENTLY financial_metric_series"
            if concurrently
            else "REFRESH MATERIALIZED VIEW financial_metric_series"
        )
        await self._session.execute(text(statement))

    async def list_company_filings(self, company_number: str) -> list[CompanyFilingRecord]:
        filings_stmt = text(
            """
            SELECT
              d.id AS document_id,
              d.company_number,
              d.source_path,
              d.doc_type,
              d.parsed_at,
              MIN(c.period_start) AS period_start,
              MAX(c.period_end) AS period_end,
              MAX(c.period_instant) AS period_instant,
              COALESCE(MAX(c.period_instant), MAX(c.period_end)) AS current_period_date
            FROM ixbrl_documents d
            LEFT JOIN ixbrl_contexts c ON c.document_id = d.id
            WHERE d.company_number = :company_number
            GROUP BY d.id, d.company_number, d.source_path, d.doc_type, d.parsed_at
            ORDER BY COALESCE(MAX(c.period_instant), MAX(c.period_end)) DESC NULLS LAST, d.id DESC
            """
        )
        rows = (await self._session.execute(filings_stmt, {"company_number": company_number})).all()
        return [
            CompanyFilingRecord(
                document_id=int(row.document_id),
                company_number=row.company_number,
                source_path=row.source_path,
                doc_type=row.doc_type,
                parsed_at=row.parsed_at,
                period_start=row.period_start,
                period_end=row.period_end,
                period_instant=row.period_instant,
                current_period_date=row.current_period_date,
            )
            for row in rows
        ]

    async def get_company_filing(self, company_number: str, document_id: int) -> CompanyFilingRecord | None:
        filings = await self.list_company_filings(company_number)
        for filing in filings:
            if filing.document_id == document_id:
                return filing
        return None

    async def get_company_reported_officers(
        self,
        company_number: str,
        limit: int = 20,
    ) -> dict:
        filings = await self.list_company_filings(company_number)
        if not filings:
            return {"filing": None, "items": []}

        filing = filings[0]
        officers_stmt = text(
            """
            SELECT
              BTRIM(f.value_text) AS officer_name,
              cd.member_local AS member_local
            FROM ixbrl_facts f
            LEFT JOIN ixbrl_contexts c
              ON c.document_id = f.document_id
             AND c.context_id = f.context_ref
            LEFT JOIN ixbrl_context_dimensions cd
              ON cd.context_pk = c.id
             AND cd.dimension_local = 'EntityOfficersDimension'
            WHERE f.document_id = :document_id
              AND f.name_raw = 'business:NameEntityOfficer'
              AND NULLIF(BTRIM(COALESCE(f.value_text, '')), '') IS NOT NULL
            ORDER BY BTRIM(f.value_text) ASC, cd.member_local ASC
            """
        )
        rows = (await self._session.execute(officers_stmt, {"document_id": filing.document_id})).all()

        officers_by_key: dict[str, CompanyOfficerRecord] = {}
        for row in rows:
            name = (row.officer_name or "").strip()
            if not name:
                continue

            officer_key = _build_officer_key(filing.document_id, name)
            role = _format_officer_role(row.member_local)
            existing = officers_by_key.get(officer_key)
            if existing is not None and existing.role is not None:
                continue

            officers_by_key[officer_key] = CompanyOfficerRecord(
                officer_key=officer_key,
                name=name,
                role=role,
                source_kind="latest_filing",
                source_document_id=filing.document_id,
                source_path=filing.source_path,
                reported_period_date=filing.current_period_date,
            )

        items = sorted(officers_by_key.values(), key=lambda item: item.name.casefold())[:limit]
        return {"filing": filing, "items": items}

    async def get_company_filing_snapshot(
        self,
        company_number: str,
        document_id: int,
    ) -> dict | None:
        filing = await self.get_company_filing(company_number=company_number, document_id=document_id)
        if filing is None:
            return None

        metric_stmt = (
            select(FinancialMetricDictionary)
            .where(FinancialMetricDictionary.is_active.is_(True))
            .order_by(
                asc(FinancialMetricDictionary.metric_key),
                asc(FinancialMetricDictionary.priority),
                asc(FinancialMetricDictionary.xbrl_tag_normalized),
            )
        )
        metric_rows = (await self._session.execute(metric_stmt)).scalars().all()
        tag_to_metric_keys: dict[str, list[tuple[str, int]]] = defaultdict(list)
        for row in metric_rows:
            tag_to_metric_keys[row.xbrl_tag_normalized].append((row.metric_key, int(row.priority)))

        if not filing.current_period_date or not tag_to_metric_keys:
            return {"filing": filing, "metrics": []}

        facts_stmt = text(
            """
            SELECT
              f.name_raw,
              f.numeric_value,
              EXISTS (
                SELECT 1
                FROM ixbrl_context_dimensions cd
                WHERE cd.context_pk = c.id
              ) AS has_dimensions,
              COALESCE(c.period_instant, c.period_end) AS period_date
            FROM ixbrl_facts f
            LEFT JOIN ixbrl_contexts c
              ON c.document_id = f.document_id
             AND c.context_id = f.context_ref
            WHERE f.document_id = :document_id
              AND f.numeric_value IS NOT NULL
            """
        )
        fact_rows = (await self._session.execute(facts_stmt, {"document_id": document_id})).all()

        metrics_by_key: dict[str, dict[tuple[int, bool], list[Decimal]]] = defaultdict(lambda: defaultdict(list))
        for row in fact_rows:
            if row.period_date != filing.current_period_date:
                continue
            normalized = normalize_tag_name(row.name_raw)
            for metric_key, priority in tag_to_metric_keys.get(normalized, []):
                metrics_by_key[metric_key][(priority, bool(row.has_dimensions))].append(row.numeric_value)

        metrics: list[FilingMetricValue] = []
        for metric_key in sorted(metrics_by_key.keys()):
            values_by_rank = metrics_by_key[metric_key]
            best_rank = min(values_by_rank.keys())
            best_priority, _ = best_rank
            values = values_by_rank[best_rank]
            metrics.append(
                FilingMetricValue(
                    metric_key=metric_key,
                    value=sum(values) / Decimal(len(values)),
                    period_date=filing.current_period_date,
                    source_count=len(values),
                    priority=best_priority,
                )
            )

        return {"filing": filing, "metrics": metrics}

    async def get_company_filing_disclosures(
        self,
        company_number: str,
        document_id: int,
    ) -> dict | None:
        filing = await self.get_company_filing(company_number=company_number, document_id=document_id)
        if filing is None:
            return None

        disclosures_stmt = text(
            """
            SELECT
              f.id AS fact_id,
              f.name_raw,
              f.name_local,
              NULLIF(BTRIM(COALESCE(f.value_text, '')), '') AS value_text,
              f.numeric_value,
              COALESCE(c.period_instant, c.period_end) AS period_date,
              COALESCE(
                ARRAY_AGG(
                  DISTINCT CASE
                    WHEN cd.dimension_local IS NOT NULL AND cd.member_local IS NOT NULL
                    THEN cd.dimension_local || ':' || cd.member_local
                    ELSE NULL
                  END
                ) FILTER (WHERE cd.dimension_local IS NOT NULL AND cd.member_local IS NOT NULL),
                ARRAY[]::TEXT[]
              ) AS dimensions
            FROM ixbrl_facts f
            LEFT JOIN ixbrl_contexts c
              ON c.document_id = f.document_id
             AND c.context_id = f.context_ref
            LEFT JOIN ixbrl_context_dimensions cd
              ON cd.context_pk = c.id
            WHERE f.document_id = :document_id
              AND (
                NULLIF(BTRIM(COALESCE(f.value_text, '')), '') IS NOT NULL
                OR f.numeric_value IS NOT NULL
              )
            GROUP BY f.id, f.name_raw, f.name_local, f.value_text, f.numeric_value, COALESCE(c.period_instant, c.period_end)
            ORDER BY f.id ASC
            """
        )
        rows = (await self._session.execute(disclosures_stmt, {"document_id": document_id})).all()
        metric_tag_link_map = await self._get_metric_tag_link_map()

        items: list[CompanyFilingDisclosureItem] = []
        for row in rows:
            value_text = (row.value_text or "").strip() or None
            numeric_value = row.numeric_value
            dimension_pairs = [item for item in (row.dimensions or []) if item]
            is_narrative = value_text is not None and numeric_value is None
            has_dimensions = bool(dimension_pairs)
            normalized_tag = normalize_tag_name(row.name_raw)

            if not is_narrative and not has_dimensions:
                continue
            if row.name_raw in {"uk-bus:NameProductionSoftware", "uk-bus:EntityCurrentLegalOrRegisteredName", "uk-bus:UKCompaniesHouseRegisteredNumber"}:
                continue

            dimension_labels = [_format_disclosure_dimension(item) for item in dimension_pairs]
            label = _format_disclosure_label(row.name_local or row.name_raw, dimension_labels)
            items.append(
                CompanyFilingDisclosureItem(
                    fact_id=int(row.fact_id),
                    section=_classify_disclosure_section(
                        raw_tag=row.name_raw,
                        label_source=row.name_local or row.name_raw,
                        dimensions=dimension_labels,
                        is_narrative=is_narrative,
                    ),
                    label=label,
                    raw_tag=row.name_raw,
                    normalized_tag=normalized_tag,
                    period_date=row.period_date,
                    value_text=value_text,
                    numeric_value=numeric_value,
                    dimensions=dimension_labels,
                    linked_metric_keys=metric_tag_link_map.get(normalized_tag, []),
                    is_narrative=is_narrative,
                )
            )

        return {"filing": filing, "items": items}

    async def compare_company_filings(
        self,
        company_number: str,
        left_document_id: int,
        right_document_id: int,
    ) -> dict | None:
        left_snapshot = await self.get_company_filing_snapshot(
            company_number=company_number,
            document_id=left_document_id,
        )
        right_snapshot = await self.get_company_filing_snapshot(
            company_number=company_number,
            document_id=right_document_id,
        )
        if left_snapshot is None or right_snapshot is None:
            return None

        left_metrics = {item.metric_key: item for item in left_snapshot["metrics"]}
        right_metrics = {item.metric_key: item for item in right_snapshot["metrics"]}
        all_metric_keys = sorted(set(left_metrics.keys()) | set(right_metrics.keys()))

        comparison: list[dict] = []
        for metric_key in all_metric_keys:
            left_value = left_metrics.get(metric_key)
            right_value = right_metrics.get(metric_key)
            left_amount = left_value.value if left_value else None
            right_amount = right_value.value if right_value else None
            delta = None
            delta_pct = None
            if left_amount is not None and right_amount is not None:
                delta = left_amount - right_amount
                if right_amount != 0:
                    delta_pct = float(delta / right_amount)
            comparison.append(
                {
                    "metric_key": metric_key,
                    "left_value": left_amount,
                    "right_value": right_amount,
                    "delta": delta,
                    "delta_pct": delta_pct,
                }
            )

        return {
            "left_filing": left_snapshot["filing"],
            "right_filing": right_snapshot["filing"],
            "metrics": comparison,
        }


def _build_officer_key(document_id: int, name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")
    return f"latest-filing:{document_id}:{slug or 'officer'}"


def _format_officer_role(member_local: str | None) -> str | None:
    normalized = (member_local or "").strip()
    if not normalized:
        return None

    normalized = re.sub(r"\d+$", "", normalized).strip()
    if not normalized:
        return None

    words = re.findall(r"[A-Z]+(?=$|[A-Z][a-z])|[A-Z]?[a-z]+|\d+", normalized)
    if not words:
        return normalized
    return " ".join(word.capitalize() for word in words)


def _split_identifier_words(value: str | None) -> list[str]:
    normalized = (value or "").strip()
    if not normalized:
        return []
    if ":" in normalized:
        normalized = normalized.split(":")[-1]
    normalized = re.sub(r"[_-]+", " ", normalized)
    words = re.findall(r"[A-Z]+(?=$|[A-Z][a-z])|[A-Z]?[a-z]+|\d+", normalized)
    return [word.capitalize() for word in words] if words else [normalized]


def _format_disclosure_dimension(value: str) -> str:
    if ":" not in value:
        return " ".join(_split_identifier_words(value))
    dimension_local, member_local = value.split(":", 1)
    formatted_dimension = " ".join(_split_identifier_words(re.sub(r"Dimension$", "", dimension_local)))
    return f"{formatted_dimension}: {' '.join(_split_identifier_words(member_local))}"


def _format_disclosure_label(value: str, dimensions: list[str]) -> str:
    words = _split_identifier_words(value)
    base = " ".join(words) if words else value
    if dimensions:
        dimension_summary = ", ".join(item.split(":", 1)[-1].strip() for item in dimensions)
        return f"{base} • {dimension_summary}"
    return base


def _classify_disclosure_section(
    raw_tag: str,
    label_source: str,
    dimensions: list[str],
    is_narrative: bool,
) -> str:
    local = (label_source or raw_tag).casefold()
    raw = raw_tag.casefold()
    if "director" in local or raw.startswith("uk-direp:"):
        return "Director Statements"
    if "employee" in local or "officer" in local:
        return "People"
    if dimensions:
        return "Note Balances"
    if "date" in local or "period" in local or "dormant" in local:
        return "Reporting Context"
    if is_narrative:
        return "Tagged Disclosures"
    return "Other"
