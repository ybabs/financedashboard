VENV ?= ./venv
ALEMBIC ?= $(VENV)/bin/alembic
PIP ?= $(VENV)/bin/pip

REV ?= -1
MSG ?= describe_change
REFRESH_ARGS ?=

.PHONY: db-install db-upgrade db-downgrade db-current db-history db-revision db-refresh-financials db-refresh-financials-safe
.PHONY: test-unit test-pytest test-install

db-install:
	$(PIP) install alembic sqlalchemy asyncpg pydantic-settings

db-upgrade:
	$(ALEMBIC) -c alembic.ini upgrade head

db-downgrade:
	$(ALEMBIC) -c alembic.ini downgrade $(REV)

db-current:
	$(ALEMBIC) -c alembic.ini current

db-history:
	$(ALEMBIC) -c alembic.ini history

db-revision:
	$(ALEMBIC) -c alembic.ini revision -m "$(MSG)"

db-refresh-financials:
	$(VENV)/bin/python scripts/refresh_financial_metric_series.py $(REFRESH_ARGS)

db-refresh-financials-safe:
	./scripts/refresh_financial_metric_series_safe.sh $(REFRESH_ARGS)

test-unit:
	$(VENV)/bin/python -m unittest discover -s tests -p "test_*.py" -v

test-install:
	$(PIP) install pytest httpx

test-pytest:
	$(VENV)/bin/python -m pytest -q tests
