"""Create contract v1 schema

Revision ID: 20260225_0001
Revises:
Create Date: 2026-02-25
"""

from pathlib import Path
from typing import Any

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260225_0001"
down_revision = None
branch_labels = None
depends_on = None


def _contract_sql_path() -> Path:
    return Path(__file__).resolve().parents[2] / "db" / "sql" / "0001_contract_v1.sql"


def _load_contract_sql() -> str:
    sql = _contract_sql_path().read_text(encoding="utf-8")
    filtered_lines = []
    for line in sql.splitlines():
        token = line.strip().upper()
        if token in {"BEGIN;", "COMMIT;"}:
            continue
        filtered_lines.append(line)
    return "\n".join(filtered_lines)


def _split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    buf: list[str] = []

    in_single_quote = False
    in_double_quote = False
    in_line_comment = False
    in_block_comment = False
    dollar_tag: str | None = None

    i = 0
    n = len(sql)

    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if in_line_comment:
            buf.append(ch)
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            buf.append(ch)
            if ch == "*" and nxt == "/":
                buf.append(nxt)
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if dollar_tag is not None:
            if sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue
            buf.append(ch)
            i += 1
            continue

        if in_single_quote:
            buf.append(ch)
            if ch == "'" and nxt == "'":
                buf.append(nxt)
                i += 2
                continue
            if ch == "'":
                in_single_quote = False
            i += 1
            continue

        if in_double_quote:
            buf.append(ch)
            if ch == '"':
                in_double_quote = False
            i += 1
            continue

        if ch == "-" and nxt == "-":
            buf.append(ch)
            buf.append(nxt)
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            buf.append(ch)
            buf.append(nxt)
            in_block_comment = True
            i += 2
            continue

        if ch == "'":
            buf.append(ch)
            in_single_quote = True
            i += 1
            continue

        if ch == '"':
            buf.append(ch)
            in_double_quote = True
            i += 1
            continue

        if ch == "$":
            j = i + 1
            while j < n and (sql[j].isalnum() or sql[j] == "_"):
                j += 1
            if j < n and sql[j] == "$":
                tag = sql[i : j + 1]
                buf.append(tag)
                dollar_tag = tag
                i = j + 1
                continue

        if ch == ";":
            statement = "".join(buf).strip()
            if statement:
                statements.append(statement)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)

    return statements


def _relation_kind(bind: Any, relation_name: str) -> str | None:
    row = bind.execute(
        sa.text(
            """
            SELECT c.relkind
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = current_schema()
              AND c.relname = :name
            """
        ),
        {"name": relation_name},
    ).fetchone()
    if row is None:
        return None
    return row[0]


def _drop_relation_if_exists(bind: Any, relation_name: str) -> None:
    kind = _relation_kind(bind, relation_name)
    if kind is None:
        return
    if kind == "v":
        bind.exec_driver_sql(f"DROP VIEW IF EXISTS {relation_name}")
        return
    if kind == "m":
        bind.exec_driver_sql(f"DROP MATERIALIZED VIEW IF EXISTS {relation_name}")
        return
    if kind == "f":
        bind.exec_driver_sql(f"DROP FOREIGN TABLE IF EXISTS {relation_name}")
        return
    # Table-like objects ('r', 'p', etc.)
    bind.exec_driver_sql(f"DROP TABLE IF EXISTS {relation_name} CASCADE")


def _migrate_legacy_psc_table(bind: Any) -> None:
    if _relation_kind(bind, "psc") != "r":
        return

    bind.exec_driver_sql(
        """
        INSERT INTO psc_persons(
          company_number, psc_key, name, kind, natures_of_control, notified_on, ceased_on, ceased,
          is_sanctioned, nationality, country_of_residence, dob_year, dob_month, description, address,
          principal_office_address, identification, identity_verification, link_self, link_statement,
          etag, raw_json, updated_at
        )
        SELECT
          company_number, psc_key, name, kind, natures_of_control, notified_on, ceased_on, ceased,
          is_sanctioned, nationality, country_of_residence, dob_year, dob_month, description, address,
          principal_office_address, identification, identity_verification, link_self, link_statement,
          etag, raw_json, updated_at
        FROM psc
        ON CONFLICT (company_number, psc_key) DO NOTHING
        """
    )

    bind.exec_driver_sql("DROP TABLE IF EXISTS psc")


