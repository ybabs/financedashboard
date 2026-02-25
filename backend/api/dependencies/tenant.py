import re

from fastapi import Header, HTTPException, status

from core.config import settings

_TENANT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-:.]{1,63}$")


async def get_tenant_id(
    x_tenant_id: str | None = Header(default=None, alias=settings.tenant_header_name),
) -> str:
    if not x_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required header: {settings.tenant_header_name}",
        )

    tenant_id = x_tenant_id.strip()
    if not _TENANT_ID_RE.fullmatch(tenant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tenant identifier format",
        )

    return tenant_id

