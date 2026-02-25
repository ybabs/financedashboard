"""Backfill legacy tables to full contract v1 shape

Revision ID: 20260225_0002
Revises: 20260225_0001
Create Date: 2026-02-25
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260225_0002"
down_revision = "20260225_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure legacy companies table gets all v1 columns.
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS registered_address JSONB")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS jurisdiction TEXT")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS turnover NUMERIC")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS employees INTEGER")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS net_assets NUMERIC")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS current_assets NUMERIC")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS creditors NUMERIC")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS cash NUMERIC")
    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()")

    op.execute("ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS sic_codes TEXT[]")
    op.execute("UPDATE companies SET sic_codes='{}'::text[] WHERE sic_codes IS NULL")
    op.execute("ALTER TABLE IF EXISTS companies ALTER COLUMN sic_codes SET DEFAULT '{}'::text[]")
    op.execute("ALTER TABLE IF EXISTS companies ALTER COLUMN sic_codes SET NOT NULL")

    # Ensure canonical PSC table also includes all expected v1 columns.
    op.execute("ALTER TABLE IF EXISTS psc_persons ADD COLUMN IF NOT EXISTS identity_verification JSONB")
    op.execute("ALTER TABLE IF EXISTS psc_persons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()")
    op.execute("ALTER TABLE IF EXISTS psc_persons ADD COLUMN IF NOT EXISTS raw_json JSONB")
    op.execute("UPDATE psc_persons SET raw_json='{}'::jsonb WHERE raw_json IS NULL")
    op.execute("ALTER TABLE IF EXISTS psc_persons ALTER COLUMN raw_json SET NOT NULL")

    # Workspace tables were introduced in v1; ensure they exist for upgraded legacy DBs.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS workspace_lists (
          id BIGSERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          created_by TEXT,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (tenant_id, name)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS workspace_list_items (
          list_id BIGINT NOT NULL REFERENCES workspace_lists(id) ON DELETE CASCADE,
          tenant_id TEXT NOT NULL,
          company_number TEXT NOT NULL REFERENCES companies(company_number) ON DELETE CASCADE,
          added_by TEXT,
          added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (list_id, company_number)
        )
        """
    )


def downgrade() -> None:
    # No-op: this revision performs additive safety backfill for legacy deployments.
    pass

