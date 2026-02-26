import re

from fastapi import Depends, Header, HTTPException, status

from api.dependencies.auth import AuthContext, get_auth_context
from core.config import settings

_TENANT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-:.]{1,63}$")


async def get_tenant_id(
    auth: AuthContext = Depends(get_auth_context),
    x_tenant_id: str | None = Header(default=None, alias=settings.tenant_header_name),
) -> str:
    token_tenant_id = (auth.tenant_id or "").strip()
    if not token_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Missing tenant claim: {settings.auth_tenant_claim}",
        )
    if not _TENANT_ID_RE.fullmatch(token_tenant_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid tenant claim format",
        )

    if not x_tenant_id:
        return token_tenant_id

    header_tenant_id = x_tenant_id.strip()
    if not _TENANT_ID_RE.fullmatch(header_tenant_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tenant identifier format",
        )

    if header_tenant_id != token_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant header does not match token tenant",
        )

    return token_tenant_id
