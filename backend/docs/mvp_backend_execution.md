# Backend MVP Execution and Revisit List

Date locked: 2026-02-26

## Status update (2026-02-26)

Completed in code:
1. `26` JWT auth middleware (HS256 + issuer/audience/exp/nbf checks).
2. `27` Tenant binding to JWT claim with strict header match enforcement.
3. `28` MVP DB role split migration (`api_readonly`, `api_rw_tenant`) with grants.
4. `21` Financial read-model-first serving with raw fallback behind explicit config toggle.
5. `30` API guardrails (rate limit, request timeout middleware, request body size limits).
6. `31` Security headers middleware and stricter CORS method/header allowlist.
7. `35` Cursor pagination for v1 search/lists/list-items.

Quick local usage:
1. Generate token: `cd backend && make auth-dev-token TENANT=acme`
2. Call API with:
   - `Authorization: Bearer <token>`
   - Optional tenant header `X-Tenant-Id: acme` (must match token if provided)

## MVP scope to implement now

1. `26` JWT auth middleware
- Validate signature, issuer, audience, exp/nbf.
- Reject missing/invalid bearer token on protected routes.

2. `27` Multi-tenant authorization
- Bind tenant to JWT claim (for example `tenant_id`).
- Keep `X-Tenant-Id` only as a strict match check (or dev override), never as source of truth in production.

3. `28` DB role split (MVP version)
- `api_readonly`: read access to shared company/catalog/financial read models.
- `api_rw_tenant`: read/write only to tenant-owned workspace tables.
- Apply grants via migration/runbook.

4. `21` Read-model enforcement for financials
- Serve company financial series from `financial_metric_series`.
- Disable raw `ixbrl_facts` fallback in production mode.

5. `30` API guardrails
- Rate limiting.
- Request timeout.
- Request body size limits.

6. `31` Security headers and strict CORS
- Restrict origins to known frontend URLs.
- Add baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.).

7. `35` Pagination/cursors
- Add cursor-based pagination for:
- `GET /v1/companies/search`
- `GET /v1/lists`
- `GET /v1/lists/{id}/items`

8. Tests required for this MVP scope
- `pytest` + `httpx` route tests for auth failures/success.
- Tenant mismatch tests.
- Pagination contract tests.
- Guardrail tests (rate limit/timeouts where practical).

## Execution order

1. Auth + tenant binding (`26`, `27`).
2. DB role split (`28`).
3. Financial read-model enforcement (`21`).
4. API guardrails + CORS/headers (`30`, `31`).
5. Pagination updates (`35`).
6. Test pass and docs update.

## Revisit after MVP (next backlog)

1. `34` Redis caching for overview/compare hot reads.
2. `36` Idempotency keys for list mutations.
3. `37` OpenTelemetry traces + structured logs + SLO dashboards.
4. `41` Usage metering hooks for SaaS billing.
5. `42` Security tests + load tests.
6. `43` CI/CD gates + rollback and incident runbooks.
