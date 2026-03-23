from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

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

    async def list_metric_keys(self) -> list[str]:
        defs = await self.list_metric_definitions()
        return [d.metric_key for d in defs]

    async def get_company_metric_series(
        self,
        company_number: str,
        metric_key: str,
        max_rows: int = 10000,
    ) -> list[dict]:
        metric_stmt = (
            select(FinancialMetricDictionary)
            .where(
                FinancialMetricDictionary.metric_key == metric_key,
                FinancialMetricDictionary.is_active.is_(True),
            )
            .order_by(asc(FinancialMetricDictionary.priority))
        )
        metric_rows = (await self._session.execute(metric_stmt)).scalars().all()
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
