from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class SystemRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def ingest_health(self):
        jobs_stmt = text(
            """
            SELECT job_name, last_success_at, last_error, updated_at
            FROM ingest_job_state
            ORDER BY job_name
            """
        )
        jobs = (await self._session.execute(jobs_stmt)).all()

        artifacts_stmt = text(
            """
            SELECT
              COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success_count,
              COALESCE(SUM(CASE WHEN status <> 'success' THEN 1 ELSE 0 END), 0) AS non_success_count,
              MAX(finished_at) AS last_finished_at
            FROM ingest_artifacts
            """
        )
        artifacts = (await self._session.execute(artifacts_stmt)).one()

        now = datetime.now(timezone.utc)
        lag_values: list[float] = []
        job_items = []
        has_error = False

        for row in jobs:
            lag_seconds = None
            if row.last_success_at is not None:
                lag_seconds = max(0.0, (now - row.last_success_at).total_seconds())
                lag_values.append(lag_seconds)
            if row.last_error:
                has_error = True
            job_items.append(
                {
                    "job_name": row.job_name,
                    "last_success_at": row.last_success_at,
                    "last_error": row.last_error,
                    "updated_at": row.updated_at,
                    "lag_seconds": lag_seconds,
                }
            )

        status = "unknown"
        max_lag = max(lag_values) if lag_values else None
        if jobs:
            if has_error or max_lag is None or max_lag > 172800:
                status = "stale"
            elif max_lag > 86400:
                status = "degraded"
            else:
                status = "healthy"

        return {
            "status": status,
            "generated_at": now,
            "max_lag_seconds": max_lag,
            "jobs": job_items,
            "artifacts": {
                "success_count": int(artifacts.success_count or 0),
                "non_success_count": int(artifacts.non_success_count or 0),
                "last_finished_at": artifacts.last_finished_at,
            },
        }

