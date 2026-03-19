from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import get_auth_context
from db.session import get_session
from repositories.companies_repo import CompaniesRepository
from schemas.v1 import (
    V1GlobalCompanySearchItem,
    V1GlobalPscSearchItem,
    V1GlobalSearchResponse,
)

router = APIRouter(
    prefix="/v1",
    tags=["v1-search"],
    dependencies=[Depends(get_auth_context)],
)


@router.get("/search", response_model=V1GlobalSearchResponse)
async def search_entities(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(6, ge=1, le=20),
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    payload = await repo.search_global(q=q.strip(), limit=limit)
    return V1GlobalSearchResponse(
        companies=[
            V1GlobalCompanySearchItem(
                company_number=row.company_number,
                name=row.name,
                status=row.status,
                score=round(float(row.sim_score or 0.0), 3),
            )
            for row in payload["companies"]
        ],
        psc=[
            V1GlobalPscSearchItem(
                psc_key=row.psc_key,
                company_number=row.company_number,
                company_name=row.company_name,
                company_status=row.company_status,
                name=row.name,
                psc_kind=row.psc_kind,
                ceased=row.ceased,
                dob_year=row.dob_year,
                dob_month=row.dob_month,
                score=round(float(row.score or 0.0), 3),
            )
            for row in payload["psc"]
        ],
    )
