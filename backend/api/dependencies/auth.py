from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from fastapi import Header, HTTPException, status

from core.config import settings


@dataclass(slots=True)
class AuthContext:
    subject: str | None
    tenant_id: str | None
    claims: dict
    is_dev_override: bool = False


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * ((4 - len(segment) % 4) % 4)
    return base64.urlsafe_b64decode(f"{segment}{padding}".encode("ascii"))


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_jwt(token: str) -> tuple[dict, dict, str, str]:
    parts = token.split(".")
    if len(parts) != 3:
        raise _unauthorized("Malformed JWT")

    header_b64, payload_b64, sig_b64 = parts
    try:
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception as exc:  # pragma: no cover - defensive parse guard
        raise _unauthorized("Malformed JWT") from exc

    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise _unauthorized("Malformed JWT")
    return header, payload, f"{header_b64}.{payload_b64}", sig_b64


def _validate_signature(header: dict, signing_input: str, signature_b64: str) -> None:
    alg = str(header.get("alg", "")).upper()
    if alg != settings.auth_jwt_algorithm.upper():
        raise _unauthorized("Unsupported JWT algorithm")

    if alg != "HS256":
        raise _unauthorized("Unsupported JWT algorithm")

    expected_sig = hmac.new(
        settings.auth_jwt_secret.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    expected_sig_b64 = _b64url_encode(expected_sig)
    if not hmac.compare_digest(expected_sig_b64, signature_b64):
        raise _unauthorized("Invalid JWT signature")


def _validate_registered_claims(payload: dict) -> None:
    now = int(time.time())

    issuer = payload.get("iss")
    if issuer != settings.auth_jwt_issuer:
        raise _unauthorized("Invalid JWT issuer")

    aud = payload.get("aud")
    expected_aud = settings.auth_jwt_audience
    if isinstance(aud, str):
        if aud != expected_aud:
            raise _unauthorized("Invalid JWT audience")
    elif isinstance(aud, list):
        if expected_aud not in aud:
            raise _unauthorized("Invalid JWT audience")
    else:
        raise _unauthorized("Invalid JWT audience")

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or now >= int(exp):
        raise _unauthorized("JWT expired")

    nbf = payload.get("nbf")
    if nbf is not None:
        if not isinstance(nbf, (int, float)):
            raise _unauthorized("Invalid JWT nbf")
        if now < int(nbf):
            raise _unauthorized("JWT not active yet")


async def get_auth_context(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_tenant_id: str | None = Header(default=None, alias=settings.tenant_header_name),
) -> AuthContext:
    if settings.auth_allow_dev_header_override and x_tenant_id:
        return AuthContext(
            subject="dev-override",
            tenant_id=x_tenant_id.strip() or None,
            claims={},
            is_dev_override=True,
        )

    if not settings.auth_required:
        return AuthContext(subject="anonymous", tenant_id=None, claims={})

    if not authorization:
        raise _unauthorized("Missing bearer token")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Malformed authorization header")

    header, payload, signing_input, signature_b64 = _decode_jwt(token)
    _validate_signature(header=header, signing_input=signing_input, signature_b64=signature_b64)
    _validate_registered_claims(payload)

    subject = payload.get("sub")
    if subject is not None and not isinstance(subject, str):
        raise _unauthorized("Invalid JWT subject")

    tenant_claim = settings.auth_tenant_claim
    tenant_value = payload.get(tenant_claim)
    if tenant_value is not None and not isinstance(tenant_value, str):
        raise _unauthorized("Invalid tenant claim in JWT")

    return AuthContext(
        subject=subject,
        tenant_id=tenant_value.strip() if isinstance(tenant_value, str) else None,
        claims=payload,
        is_dev_override=False,
    )

