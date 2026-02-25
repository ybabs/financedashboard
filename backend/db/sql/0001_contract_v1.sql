-- Canonical DB contract for backend/ingestor reconciliation.
-- Version: v1
-- Locked: 2026-02-25

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ----------------------------
-- Core companies data
-- ----------------------------
CREATE TABLE IF NOT EXISTS companies(
  company_number TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT,
  sic_codes TEXT[] NOT NULL DEFAULT '{}',
  incorporation_date DATE,
  registered_address JSONB,
  jurisdiction TEXT,
  last_accounts_made_up_to DATE,
  account_type TEXT,
  turnover NUMERIC,
  employees INTEGER,
  net_assets NUMERIC,
  current_assets NUMERIC,
  creditors NUMERIC,
  cash NUMERIC,
  region TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies_stage(
  LIKE companies INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS officers(
  id BIGSERIAL PRIMARY KEY,
  company_number TEXT NOT NULL REFERENCES companies(company_number) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  appointed_on DATE,
  resigned_on DATE,
  dob_year INT,
  is_active BOOLEAN GENERATED ALWAYS AS (resigned_on IS NULL) STORED
);

CREATE TABLE IF NOT EXISTS psc_persons(
  company_number TEXT NOT NULL REFERENCES companies(company_number) ON DELETE CASCADE,
  psc_key TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  natures_of_control TEXT[] NOT NULL DEFAULT '{}',
  notified_on DATE,
  ceased_on DATE,
  ceased BOOLEAN,
  is_sanctioned BOOLEAN,
  nationality TEXT,
  country_of_residence TEXT,
  dob_year INT,
  dob_month INT,
  description TEXT,
  address JSONB,
  principal_office_address JSONB,
  identification JSONB,
  identity_verification JSONB,
  link_self TEXT,
  link_statement TEXT,
  etag TEXT,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_number, psc_key)
);

CREATE TABLE IF NOT EXISTS psc_persons_stage(
  LIKE psc_persons INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS psc_persons_history(
  snapshot_date DATE NOT NULL,
  company_number TEXT NOT NULL,
  psc_key TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  natures_of_control TEXT[] NOT NULL DEFAULT '{}',
  notified_on DATE,
  ceased_on DATE,
  ceased BOOLEAN,
  is_sanctioned BOOLEAN,
  nationality TEXT,
  country_of_residence TEXT,
  dob_year INT,
  dob_month INT,
  description TEXT,
  address JSONB,
  principal_office_address JSONB,
  identification JSONB,
  identity_verification JSONB,
  link_self TEXT,
  link_statement TEXT,
  etag TEXT,
  raw_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, company_number, psc_key)
);

CREATE TABLE IF NOT EXISTS scores(
  company_number TEXT PRIMARY KEY REFERENCES companies(company_number) ON DELETE CASCADE,
  succession_score INT NOT NULL DEFAULT 0,
  health_score INT NOT NULL DEFAULT 0,
  overall_score INT GENERATED ALWAYS AS (
    LEAST(100, GREATEST(0, (succession_score + health_score) / 2))
  ) STORED,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------
-- Ingestion operational tables
-- ----------------------------
CREATE TABLE IF NOT EXISTS ingest_watermarks(
  source TEXT PRIMARY KEY,
  watermark TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_artifacts(
  source TEXT NOT NULL,
  logical_key TEXT NOT NULL,
  url TEXT NOT NULL,
  etag TEXT,
  content_length BIGINT,
  sha256 TEXT,
  status TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  stats_json JSONB,
  PRIMARY KEY (source, logical_key, url)
);

CREATE TABLE IF NOT EXISTS ingest_job_state(
  job_name TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ,
  last_cursor TEXT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------
-- iXBRL raw parsed model
-- ----------------------------
CREATE TABLE IF NOT EXISTS ixbrl_documents (
  id BIGSERIAL PRIMARY KEY,
  company_number TEXT,
  source_zip TEXT NOT NULL,
  source_path TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  parsed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ixbrl_schema_refs (
  document_id BIGINT REFERENCES ixbrl_documents(id) ON DELETE CASCADE,
  schema_ref TEXT NOT NULL,
  PRIMARY KEY (document_id, schema_ref)
);

CREATE TABLE IF NOT EXISTS ixbrl_contexts (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES ixbrl_documents(id) ON DELETE CASCADE,
  context_id TEXT NOT NULL,
  entity_scheme TEXT,
  entity_identifier TEXT,
  period_kind TEXT NOT NULL,
  period_instant DATE,
  period_start DATE,
  period_end DATE,
  UNIQUE (document_id, context_id)
);

CREATE TABLE IF NOT EXISTS ixbrl_context_dimensions (
  context_pk BIGINT REFERENCES ixbrl_contexts(id) ON DELETE CASCADE,
  dimension_raw TEXT NOT NULL,
  dimension_expanded TEXT,
  dimension_prefix TEXT,
  dimension_local TEXT,
  member_raw TEXT NOT NULL,
  member_expanded TEXT,
  member_prefix TEXT,
  member_local TEXT,
  PRIMARY KEY (context_pk, dimension_raw, member_raw)
);

CREATE TABLE IF NOT EXISTS ixbrl_units (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES ixbrl_documents(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  UNIQUE (document_id, unit_id)
);

CREATE TABLE IF NOT EXISTS ixbrl_unit_measures (
  unit_pk BIGINT REFERENCES ixbrl_units(id) ON DELETE CASCADE,
  measure_raw TEXT NOT NULL,
  measure_expanded TEXT,
  measure_prefix TEXT,
  measure_local TEXT,
  PRIMARY KEY (unit_pk, measure_raw)
);

CREATE TABLE IF NOT EXISTS ixbrl_facts (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES ixbrl_documents(id) ON DELETE CASCADE,
  fact_kind TEXT NOT NULL,
  name_raw TEXT NOT NULL,
  name_expanded TEXT,
  name_prefix TEXT,
  name_local TEXT,
  context_ref TEXT,
  unit_ref TEXT,
  scale TEXT,
  decimals TEXT,
  precision TEXT,
  format TEXT,
  fact_id TEXT,
  sign TEXT,
  value_text TEXT,
  numeric_value NUMERIC
);

-- ----------------------------
-- Tenant workspace model
-- ----------------------------
CREATE TABLE IF NOT EXISTS workspace_lists (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS workspace_list_items (
  list_id BIGINT NOT NULL REFERENCES workspace_lists(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  company_number TEXT NOT NULL REFERENCES companies(company_number) ON DELETE CASCADE,
  added_by TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, company_number)
);

-- Ensure child row tenant always matches parent list tenant.
CREATE OR REPLACE FUNCTION workspace_list_items_tenant_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_tenant TEXT;
BEGIN
  SELECT tenant_id INTO parent_tenant
  FROM workspace_lists
  WHERE id = NEW.list_id;

  IF parent_tenant IS NULL THEN
    RAISE EXCEPTION 'workspace list % does not exist', NEW.list_id;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM parent_tenant THEN
    RAISE EXCEPTION 'tenant_id mismatch: item tenant=% parent tenant=%', NEW.tenant_id, parent_tenant;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_list_items_tenant_guard ON workspace_list_items;
CREATE TRIGGER trg_workspace_list_items_tenant_guard
BEFORE INSERT OR UPDATE ON workspace_list_items
FOR EACH ROW EXECUTE FUNCTION workspace_list_items_tenant_guard();

-- ----------------------------
-- Compatibility views
-- ----------------------------
CREATE OR REPLACE VIEW psc AS
SELECT
  company_number,
  psc_key,
  name,
  kind,
  natures_of_control,
  notified_on,
  ceased_on,
  ceased,
  is_sanctioned,
  nationality,
  country_of_residence,
  dob_year,
  dob_month,
  description,
  address,
  principal_office_address,
  identification,
  identity_verification,
  link_self,
  link_statement,
  etag,
  raw_json,
  updated_at
FROM psc_persons;

CREATE OR REPLACE VIEW lists AS
SELECT
  id,
  name,
  created_at
FROM workspace_lists;

CREATE OR REPLACE VIEW list_items AS
SELECT
  list_id,
  company_number,
  added_at
FROM workspace_list_items;

-- ----------------------------
-- Indexes
-- ----------------------------
CREATE UNIQUE INDEX IF NOT EXISTS psc_company_key_ux ON psc_persons(company_number, psc_key);

CREATE INDEX IF NOT EXISTS companies_name_trgm ON companies USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS companies_sic_gin ON companies USING gin (sic_codes);
CREATE INDEX IF NOT EXISTS companies_region_ix ON companies(region);
CREATE INDEX IF NOT EXISTS scores_overall_ix ON scores(overall_score DESC);

CREATE INDEX IF NOT EXISTS psc_persons_company_ix ON psc_persons(company_number);
CREATE INDEX IF NOT EXISTS psc_persons_kind_ix ON psc_persons(kind);
CREATE INDEX IF NOT EXISTS psc_persons_nat_ctrl_gin ON psc_persons USING gin (natures_of_control);
CREATE INDEX IF NOT EXISTS psc_name_trgm ON psc_persons USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS psc_noc_gin ON psc_persons USING gin (natures_of_control);
CREATE INDEX IF NOT EXISTS psc_address_gin ON psc_persons USING gin (address);
CREATE INDEX IF NOT EXISTS psc_identification_gin ON psc_persons USING gin (identification);

CREATE INDEX IF NOT EXISTS ixbrl_documents_company_ix ON ixbrl_documents(company_number);
CREATE INDEX IF NOT EXISTS ixbrl_documents_source_path_ix ON ixbrl_documents(source_zip, source_path);
CREATE INDEX IF NOT EXISTS ixbrl_contexts_context_id_ix ON ixbrl_contexts(context_id);
CREATE INDEX IF NOT EXISTS ixbrl_facts_doc_ix ON ixbrl_facts(document_id);
CREATE INDEX IF NOT EXISTS ixbrl_facts_name_ix ON ixbrl_facts(name_raw);
CREATE INDEX IF NOT EXISTS ixbrl_facts_context_ix ON ixbrl_facts(context_ref);

CREATE INDEX IF NOT EXISTS workspace_lists_tenant_ix ON workspace_lists(tenant_id);
CREATE INDEX IF NOT EXISTS workspace_list_items_tenant_ix ON workspace_list_items(tenant_id);

-- ----------------------------
-- Row-level security
-- ----------------------------
ALTER TABLE workspace_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_lists_tenant_isolation ON workspace_lists;
CREATE POLICY workspace_lists_tenant_isolation
ON workspace_lists
USING (tenant_id = current_setting('app.tenant_id', true))
WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS workspace_list_items_tenant_isolation ON workspace_list_items;
CREATE POLICY workspace_list_items_tenant_isolation
ON workspace_list_items
USING (tenant_id = current_setting('app.tenant_id', true))
WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

COMMIT;
