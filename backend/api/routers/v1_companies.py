from __future__ import annotations

from dataclasses import asdict
from types import SimpleNamespace

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
    V1CompanyFinancialRecency,
    V1CompanyFilingCompareMetric,
    V1CompanyFilingCompareResponse,
    V1CompanyFilingDisclosureItem,
    V1CompanyFilingDisclosureResponse,
    V1CompanyFilingHistoryResponse,
    V1CompanyFilingItem,
    V1CompanyMetricDetailResponse,
    V1CompanyMetricFilingValue,
    V1CompanyMetricProvenanceFact,
    V1CompanyMetricSeriesPoint,
    V1CompanyFilingMetricValue,
    V1CompanyOfficerItem,
    V1CompanyOfficerListResponse,
    V1CompanyFilingSnapshotResponse,
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


def _psc_has_ceased(item) -> bool | None:
    return bool(getattr(item, "ceased", None)) or bool(getattr(item, "ceased_on", None))


def _serialize_financial_recency(item) -> V1CompanyFinancialRecency | None:
    if item is None:
        return None
    if isinstance(item, SimpleNamespace):
        return V1CompanyFinancialRecency(**vars(item))
    try:
        return V1CompanyFinancialRecency(**asdict(item))
    except TypeError:
        return V1CompanyFinancialRecency(
            company_accounts_made_up_to=getattr(item, "company_accounts_made_up_to", None),
            latest_metric_period_date=getattr(item, "latest_metric_period_date", None),
            latest_filing_period_date=getattr(item, "latest_filing_period_date", None),
            latest_filing_backed_period_date=getattr(item, "latest_filing_backed_period_date", None),
            effective_accounts_made_up_to=getattr(item, "effective_accounts_made_up_to", None),
            source=getattr(item, "source", "unknown"),
        )


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
    financial_recency = await repo.get_financial_recency(
        company.company_number,
        company.last_accounts_made_up_to,
    )
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
        financial_recency=_serialize_financial_recency(financial_recency),
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
        financial_recency=_serialize_financial_recency(payload.get("financial_recency")),
    )


@router.get("/{company_number}/filings", response_model=V1CompanyFilingHistoryResponse)
async def get_company_filings(
    company_number: str,
    session: AsyncSession = Depends(get_session),
):
    financials_repo = FinancialsRepository(session)
    items = await financials_repo.list_company_filings(company_number=company_number.strip().upper())
    return V1CompanyFilingHistoryResponse(
        company_number=company_number.strip().upper(),
        items=[
            V1CompanyFilingItem(
                document_id=item.document_id,
                company_number=item.company_number,
                source_path=item.source_path,
                doc_type=item.doc_type,
                parsed_at=item.parsed_at,
                period_start=item.period_start,
                period_end=item.period_end,
                period_instant=item.period_instant,
                current_period_date=item.current_period_date,
            )
            for item in items
        ],
    )


