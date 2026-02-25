# Database Contract v1 (Reconciliation Spec)

## Status
- Version: `v1`
- State: `locked`
- Locked on: `2026-02-25`
- Scope: shared Companies House data + tenant workspace data used by backend APIs.

## Purpose
This document reconciles schema drift between current ingestor definitions and backend expectations, and locks a single database contract for backend v1.

The canonical DDL is in:
- `backend/db/sql/0001_contract_v1.sql`

## Reconciliation Summary
Current definitions diverged in the following places:

1. `psc` vs `psc_persons`
- Decision: standardize on `psc_persons` as canonical table name.
- Compatibility: create read-only compatibility view `psc` mapped to `psc_persons`.

2. Minimal vs extended `companies` columns
- Decision: keep full extended `companies` contract including:
  `registered_address`, `jurisdiction`, `turnover`, `employees`, `net_assets`,
  `current_assets`, `creditors`, `cash`.

3. Missing stage/history/ingest metadata in one path
- Decision: keep all ingestion operational tables:
  `companies_stage`, `psc_persons_stage`, `psc_persons_history`,
  `ingest_watermarks`, `ingest_artifacts`, `ingest_job_state`.

4. Missing SaaS workspace tenancy in legacy list tables
- Decision: replace legacy `lists`/`list_items` with tenant-scoped:
  `workspace_lists`, `workspace_list_items`.
- Compatibility: retain `lists` and `list_items` as read-only views over the new tables.

## Canonical Table Set (v1)
1. Core entity data
- `companies`
- `officers`
- `psc_persons`
- `scores`

2. Ingestion and pipeline operations
- `companies_stage`
- `psc_persons_stage`
- `psc_persons_history`
- `ingest_watermarks`
- `ingest_artifacts`
- `ingest_job_state`

3. Financial raw model (iXBRL)
- `ixbrl_documents`
- `ixbrl_schema_refs`
- `ixbrl_contexts`
- `ixbrl_context_dimensions`
- `ixbrl_units`
- `ixbrl_unit_measures`
- `ixbrl_facts`

4. SaaS workspace (tenant data)
- `workspace_lists`
- `workspace_list_items`

## Security/Integrity Requirements Locked In v1
1. All user-owned workspace records are tenant-scoped (`tenant_id` required).
2. Row Level Security is enabled for:
- `workspace_lists`
- `workspace_list_items`
3. Session-scoped tenant context is required:
- `SET app.tenant_id = '<tenant-id>'` in API transaction/session context.
4. Compatibility views (`psc`, `lists`, `list_items`) are read-only and must not be write targets.
5. API queries must remain parameterized; no runtime SQL string interpolation from user input.

## Backward Compatibility Rules
1. Existing consumers of `psc` can continue reads via compatibility view.
2. Existing consumers of `lists` and `list_items` can continue read-only access.
3. New writes must target canonical tables only.
4. Any contract change after this lock requires:
- new migration file,
- `v1.x` schema change note,
- explicit backward-compatibility decision.

## Non-Goals for v1
1. No partitioning changes yet.
2. No new derived financial marts/materialized views in this contract file.
3. No auth-provider-specific user table coupling in database core schema.

