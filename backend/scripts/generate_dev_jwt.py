#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import time
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.config import settings


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def build_token(tenant_id: str, subject: str, expires_in_seconds: int) -> str:
    now = int(time.time())
    header = {"alg": settings.auth_jwt_algorithm, "typ": "JWT"}
    payload = {
        "sub": subject,
        "iss": settings.auth_jwt_issuer,
        "aud": settings.auth_jwt_audience,
        "exp": now + expires_in_seconds,
        "nbf": now - 30,
        settings.auth_tenant_claim: tenant_id,
    }

    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}"

    sig = hmac.new(
        settings.auth_jwt_secret.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_b64url(sig)}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a dev JWT for local API testing.")
    parser.add_argument("--tenant", required=True, help="Tenant ID claim value")
    parser.add_argument("--subject", default="dev-user", help="JWT subject claim")
    parser.add_argument("--expires-in", type=int, default=3600, help="Expiry in seconds")
    args = parser.parse_args()

    print(build_token(tenant_id=args.tenant, subject=args.subject, expires_in_seconds=args.expires_in))


if __name__ == "__main__":
    main()
