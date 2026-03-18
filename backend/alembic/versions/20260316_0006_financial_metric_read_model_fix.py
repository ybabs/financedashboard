"""Fix financial metric taxonomy and headline fact selection.

Revision ID: 20260316_0006
Revises: 20260226_0005
Create Date: 2026-03-16
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260316_0006"
down_revision = "20260226_0005"
branch_labels = None
depends_on = None


def _create_financial_metric_series_view() -> None:
    op.execute(
        """
        CREATE MATERIALIZED VIEW financial_metric_series AS
        WITH normalized_facts AS (
          SELECT
            d.company_number,
            md.metric_key,
            md.priority,
            f.numeric_value,
            COALESCE(c.period_end, c.period_instant) AS period_date,
            EXISTS (
              SELECT 1
              FROM ixbrl_context_dimensions cd
              WHERE cd.context_pk = c.id
            ) AS has_dimensions
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
        by_rank AS (
          SELECT
            company_number,
            metric_key,
            period_date,
            priority,
            has_dimensions,
            AVG(numeric_value) AS value,
            COUNT(*)::INT AS source_count
          FROM normalized_facts
          GROUP BY company_number, metric_key, period_date, priority, has_dimensions
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
              ORDER BY priority ASC, has_dimensions ASC
            ) AS rn
          FROM by_rank
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


def upgrade() -> None:
    # TODO: add director/officer extraction into the normalized read model.
    op.execute(
        """
        UPDATE financial_metric_dictionary
        SET is_active = false
        WHERE (metric_key = 'assets' AND xbrl_tag_normalized = 'netassetsliabilities')
           OR (metric_key = 'net_profit' AND xbrl_tag_normalized = 'profitlossonordinaryactivitiesbeforetax')
        """
    )

    op.execute(
        """
        UPDATE financial_metric_dictionary
        SET priority = CASE xbrl_tag_normalized
          WHEN 'profitloss' THEN 20
          WHEN 'profitforfinancialyear' THEN 30
          ELSE priority
        END
        WHERE metric_key = 'net_profit'
          AND xbrl_tag_normalized IN ('profitloss', 'profitforfinancialyear')
        """
    )

    op.execute(
        """
        INSERT INTO financial_metric_dictionary(metric_key, xbrl_tag_normalized, aggregation_method, priority)
        VALUES
          ('net_profit', 'profitlossonordinaryactivitiesaftertax', 'avg', 10),
          ('turnover', 'turnoverrevenue', 'avg', 10),
          ('turnover', 'turnover', 'avg', 20),
          ('turnover', 'revenue', 'avg', 30),
          ('net_assets', 'netassetsliabilities', 'avg', 10),
          ('fixed_assets', 'fixedassets', 'avg', 10),
          ('fixed_assets', 'propertyplantequipment', 'avg', 20),
          ('profit_before_tax', 'profitlossonordinaryactivitiesbeforetax', 'avg', 10),
          ('operating_profit', 'operatingprofitloss', 'avg', 10),
          ('net_current_assets', 'netcurrentassetsliabilities', 'avg', 10),
          ('total_assets_less_current_liabilities', 'totalassetslesscurrentliabilities', 'avg', 10),
          ('trade_debtors', 'tradedebtorstradereceivables', 'avg', 10),
          ('trade_creditors', 'tradecreditorstradepayables', 'avg', 10),
          ('deferred_tax', 'netdeferredtaxliabilityasset', 'avg', 10)
        ON CONFLICT (metric_key, xbrl_tag_normalized) DO UPDATE
        SET is_active = true,
            aggregation_method = EXCLUDED.aggregation_method,
            priority = EXCLUDED.priority
        """
    )

    op.execute("DROP MATERIALIZED VIEW IF EXISTS financial_metric_series")
    _create_financial_metric_series_view()


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM financial_metric_dictionary
        WHERE metric_key IN (
          'net_assets',
          'fixed_assets',
          'profit_before_tax',
          'operating_profit',
          'net_current_assets',
          'total_assets_less_current_liabilities',
          'trade_debtors',
          'trade_creditors',
          'deferred_tax'
        )
           OR (metric_key = 'turnover' AND xbrl_tag_normalized = 'turnoverrevenue')
           OR (metric_key = 'net_profit' AND xbrl_tag_normalized = 'profitlossonordinaryactivitiesaftertax')
        """
    )

    op.execute(
        """
        UPDATE financial_metric_dictionary
        SET is_active = true,
            priority = CASE xbrl_tag_normalized
              WHEN 'profitloss' THEN 10
              WHEN 'profitforfinancialyear' THEN 20
              WHEN 'profitlossonordinaryactivitiesbeforetax' THEN 30
              ELSE priority
            END
        WHERE (metric_key = 'assets' AND xbrl_tag_normalized = 'netassetsliabilities')
           OR (metric_key = 'net_profit'
               AND xbrl_tag_normalized IN (
                 'profitloss',
                 'profitforfinancialyear',
                 'profitlossonordinaryactivitiesbeforetax'
               ))
        """
    )

    op.execute("DROP MATERIALIZED VIEW IF EXISTS financial_metric_series")
    op.execute(
        """
        CREATE MATERIALIZED VIEW financial_metric_series AS
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
