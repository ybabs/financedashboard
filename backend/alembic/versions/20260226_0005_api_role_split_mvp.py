"""Add MVP DB role split grants for API users

Revision ID: 20260226_0005
Revises: 20260225_0004
Create Date: 2026-02-26
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260226_0005"
down_revision = "20260225_0004"
branch_labels = None
depends_on = None


def _create_roles_if_possible() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_readonly') THEN
            CREATE ROLE api_readonly NOINHERIT;
          END IF;
        EXCEPTION
          WHEN insufficient_privilege THEN
            RAISE NOTICE 'Skipping role create for api_readonly (insufficient privilege)';
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_rw_tenant') THEN
            CREATE ROLE api_rw_tenant NOINHERIT;
          END IF;
        EXCEPTION
          WHEN insufficient_privilege THEN
            RAISE NOTICE 'Skipping role create for api_rw_tenant (insufficient privilege)';
        END
        $$;
        """
    )


def _grant_readonly() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_readonly') THEN
            GRANT USAGE ON SCHEMA public TO api_readonly;
            GRANT SELECT ON TABLE
              companies,
              officers,
              psc_persons,
              psc_persons_history,
              scores,
              ixbrl_documents,
              ixbrl_schema_refs,
              ixbrl_contexts,
              ixbrl_context_dimensions,
              ixbrl_units,
              ixbrl_unit_measures,
              ixbrl_facts,
              financial_metric_dictionary,
              financial_metric_series,
              ingest_watermarks,
              ingest_artifacts,
              ingest_job_state
            TO api_readonly;
            GRANT SELECT ON TABLE
              psc,
              lists,
              list_items
            TO api_readonly;
          END IF;
        END
        $$;
        """
    )


def _grant_tenant_rw() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_rw_tenant') THEN
            GRANT USAGE ON SCHEMA public TO api_rw_tenant;
            GRANT SELECT ON TABLE
              companies,
              financial_metric_series,
              financial_metric_dictionary
            TO api_rw_tenant;
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
              workspace_lists,
              workspace_list_items
            TO api_rw_tenant;
            GRANT USAGE, SELECT ON SEQUENCE workspace_lists_id_seq TO api_rw_tenant;
          END IF;
        END
        $$;
        """
    )


def upgrade() -> None:
    _create_roles_if_possible()
    _grant_readonly()
    _grant_tenant_rw()


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_rw_tenant') THEN
            REVOKE ALL ON TABLE workspace_list_items FROM api_rw_tenant;
            REVOKE ALL ON TABLE workspace_lists FROM api_rw_tenant;
            REVOKE ALL ON SEQUENCE workspace_lists_id_seq FROM api_rw_tenant;
            REVOKE ALL ON TABLE financial_metric_series FROM api_rw_tenant;
            REVOKE ALL ON TABLE financial_metric_dictionary FROM api_rw_tenant;
            REVOKE ALL ON TABLE companies FROM api_rw_tenant;
            REVOKE USAGE ON SCHEMA public FROM api_rw_tenant;
          END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_readonly') THEN
            REVOKE ALL ON TABLE list_items FROM api_readonly;
            REVOKE ALL ON TABLE lists FROM api_readonly;
            REVOKE ALL ON TABLE psc FROM api_readonly;
            REVOKE ALL ON TABLE ingest_job_state FROM api_readonly;
            REVOKE ALL ON TABLE ingest_artifacts FROM api_readonly;
            REVOKE ALL ON TABLE ingest_watermarks FROM api_readonly;
            REVOKE ALL ON TABLE financial_metric_series FROM api_readonly;
            REVOKE ALL ON TABLE financial_metric_dictionary FROM api_readonly;
            REVOKE ALL ON TABLE ixbrl_facts FROM api_readonly;
            REVOKE ALL ON TABLE ixbrl_unit_measures FROM api_readonly;
            REVOKE ALL ON TABLE ixbrl_units FROM api_readonly;
            REVOKE ALL ON TABLE ixbrl_context_dimensions FROM api_readonly;
            REVOKE ALL ON TABLE ixbrl_contexts FROM api_readonly;
            REVOKE ALL ON TABLE ixbrl_schema_refs FROM api_readonly;
            REVOKE ALL ON TABLE ixbrl_documents FROM api_readonly;
            REVOKE ALL ON TABLE scores FROM api_readonly;
            REVOKE ALL ON TABLE psc_persons_history FROM api_readonly;
            REVOKE ALL ON TABLE psc_persons FROM api_readonly;
            REVOKE ALL ON TABLE officers FROM api_readonly;
            REVOKE ALL ON TABLE companies FROM api_readonly;
            REVOKE USAGE ON SCHEMA public FROM api_readonly;
          END IF;
        END
        $$;
        """
    )
