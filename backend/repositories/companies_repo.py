from sqlalchemy.ext.asyncio import AsyncSession
from dataclasses import dataclass
from decimal import Decimal
from sqlalchemy import Float, asc, case, cast, desc, func, or_, select, text
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


@dataclass(slots=True)
class PscSearchSnapshot:
    psc_key: str
    company_number: str
    company_name: str
    company_status: str | None
    name: str
    psc_kind: str
    ceased: bool | None
    dob_year: int | None
    dob_month: int | None
    score: float | None


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

    async def search_psc(self, q: str, limit: int = 10):
        normalized_q = q.strip()
        if len(normalized_q) < 4:
            return []

        psc_name = func.coalesce(PscPerson.name, "")
        contains_match = psc_name.ilike(f"%{normalized_q}%")
        prefix_match = psc_name.ilike(f"{normalized_q}%")
        word_match = psc_name.ilike(f"% {normalized_q}%")
        rank_score = case(
            (prefix_match, 1.0),
            (word_match, 0.95),
            (contains_match, 0.75),
            else_=0.0,
        )

        stmt = (
            select(
                PscPerson.psc_key,
                PscPerson.company_number,
                Company.name.label("company_name"),
                Company.status.label("company_status"),
                PscPerson.name,
                PscPerson.kind.label("psc_kind"),
                PscPerson.ceased,
                PscPerson.dob_year,
                PscPerson.dob_month,
                cast(rank_score, Float).label("sim_score"),
            )
            .join(Company, Company.company_number == PscPerson.company_number)
            .where(contains_match)
            .order_by(
                asc(func.coalesce(PscPerson.ceased, False)),
                desc(prefix_match),
                desc(word_match),
                asc(PscPerson.name),
                asc(PscPerson.company_number),
            )
            .limit(limit)
        )

        result = await self._session.execute(stmt)
        return [
            PscSearchSnapshot(
                psc_key=row.psc_key,
                company_number=row.company_number,
                company_name=row.company_name,
                company_status=row.company_status,
                name=row.name,
                psc_kind=row.psc_kind,
                ceased=row.ceased,
                dob_year=row.dob_year,
                dob_month=row.dob_month,
                score=float(row.sim_score or 0.0),
            )
            for row in result.all()
        ]

    async def search_global(self, q: str, limit: int = 10):
        normalized_q = q.strip()
        companies = await self.search(q=normalized_q, limit=limit, offset=0)
        psc = await self.search_psc(q=normalized_q, limit=limit)
        return {
            "companies": companies,
            "psc": psc,
        }

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

    async def get_psc_record(self, company_number: str, psc_key: str):
        stmt = (
            select(
                PscPerson,
                Company.name.label("company_name"),
                Company.status.label("company_status"),
            )
            .join(Company, Company.company_number == PscPerson.company_number)
            .where(
                PscPerson.company_number == company_number,
                PscPerson.psc_key == psc_key,
            )
            .limit(1)
        )
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return None
        return {
            "psc": _row_at(row, 0, "PscPerson"),
            "company_name": _row_at(row, 1, "company_name"),
            "company_status": _row_at(row, 2, "company_status"),
        }

    async def get_psc_relationships(self, company_number: str, psc_key: str):
        seed_payload = await self.get_psc_record(company_number=company_number, psc_key=psc_key)
        if seed_payload is None:
            return None

        seed_psc = seed_payload["psc"]
        seed_name = _normalize_psc_name(seed_psc.name)
        linkable = bool(seed_name and seed_psc.dob_year and seed_psc.dob_month)

        seed_company = {
            "company_number": seed_psc.company_number,
            "company_name": seed_payload["company_name"],
            "company_status": seed_payload["company_status"],
            "psc": seed_psc,
            "is_seed": True,
        }

        if not linkable:
            return {
                "seed_company_number": seed_psc.company_number,
                "seed_company_name": seed_payload["company_name"],
                "seed_company_status": seed_payload["company_status"],
                "seed": seed_psc,
                "linkable": False,
                "match_basis": None,
                "link_issue": "missing_name_or_date_of_birth",
                "linked_companies": [seed_company],
            }

        stmt = (
            select(
                PscPerson,
                Company.name.label("company_name"),
                Company.status.label("company_status"),
            )
            .join(Company, Company.company_number == PscPerson.company_number)
            .where(
                PscPerson.dob_year == seed_psc.dob_year,
                PscPerson.dob_month == seed_psc.dob_month,
            )
            .order_by(
                desc(PscPerson.company_number == seed_psc.company_number),
                asc(func.coalesce(PscPerson.ceased, False)),
                asc(Company.name),
                asc(PscPerson.psc_key),
            )
        )
        result = await self._session.execute(stmt)
        linked_companies = []
        for row in result.all():
            psc_row = _row_at(row, 0, "PscPerson")
            if _normalize_psc_name(psc_row.name) != seed_name:
                continue
            linked_companies.append(
                {
                    "company_number": psc_row.company_number,
                    "company_name": _row_at(row, 1, "company_name"),
                    "company_status": _row_at(row, 2, "company_status"),
                    "psc": psc_row,
                    "is_seed": psc_row.company_number == seed_psc.company_number and psc_row.psc_key == seed_psc.psc_key,
                }
            )

        if not linked_companies:
            linked_companies = [seed_company]

        linked_companies.sort(
            key=lambda item: (
                not item["is_seed"],
                bool(getattr(item["psc"], "ceased", False)),
                item["company_name"] or item["company_number"],
                item["company_number"],
            )
        )

        return {
            "seed_company_number": seed_psc.company_number,
            "seed_company_name": seed_payload["company_name"],
            "seed_company_status": seed_payload["company_status"],
            "seed": seed_psc,
            "linkable": True,
            "match_basis": "strict_name_and_dob",
            "link_issue": None if len(linked_companies) > 1 else "no_cross_company_matches",
            "linked_companies": linked_companies,
        }

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


def _normalize_psc_name(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _row_at(row, index: int, attr: str):
    if isinstance(row, tuple):
        return row[index]
    try:
        return getattr(row, attr)
    except AttributeError:
        return row[index]
