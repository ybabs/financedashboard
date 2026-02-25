from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def apply_tenant_context(session: AsyncSession, tenant_id: str) -> None:
    # Scope tenant to current transaction so RLS policies enforce isolation.
    await session.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": tenant_id},
    )

