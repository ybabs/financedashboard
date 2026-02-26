from __future__ import annotations

import base64

from fastapi import HTTPException, status


def encode_offset_cursor(offset: int) -> str:
    payload = f"o:{max(0, offset)}".encode("ascii")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_offset_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0

    try:
        padded = cursor + ("=" * ((4 - len(cursor) % 4) % 4))
        raw = base64.urlsafe_b64decode(padded.encode("ascii")).decode("ascii")
        prefix, value = raw.split(":", 1)
        if prefix != "o":
            raise ValueError("bad prefix")
        offset = int(value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cursor",
        ) from exc

    if offset < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor")
    return offset

