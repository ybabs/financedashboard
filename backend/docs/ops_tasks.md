# Ops Tasks Runbook

This runbook lists recurring backend operational tasks and the commands to run them safely.

## Financial Series Refresh

### Purpose
Refresh the `financial_metric_series` materialized view (normalized read model from immutable `ixbrl_facts`).

### Preferred command
```bash
cd /home/daniel/financial-terminal/backend
make db-refresh-financials-safe
```

### Modes
1. Concurrent (default, non-blocking reads):
```bash
make db-refresh-financials-safe
```
2. Non-concurrent (may be faster, blocks reads on the view):
```bash
make db-refresh-financials-safe REFRESH_ARGS=no-concurrent
```

### Recommended cadence
1. Trigger once after each successful `accounts_daily` ingest run.
2. Trigger after each `accounts_backfill` batch.
3. Keep a cron fallback every 30 minutes to reduce staleness risk.

## Cron Setup

Use the safe wrapper with built-in lock + logging.

### Every 30 minutes (concurrent refresh)
```cron
*/30 * * * * cd /home/daniel/financial-terminal/backend && ./scripts/refresh_financial_metric_series_safe.sh concurrent
```

### Optional nightly hard refresh (non-concurrent)
```cron
0 3 * * * cd /home/daniel/financial-terminal/backend && ./scripts/refresh_financial_metric_series_safe.sh no-concurrent
```

## Logs and Locking

By default:
1. Lock file: `/tmp/financial_metric_series.lock`
2. Log file: `/tmp/financial_metric_series.log`

You can override with env vars:
```bash
LOCK_FILE=/tmp/custom.lock LOG_FILE=/tmp/custom.log ./scripts/refresh_financial_metric_series_safe.sh
```

## Standard Task Checklist

1. Migrations
```bash
cd /home/daniel/financial-terminal/backend
make db-upgrade
```
2. Refresh normalized financial series
```bash
make db-refresh-financials-safe
```
3. Run tests
```bash
make test-pytest
```
4. Check API routes are up:
- `/v1/companies/search`
- `/v1/companies/{company_number}/financials/series`
- `/v1/financials/metrics`
- `/v1/system/ingest-health`

