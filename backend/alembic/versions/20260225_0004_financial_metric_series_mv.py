"""Add normalized financial metric materialized view

Revision ID: 20260225_0004
Revises: 20260225_0003
Create Date: 2026-02-25
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260225_0004"
down_revision = "20260225_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE MATERIALIZED VIEW IF NOT EXISTS financial_metric_series AS
        WITH normalized_facts AS (
          SELECT
            d.company_number,
            md.metric_key,
            md.priority,
            f.numeric_value,
            COALESCE(c.period_end, c.period_instant) AS period_date
          FROM ixbrl_documents d
          JOIN ixbrl_facts f
            ON f.document_id = d.id
          LEFT JOIN ixbrl_contexts c
            ON c.document_id = d.id
           AND c.context_id = f.context_ref
          JOIN financial_metric_dictionary md
            ON md.is_active = true
           AND md.xbrl_tag_normalized =
               regexp_replace(
                 lower(regexp_replace(f.name_raw, '^.*:', '')),
                 '[^a-z0-9]+',
                 '',
                 'g'
               )
          WHERE f.numeric_value IS NOT NULL
            AND COALESCE(c.period_end, c.period_instant) IS NOT NULL
        ),
        by_priority AS (
          SELECT
            company_number,
            metric_key,
            period_date,
            priority,
            AVG(numeric_value) AS value,
            COUNT(*)::INT AS source_count
          FROM normalized_facts
          GROUP BY company_number, metric_key, period_date, priority
        ),
        ranked AS (
          SELECT
            company_number,
            metric_key,
            period_date,
            value,
            source_count,
            priority,
            ROW_NUMBER() OVER (
              PARTITION BY company_number, metric_key, period_date
              ORDER BY priority ASC
            ) AS rn
          FROM by_priority
        )
        SELECT
          company_number,
          metric_key,
          period_date,
          value,
          source_count,
          priority,
          now() AS refreshed_at
        FROM ranked
        WHERE rn = 1
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS financial_metric_series_company_metric_period_ux
          ON financial_metric_series(company_number, metric_key, period_date)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS financial_metric_series_lookup_ix
          ON financial_metric_series(company_number, metric_key, period_date DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS financial_metric_series_metric_ix
          ON financial_metric_series(metric_key)
        """
    )


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS financial_metric_series")

