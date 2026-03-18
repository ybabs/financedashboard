"""Expand additional metric coverage for balance-sheet and employee facts.

Revision ID: 20260318_0007
Revises: 20260316_0006
Create Date: 2026-03-18
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260318_0007"
down_revision = "20260316_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO financial_metric_dictionary(metric_key, xbrl_tag_normalized, aggregation_method, priority)
        VALUES
          ('investments', 'investments', 'avg', 10),
          ('investments', 'equitysecuritiesheld', 'avg', 20),
          ('debtors', 'debtors', 'avg', 10),
          ('other_debtors', 'otherdebtors', 'avg', 10),
          ('other_creditors', 'othercreditors', 'avg', 10),
          ('employees', 'averagenumberemployeesduringperiod', 'avg', 10)
        ON CONFLICT (metric_key, xbrl_tag_normalized) DO UPDATE
        SET is_active = true,
            aggregation_method = EXCLUDED.aggregation_method,
            priority = EXCLUDED.priority
        """
    )

    op.execute("REFRESH MATERIALIZED VIEW financial_metric_series")


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM financial_metric_dictionary
        WHERE metric_key IN (
          'investments',
          'debtors',
          'other_debtors',
          'other_creditors',
          'employees'
        )
        """
    )

    op.execute("REFRESH MATERIALIZED VIEW financial_metric_series")
