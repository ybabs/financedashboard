from __future__ import annotations

import re


def normalize_tag_name(raw_name: str | None) -> str:
    if not raw_name:
        return ""
    local = raw_name.split(":")[-1].strip().lower()
    return re.sub(r"[^a-z0-9]+", "", local)
