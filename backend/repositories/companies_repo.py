from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import Float, asc, cast, desc, func, or_, select, text

from core.financial_metrics import METRIC_TAGS, normalize_tag_name
from models.company import Company
from models.psc_person import PscPerson


@dataclass(slots=True)
class CompareSnapshot:
    company_number: str
    name: str
    status: str | None
    region: str | None
    turnover: Decimal | None
    employees: int | None
    net_assets: Decimal | None
    current_assets: Decimal | None
    creditors: Decimal | None
    cash: Decimal | None
    psc_count: int
    current_ratio: float | None


class CompaniesRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def search(self, q: str, limit: int = 10):
        sim_score = func.similarity(Company.name, q)

        stmt = (
            select(
                Company.company_number,
                Company.name,
                Company.status,
                cast(sim_score, Float).label("sim_score"),
            )
            .where(
                or_(
                    Company.company_number == q,
                    Company.name.ilike(f"%{q}%"),
                    Company.name.op("%")(q),  # pg_trgm fuzzy match operator
                )
            )
            .order_by(
                desc(Company.company_number == q),  # exact ID to top
                desc(sim_score),
                asc(Company.name),
            )
            .limit(limit)
        )

        result = await self._session.execute(stmt)
        return result.all()

    async def get_company(self, company_number: str):
        stmt = select(Company).where(Company.company_number == company_number).limit(1)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_psc(self, company_number: str, limit: int = 50):
        stmt = (
            select(PscPerson)
            .where(PscPerson.company_number == company_number)
            .order_by(asc(PscPerson.name), asc(PscPerson.psc_key))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_overview(self, company_number: str):
        company = await self.get_company(company_number)
        if company is None:
            return None

        psc_stmt = select(func.count()).select_from(PscPerson).where(PscPerson.company_number == company_number)
        psc_count = (await self._session.execute(psc_stmt)).scalar_one()

        current_ratio = None
        if company.current_assets is not None and company.creditors not in (None, 0):
            try:
                current_ratio = float(company.current_assets / company.creditors)
            except Exception:
                current_ratio = None

        return {
            "company": company,
            "psc_count": int(psc_count or 0),
            "current_ratio": current_ratio,
        }

    async def get_financial_series(self, company_number: str, metric: str, max_rows: int = 5000):
        metric_key = metric.strip().lower()
        allowed_tags = METRIC_TAGS.get(metric_key)
        if not allowed_tags:
            raise ValueError("Unsupported metric")

        stmt = text(
            """
            SELECT
              f.name_raw,
              f.numeric_value,
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
        rows = (
            await self._session.execute(
                stmt,
                {"company_number": company_number, "row_limit": max_rows},
            )
        ).all()

        by_period: dict[date, list[Decimal]] = defaultdict(list)
        for row in rows:
            if normalize_tag_name(row.name_raw) not in allowed_tags:
                continue
            period = row.period_end or row.period_instant
            if period is None:
                continue
            by_period[period].append(row.numeric_value)

        points = []
        for period, values in sorted(by_period.items()):
            if not values:
                continue
            avg_value = sum(values) / Decimal(len(values))
            points.append({"period_date": period, "value": avg_value})
        return points

    async def compare_companies(self, left: str, right: str):
        left_company = await self.get_company(left)
        right_company = await self.get_company(right)
        if left_company is None or right_company is None:
            return None

        psc_counts_stmt = (
            select(PscPerson.company_number, func.count().label("count"))
            .where(PscPerson.company_number.in_([left, right]))
            .group_by(PscPerson.company_number)
        )
        psc_counts = {row.company_number: int(row.count) for row in (await self._session.execute(psc_counts_stmt)).all()}

        def _ratio(company: Company) -> float | None:
            if company.current_assets is None or company.creditors in (None, 0):
                return None
            try:
                return float(company.current_assets / company.creditors)
            except Exception:
                return None

        def _snapshot(company: Company) -> CompareSnapshot:
            return CompareSnapshot(
                company_number=company.company_number,
                name=company.name,
                status=company.status,
                region=company.region,
                turnover=company.turnover,
                employees=company.employees,
                net_assets=company.net_assets,
                current_assets=company.current_assets,
                creditors=company.creditors,
                cash=company.cash,
                psc_count=psc_counts.get(company.company_number, 0),
                current_ratio=_ratio(company),
            )

        return _snapshot(left_company), _snapshot(right_company)
