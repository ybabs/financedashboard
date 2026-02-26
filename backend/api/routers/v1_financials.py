from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.auth import get_auth_context
from db.session import get_session
from repositories.financials_repo import FinancialsRepository
from schemas.v1 import V1FinancialMetricCatalogResponse, V1FinancialMetricDefinition

router = APIRouter(
    prefix="/v1/financials",
    tags=["v1-financials"],
    dependencies=[Depends(get_auth_context)],
)


@router.get("/metrics", response_model=V1FinancialMetricCatalogResponse)
async def list_metric_dictionary(session: AsyncSession = Depends(get_session)):
    repo = FinancialsRepository(session)
    defs = await repo.list_metric_definitions()
    return V1FinancialMetricCatalogResponse(
        items=[V1FinancialMetricDefinition(metric_key=d.metric_key, tags=d.tags) for d in defs]
    )
