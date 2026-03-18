from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
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