@router.get("/{company_number}/officers", response_model=V1CompanyOfficerListResponse)
async def get_company_officers(
    company_number: str,
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    financials_repo = FinancialsRepository(session)
    payload = await financials_repo.get_company_reported_officers(
        company_number=company_number.strip().upper(),
        limit=limit,
    )
    filing = payload["filing"]
    return V1CompanyOfficerListResponse(
        company_number=company_number.strip().upper(),
        source_filing=(
            V1CompanyFilingItem(
                document_id=filing.document_id,
                company_number=filing.company_number,
                source_path=filing.source_path,
                doc_type=filing.doc_type,
                parsed_at=filing.parsed_at,
                period_start=filing.period_start,
                period_end=filing.period_end,
                period_instant=filing.period_instant,
                current_period_date=filing.current_period_date,
            )
            if filing is not None
            else None
        ),
        items=[
            V1CompanyOfficerItem(
                officer_key=item.officer_key,
                name=item.name,
                role=item.role,
                source_kind=item.source_kind,
                source_document_id=item.source_document_id,
                source_path=item.source_path,
                reported_period_date=item.reported_period_date,
            )
            for item in payload["items"]
        ],
    )


@router.get("/{company_number}/filings/compare", response_model=V1CompanyFilingCompareResponse)
async def compare_company_filings(
    company_number: str,
    left_document_id: int = Query(..., ge=1),
    right_document_id: int = Query(..., ge=1),
    session: AsyncSession = Depends(get_session),
):
    financials_repo = FinancialsRepository(session)
    payload = await financials_repo.compare_company_filings(
        company_number=company_number.strip().upper(),
        left_document_id=left_document_id,
        right_document_id=right_document_id,
    )
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filing comparison not found")
    return V1CompanyFilingCompareResponse(
        company_number=company_number.strip().upper(),
        left_filing=V1CompanyFilingItem(
            document_id=payload["left_filing"].document_id,
            company_number=payload["left_filing"].company_number,
            source_path=payload["left_filing"].source_path,
            doc_type=payload["left_filing"].doc_type,
            parsed_at=payload["left_filing"].parsed_at,
            period_start=payload["left_filing"].period_start,
            period_end=payload["left_filing"].period_end,
            period_instant=payload["left_filing"].period_instant,
            current_period_date=payload["left_filing"].current_period_date,
        ),
        right_filing=V1CompanyFilingItem(
            document_id=payload["right_filing"].document_id,
            company_number=payload["right_filing"].company_number,
            source_path=payload["right_filing"].source_path,
            doc_type=payload["right_filing"].doc_type,
            parsed_at=payload["right_filing"].parsed_at,
            period_start=payload["right_filing"].period_start,
            period_end=payload["right_filing"].period_end,
            period_instant=payload["right_filing"].period_instant,
            current_period_date=payload["right_filing"].current_period_date,
        ),
        metrics=[
            V1CompanyFilingCompareMetric(
                metric_key=item["metric_key"],
                left_value=item["left_value"],
                right_value=item["right_value"],
                delta=item["delta"],
                delta_pct=item["delta_pct"],
            )
            for item in payload["metrics"]
        ],
    )


@router.get("/{company_number}/filings/{document_id}/snapshot", response_model=V1CompanyFilingSnapshotResponse)
async def get_company_filing_snapshot(
    company_number: str,
    document_id: int,
    session: AsyncSession = Depends(get_session),
):
    financials_repo = FinancialsRepository(session)
    payload = await financials_repo.get_company_filing_snapshot(
        company_number=company_number.strip().upper(),
        document_id=document_id,
    )
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filing not found")
    filing = payload["filing"]
    return V1CompanyFilingSnapshotResponse(
        company_number=company_number.strip().upper(),
        filing=V1CompanyFilingItem(
            document_id=filing.document_id,
            company_number=filing.company_number,
            source_path=filing.source_path,
            doc_type=filing.doc_type,
            parsed_at=filing.parsed_at,
            period_start=filing.period_start,
            period_end=filing.period_end,
            period_instant=filing.period_instant,
            current_period_date=filing.current_period_date,
        ),
        metrics=[
            V1CompanyFilingMetricValue(
                metric_key=item.metric_key,
                value=item.value,
                period_date=item.period_date,
                source_count=item.source_count,
                priority=item.priority,
            )
            for item in payload["metrics"]
        ],
    )


@router.get("/{company_number}/filings/{document_id}/disclosures", response_model=V1CompanyFilingDisclosureResponse)
async def get_company_filing_disclosures(
    company_number: str,
    document_id: int,
    session: AsyncSession = Depends(get_session),
):
    financials_repo = FinancialsRepository(session)
    payload = await financials_repo.get_company_filing_disclosures(
        company_number=company_number.strip().upper(),
        document_id=document_id,
    )
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filing not found")
    filing = payload["filing"]
    return V1CompanyFilingDisclosureResponse(
        company_number=company_number.strip().upper(),
        filing=V1CompanyFilingItem(
            document_id=filing.document_id,
            company_number=filing.company_number,
            source_path=filing.source_path,
            doc_type=filing.doc_type,
            parsed_at=filing.parsed_at,
            period_start=filing.period_start,
            period_end=filing.period_end,
            period_instant=filing.period_instant,
            current_period_date=filing.current_period_date,
        ),
        items=[
            V1CompanyFilingDisclosureItem(
                fact_id=item.fact_id,
                section=item.section,
                label=item.label,
                raw_tag=item.raw_tag,
                normalized_tag=item.normalized_tag,
                period_date=item.period_date,
                value_text=item.value_text,
                numeric_value=item.numeric_value,
                dimensions=item.dimensions,
                linked_metric_keys=item.linked_metric_keys,
                is_narrative=item.is_narrative,
            )
            for item in payload["items"]
        ],
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


@router.get("/{company_number}/financials/metric", response_model=V1CompanyMetricDetailResponse)
async def get_financial_metric_detail(
    company_number: str,
    metric: str = Query(..., description="Canonical metric key"),
    session: AsyncSession = Depends(get_session),
):
    metric_key = metric.strip().lower()
    financials_repo = FinancialsRepository(session)
    supported_metrics = await financials_repo.list_metric_keys()
    allowed_metrics = sorted(set(supported_metrics) | {"current_ratio"})
    if metric_key not in allowed_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported metric. Allowed: {', '.join(allowed_metrics)}",
        )

    payload = await financials_repo.get_company_metric_detail(
        company_number=company_number.strip().upper(),
        metric_key=metric_key,
    )
    latest_filing = payload["latest_filing"]

    return V1CompanyMetricDetailResponse(
        company_number=company_number.strip().upper(),
        metric_key=payload["metric_key"],
        tags=payload["tags"],
        derived_from=payload["derived_from"],
        latest_value=payload["latest_value"],
        latest_period_date=payload["latest_period_date"],
        latest_filing=(
            V1CompanyFilingItem(
                document_id=latest_filing.document_id,
                company_number=latest_filing.company_number,
                source_path=latest_filing.source_path,
                doc_type=latest_filing.doc_type,
                parsed_at=latest_filing.parsed_at,
                period_start=latest_filing.period_start,
                period_end=latest_filing.period_end,
                period_instant=latest_filing.period_instant,
                current_period_date=latest_filing.current_period_date,
            )
            if latest_filing is not None
            else None
        ),
        series=[
            V1CompanyMetricSeriesPoint(
                period_date=item.period_date,
                value=item.value,
                source_count=item.source_count,
                priority=item.priority,
            )
            for item in payload["series"]
        ],
        filings=[
            V1CompanyMetricFilingValue(
                filing=V1CompanyFilingItem(
                    document_id=item.filing.document_id,
                    company_number=item.filing.company_number,
                    source_path=item.filing.source_path,
                    doc_type=item.filing.doc_type,
                    parsed_at=item.filing.parsed_at,
                    period_start=item.filing.period_start,
                    period_end=item.filing.period_end,
                    period_instant=item.filing.period_instant,
                    current_period_date=item.filing.current_period_date,
                ),
                value=item.value,
                period_date=item.period_date,
                source_count=item.source_count,
                priority=item.priority,
            )
            for item in payload["filings"]
        ],
        provenance_facts=[
            V1CompanyMetricProvenanceFact(
                document_id=item.document_id,
                source_path=item.source_path,
                period_date=item.period_date,
                raw_tag=item.raw_tag,
                normalized_tag=item.normalized_tag,
                value=item.value,
                has_dimensions=item.has_dimensions,
                context_ref=item.context_ref,
            )
            for item in payload["provenance_facts"]
        ],
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
                ceased=_psc_has_ceased(item),
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
