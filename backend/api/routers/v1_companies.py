from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import get_auth_context
from core.pagination import decode_offset_cursor, encode_offset_cursor
from db.session import get_session
from repositories.companies_repo import CompaniesRepository
from repositories.financials_repo import FinancialsRepository
from schemas.v1 import (
    V1CompanyCompareResponse,
    V1CompanyCompareSide,
    V1CompanyDetailResponse,
    V1CompanyOverviewResponse,
    V1CompanySearchItem,
    V1CompanySearchResponse,
    V1FinancialSeriesPoint,
    V1FinancialSeriesResponse,
    V1PscItem,
    V1PscListResponse,
)

router = APIRouter(
    prefix="/v1/companies",
    tags=["v1-companies"],
    dependencies=[Depends(get_auth_context)],
)


def _psc_display_name(name: str | None) -> str:
    normalized = (name or "").strip()
    return normalized or "Name unavailable"


@router.get("/search", response_model=V1CompanySearchResponse)
async def search_companies(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    cursor: str | None = Query(default=None, description="Pagination cursor"),
    session: AsyncSession = Depends(get_session),
):
    offset = decode_offset_cursor(cursor)
    repo = CompaniesRepository(session)
    rows = await repo.search(q=q, limit=limit + 1, offset=offset)
    page_rows = rows[:limit]
    next_cursor = encode_offset_cursor(offset + limit) if len(rows) > limit else None
    return V1CompanySearchResponse(
        results=[
            V1CompanySearchItem(
                company_number=r.company_number,
                name=r.name,
                status=r.status,
                score=round(float(r.sim_score or 0.0), 3),
            )
            for r in page_rows
        ],
        next_cursor=next_cursor,
    )


@router.get("/compare", response_model=V1CompanyCompareResponse)
async def compare_companies(
    left: str = Query(..., min_length=1),
    right: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    comparison = await repo.compare_companies(left=left.strip().upper(), right=right.strip().upper())
    if comparison is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or both companies not found")

    left_data, right_data = comparison
    return V1CompanyCompareResponse(
        left=V1CompanyCompareSide(**asdict(left_data)),
        right=V1CompanyCompareSide(**asdict(right_data)),
    )


@router.get("/{company_number}", response_model=V1CompanyDetailResponse)
async def get_company(
    company_number: str,
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    company = await repo.get_company(company_number.strip().upper())
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return V1CompanyDetailResponse(
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


@router.get("/{company_number}/overview", response_model=V1CompanyOverviewResponse)
async def get_company_overview(
    company_number: str,
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    payload = await repo.get_overview(company_number.strip().upper())
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    company = payload["company"]
    return V1CompanyOverviewResponse(
        company_number=company.company_number,
        name=company.name,
        status=company.status,
        account_type=company.account_type,
        last_accounts_made_up_to=company.last_accounts_made_up_to,
        turnover=payload.get("turnover", company.turnover),
        employees=company.employees,
        net_assets=payload.get("net_assets", company.net_assets),
        current_assets=payload.get("current_assets", company.current_assets),
        creditors=payload.get("creditors", company.creditors),
        cash=payload.get("cash", company.cash),
        psc_count=payload["psc_count"],
        current_ratio=payload["current_ratio"],
        updated_at=company.updated_at,
    )


@router.get("/{company_number}/financials/series", response_model=V1FinancialSeriesResponse)
async def get_financial_series(
    company_number: str,
    metric: str = Query(..., description="Canonical metric key"),
    session: AsyncSession = Depends(get_session),
):
    metric_key = metric.strip().lower()
    financials_repo = FinancialsRepository(session)
    supported_metrics = await financials_repo.list_metric_keys()
    if metric_key not in supported_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported metric. Allowed: {', '.join(sorted(supported_metrics))}",
        )

    points = await financials_repo.get_company_metric_series(
        company_number=company_number.strip().upper(),
        metric_key=metric_key,
    )
    return V1FinancialSeriesResponse(
        company_number=company_number.strip().upper(),
        metric=metric_key,
        points=[V1FinancialSeriesPoint(period_date=p["period_date"], value=p["value"]) for p in points],
    )


@router.get("/{company_number}/psc", response_model=V1PscListResponse)
async def get_company_psc(
    company_number: str,
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    items = await repo.get_psc(company_number=company_number.strip().upper(), limit=limit)
    return V1PscListResponse(
        company_number=company_number.strip().upper(),
        items=[
            V1PscItem(
                psc_key=item.psc_key,
                name=_psc_display_name(item.name),
                kind=item.kind,
                natures_of_control=getattr(item, "natures_of_control", None) or [],
                nationality=getattr(item, "nationality", None),
                country_of_residence=getattr(item, "country_of_residence", None),
                ceased=getattr(item, "ceased", None),
                is_sanctioned=getattr(item, "is_sanctioned", None),
                notified_on=getattr(item, "notified_on", None),
                ceased_on=getattr(item, "ceased_on", None),
                dob_year=getattr(item, "dob_year", None),
                dob_month=getattr(item, "dob_month", None),
                description=getattr(item, "description", None),
                address=getattr(item, "address", None),
                principal_office_address=getattr(item, "principal_office_address", None),
                identification=getattr(item, "identification", None),
                identity_verification=getattr(item, "identity_verification", None),
                link_self=getattr(item, "link_self", None),
                link_statement=getattr(item, "link_statement", None),
                updated_at=getattr(item, "updated_at", None),
            )
            for item in items
        ],
    )
