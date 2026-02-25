from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_session
from repositories.companies_repo import CompaniesRepository
from schemas.company import (
    CompanyDetailResponse,
    CompanySearchItem,
    CompanySearchResponse,
    PscListResponse,
    PscPersonItem,
)

router = APIRouter(prefix="/api", tags=["companies"])

@router.get("/search", response_model=CompanySearchResponse)
async def search_companies(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    rows = await repo.search(q=q, limit=limit)

    results = []
    for r in rows:
        # r has fields: company_number, name, status, sim_score
        score = float(r.sim_score or 0.0)
        results.append(
            CompanySearchItem(
                company_number=r.company_number,
                name=r.name,
                status=r.status,
                score=round(score, 3),
            )
        )

    return CompanySearchResponse(results=results)


@router.get("/companies/{company_number}", response_model=CompanyDetailResponse)
async def get_company(
    company_number: str,
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    company = await repo.get_company(company_number)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    return CompanyDetailResponse(
        company_number=company.company_number,
        name=company.name,
        status=company.status,
        incorporation_date=company.incorporation_date,
        account_type=company.account_type,
        last_accounts_made_up_to=company.last_accounts_made_up_to,
        region=company.region,
        turnover=company.turnover,
        employees=company.employees,
        net_assets=company.net_assets,
        current_assets=company.current_assets,
        creditors=company.creditors,
        cash=company.cash,
    )


@router.get("/companies/{company_number}/psc", response_model=PscListResponse)
async def get_company_psc(
    company_number: str,
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    items = await repo.get_psc(company_number=company_number, limit=limit)
    return PscListResponse(
        company_number=company_number,
        items=[
            PscPersonItem(
                psc_key=item.psc_key,
                name=item.name,
                kind=item.kind,
                natures_of_control=item.natures_of_control or [],
                nationality=item.nationality,
                country_of_residence=item.country_of_residence,
                ceased=item.ceased,
                notified_on=item.notified_on,
                ceased_on=item.ceased_on,
            )
            for item in items
        ],
    )