def _migrate_legacy_lists_tables(bind: Any) -> None:
    if _relation_kind(bind, "lists") == "r":
        bind.exec_driver_sql(
            """
            INSERT INTO workspace_lists(id, tenant_id, created_by, name, created_at, updated_at)
            SELECT
              l.id,
              'legacy',
              NULL,
              COALESCE(NULLIF(btrim(l.name), ''), 'list') || ' #' || l.id::text,
              COALESCE(l.created_at, now()),
              COALESCE(l.created_at, now())
            FROM lists l
            ON CONFLICT (id) DO NOTHING
            """
        )
        bind.exec_driver_sql(
            """
            SELECT setval(
              pg_get_serial_sequence('workspace_lists', 'id'),
              COALESCE((SELECT MAX(id) FROM workspace_lists), 1),
              true
            )
            """
        )

    if _relation_kind(bind, "list_items") == "r":
        bind.exec_driver_sql(
            """
            INSERT INTO workspace_list_items(list_id, tenant_id, company_number, added_by, added_at)
            SELECT
              li.list_id,
              wl.tenant_id,
              li.company_number,
              NULL,
              COALESCE(li.added_at, now())
            FROM list_items li
            JOIN workspace_lists wl ON wl.id = li.list_id
            ON CONFLICT (list_id, company_number) DO NOTHING
            """
        )

    _drop_relation_if_exists(bind, "list_items")
    _drop_relation_if_exists(bind, "lists")


def upgrade() -> None:
    bind = op.get_bind()
    sql = _load_contract_sql()
    statements = _split_sql_statements(sql)

    compatibility_view_markers = {
        "psc": "CREATE OR REPLACE VIEW PSC AS",
        "lists": "CREATE OR REPLACE VIEW LISTS AS",
        "list_items": "CREATE OR REPLACE VIEW LIST_ITEMS AS",
    }
    compatibility_view_sql: dict[str, str] = {}

    for statement in statements:
        normalized = statement.upper()
        matched_key = None
        for key, marker in compatibility_view_markers.items():
            if marker in normalized:
                matched_key = key
                compatibility_view_sql[key] = statement
                break
        if matched_key is not None:
            continue
        bind.exec_driver_sql(statement)

    _migrate_legacy_psc_table(bind)
    _migrate_legacy_lists_tables(bind)

    # Recreate compatibility relations as views.
    for key in ("psc", "lists", "list_items"):
        view_sql = compatibility_view_sql.get(key)
        if view_sql:
            _drop_relation_if_exists(bind, key)
            bind.exec_driver_sql(view_sql)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS list_items")
    op.execute("DROP VIEW IF EXISTS lists")
    op.execute("DROP VIEW IF EXISTS psc")

    op.execute("DROP TRIGGER IF EXISTS trg_workspace_list_items_tenant_guard ON workspace_list_items")
    op.execute("DROP FUNCTION IF EXISTS workspace_list_items_tenant_guard")

    op.execute("DROP TABLE IF EXISTS workspace_list_items")
    op.execute("DROP TABLE IF EXISTS workspace_lists")

    op.execute("DROP TABLE IF EXISTS ixbrl_facts")
    op.execute("DROP TABLE IF EXISTS ixbrl_unit_measures")
    op.execute("DROP TABLE IF EXISTS ixbrl_units")
    op.execute("DROP TABLE IF EXISTS ixbrl_context_dimensions")
    op.execute("DROP TABLE IF EXISTS ixbrl_contexts")
    op.execute("DROP TABLE IF EXISTS ixbrl_schema_refs")
    op.execute("DROP TABLE IF EXISTS ixbrl_documents")

    op.execute("DROP TABLE IF EXISTS ingest_job_state")
    op.execute("DROP TABLE IF EXISTS ingest_artifacts")
    op.execute("DROP TABLE IF EXISTS ingest_watermarks")

    op.execute("DROP TABLE IF EXISTS scores")
    op.execute("DROP TABLE IF EXISTS psc_persons_history")
    op.execute("DROP TABLE IF EXISTS psc_persons_stage")
    op.execute("DROP TABLE IF EXISTS psc_persons")
    op.execute("DROP TABLE IF EXISTS officers")
    op.execute("DROP TABLE IF EXISTS companies_stage")
    op.execute("DROP TABLE IF EXISTS companies")
