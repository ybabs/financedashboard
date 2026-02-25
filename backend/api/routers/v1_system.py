from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_session
from repositories.system_repo import SystemRepository
from schemas.v1 import V1IngestArtifactSummary, V1IngestHealthResponse, V1IngestJobHealth

router = APIRouter(prefix="/v1/system", tags=["v1-system"])


@router.get("/ingest-health", response_model=V1IngestHealthResponse)
async def get_ingest_health(session: AsyncSession = Depends(get_session)):
    repo = SystemRepository(session)
    payload = await repo.ingest_health()
    return V1IngestHealthResponse(
        status=payload["status"],
        generated_at=payload["generated_at"],
        max_lag_seconds=payload["max_lag_seconds"],
        jobs=[V1IngestJobHealth(**job) for job in payload["jobs"]],
        artifacts=V1IngestArtifactSummary(**payload["artifacts"]),
    )

