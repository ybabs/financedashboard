from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Float, asc, cast, desc, func, or_, select

from models.company import Company
from models.psc_person import PscPerson


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
