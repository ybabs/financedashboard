from sqlalchemy.ext.asyncio import AsyncSession
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import Float, asc, cast, desc, func, or_, select, text
from sqlalchemy.exc import ProgrammingError

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

    async def _get_latest_metric_values(self, company_number: str) -> dict[str, Decimal]:
        stmt = text(
            """
            SELECT DISTINCT ON (metric_key) metric_key, value
            FROM financial_metric_series
            WHERE company_number = :company_number
            ORDER BY metric_key ASC, period_date DESC
            """
        )
        try:
            rows = (await self._session.execute(stmt, {"company_number": company_number})).all()
        except ProgrammingError:
            return {}
        return {
            row.metric_key: row.value
            for row in rows
            if row.metric_key in {"turnover", "net_assets", "current_assets", "creditors", "cash"}
            and row.value is not None
        }

    async def search(self, q: str, limit: int = 10, offset: int = 0):
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
                asc(Company.company_number),
            )
            .limit(limit)
            .offset(offset)
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
        metric_values = await self._get_latest_metric_values(company_number)

        turnover = company.turnover if company.turnover is not None else metric_values.get("turnover")
        net_assets = company.net_assets if company.net_assets is not None else metric_values.get("net_assets")
        current_assets = (
            company.current_assets if company.current_assets is not None else metric_values.get("current_assets")
        )
        creditors = company.creditors if company.creditors is not None else metric_values.get("creditors")
        cash = company.cash if company.cash is not None else metric_values.get("cash")

        current_ratio = None
        if current_assets is not None and creditors not in (None, 0):
            try:
                current_ratio = float(current_assets / creditors)
            except Exception:
                current_ratio = None

        return {
            "company": company,
            "turnover": turnover,
            "net_assets": net_assets,
            "current_assets": current_assets,
            "creditors": creditors,
            "cash": cash,
            "psc_count": int(psc_count or 0),
            "current_ratio": current_ratio,
        }

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
        left_metrics = await self._get_latest_metric_values(left)
        right_metrics = await self._get_latest_metric_values(right)

        def _coalesce(company_value: Decimal | None, metric_values: dict[str, Decimal], metric_key: str) -> Decimal | None:
            if company_value is not None:
                return company_value
            return metric_values.get(metric_key)

        def _ratio(current_assets: Decimal | None, creditors: Decimal | None) -> float | None:
            if current_assets is None or creditors in (None, 0):
                return None
            try:
                return float(current_assets / creditors)
            except Exception:
                return None

        def _snapshot(company: Company, metric_values: dict[str, Decimal]) -> CompareSnapshot:
            turnover = _coalesce(company.turnover, metric_values, "turnover")
            net_assets = _coalesce(company.net_assets, metric_values, "net_assets")
            current_assets = _coalesce(company.current_assets, metric_values, "current_assets")
            creditors = _coalesce(company.creditors, metric_values, "creditors")
            cash = _coalesce(company.cash, metric_values, "cash")
            return CompareSnapshot(
                company_number=company.company_number,
                name=company.name,
                status=company.status,
                region=company.region,
                turnover=turnover,
                employees=company.employees,
                net_assets=net_assets,
                current_assets=current_assets,
                creditors=creditors,
                cash=cash,
                psc_count=psc_counts.get(company.company_number, 0),
                current_ratio=_ratio(current_assets, creditors),
            )

        return _snapshot(left_company, left_metrics), _snapshot(right_company, right_metrics)
