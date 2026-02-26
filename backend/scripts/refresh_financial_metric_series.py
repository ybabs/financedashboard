from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

# Ensure project root (backend/) is importable when script is run directly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from db.session import engine


async def refresh(concurrently: bool) -> None:
    stmt = (
        "REFRESH MATERIALIZED VIEW CONCURRENTLY financial_metric_series"
        if concurrently
        else "REFRESH MATERIALIZED VIEW financial_metric_series"
    )

    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.execute(text(stmt))


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh normalized financial metric materialized view")
    parser.add_argument(
        "--no-concurrent",
        action="store_true",
        help="Use non-concurrent refresh (locks reads but works without unique index requirements).",
    )
    args = parser.parse_args()
    asyncio.run(refresh(concurrently=not args.no_concurrent))


if __name__ == "__main__":
    main()
