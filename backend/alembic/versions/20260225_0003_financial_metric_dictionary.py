"""Add financial metric dictionary and seed canonical mappings

Revision ID: 20260225_0003
Revises: 20260225_0002
Create Date: 2026-02-25
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260225_0003"
down_revision = "20260225_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS financial_metric_dictionary (
          id BIGSERIAL PRIMARY KEY,
          metric_key TEXT NOT NULL,
          xbrl_tag_normalized TEXT NOT NULL,
          aggregation_method TEXT NOT NULL DEFAULT 'avg',
          priority INT NOT NULL DEFAULT 100,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (metric_key, xbrl_tag_normalized)
        )
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS financial_metric_dictionary_metric_ix
        ON financial_metric_dictionary(metric_key)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS financial_metric_dictionary_tag_ix
        ON financial_metric_dictionary(xbrl_tag_normalized)
        """
    )

    op.execute(
        """
        INSERT INTO financial_metric_dictionary(metric_key, xbrl_tag_normalized, aggregation_method, priority)
        VALUES
          ('net_profit', 'profitloss', 'avg', 10),
          ('net_profit', 'profitforfinancialyear', 'avg', 20),
          ('net_profit', 'profitlossonordinaryactivitiesbeforetax', 'avg', 30),

          ('assets', 'assets', 'avg', 10),
          ('assets', 'totalassetslesscurrentliabilities', 'avg', 20),
          ('assets', 'netassetsliabilities', 'avg', 30),

          ('cash', 'cashbankonhand', 'avg', 10),
          ('cash', 'cashandcashequivalents', 'avg', 20),

          ('turnover', 'turnover', 'avg', 10),
          ('turnover', 'revenue', 'avg', 20),

          ('current_assets', 'currentassets', 'avg', 10),

          ('creditors', 'creditors', 'avg', 10),
          ('creditors', 'creditorswithinoneyear', 'avg', 20),
          ('creditors', 'currentliabilities', 'avg', 30)
        ON CONFLICT (metric_key, xbrl_tag_normalized) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS financial_metric_dictionary")

