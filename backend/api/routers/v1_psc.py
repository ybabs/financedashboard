from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import get_auth_context
from db.session import get_session
from repositories.companies_repo import CompaniesRepository
from schemas.v1 import V1PscItem, V1PscRelationshipCompany, V1PscRelationshipResponse

router = APIRouter(
    prefix="/v1/psc",
    tags=["v1-psc"],
    dependencies=[Depends(get_auth_context)],
)


def _psc_display_name(name: str | None) -> str:
    normalized = (name or "").strip()
    return normalized or "Name unavailable"


def _psc_has_ceased(item) -> bool | None:
    return bool(getattr(item, "ceased", None)) or bool(getattr(item, "ceased_on", None))


def _serialize_psc_item(item) -> V1PscItem:
    return V1PscItem(
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


@router.get("/relationships", response_model=V1PscRelationshipResponse)
async def get_psc_relationships(
    company: str = Query(..., min_length=1, description="Companies House company number"),
    psc: str = Query(..., min_length=1, description="PSC key from the Companies House API"),
    session: AsyncSession = Depends(get_session),
):
    repo = CompaniesRepository(session)
    payload = await repo.get_psc_relationships(company_number=company.strip().upper(), psc_key=psc)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PSC not found")

    return V1PscRelationshipResponse(
        seed_company_number=payload["seed_company_number"],
        seed_company_name=payload["seed_company_name"],
        seed_company_status=payload["seed_company_status"],
        seed=_serialize_psc_item(payload["seed"]),
        linkable=payload["linkable"],
        match_basis=payload["match_basis"],
        link_issue=payload["link_issue"],
        linked_companies=[
            V1PscRelationshipCompany(
                company_number=item["company_number"],
                company_name=item["company_name"],
                company_status=item["company_status"],
                is_seed=item["is_seed"],
                psc=_serialize_psc_item(item["psc"]),
            )
            for item in payload["linked_companies"]
        ],
    )
