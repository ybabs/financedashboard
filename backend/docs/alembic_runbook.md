# Alembic Runbook (v1)

## What was added
- Alembic config: `backend/alembic.ini`
- Alembic environment: `backend/alembic/env.py`
- First revision: `backend/alembic/versions/20260225_0001_contract_v1.py`
- Canonical SQL contract consumed by the revision:
  `backend/db/sql/0001_contract_v1.sql`

## Install dependencies (backend venv)
```bash
cd /home/daniel/financial-terminal/backend
./venv/bin/pip install alembic sqlalchemy asyncpg pydantic-settings
```

Or with Make:
```bash
cd /home/daniel/financial-terminal/backend
make db-install
```

## Apply migrations
```bash
cd /home/daniel/financial-terminal/backend
./venv/bin/alembic -c alembic.ini upgrade head
```

Or with Make:
```bash
cd /home/daniel/financial-terminal/backend
make db-upgrade
```

## Roll back one revision
```bash
cd /home/daniel/financial-terminal/backend
./venv/bin/alembic -c alembic.ini downgrade -1
```

Or with Make:
```bash
cd /home/daniel/financial-terminal/backend
make db-downgrade REV=-1
```

## Common one-liners
```bash
cd /home/daniel/financial-terminal/backend
make db-current
make db-history
make db-revision MSG="add_metric_dictionary_table"
```

## Notes
1. `DATABASE_URL` environment variable takes precedence over settings file defaults.
2. Revision `20260225_0001` executes the locked v1 SQL contract.
3. The downgrade is intended for non-production reset scenarios.
