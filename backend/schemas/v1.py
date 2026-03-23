from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class V1CompanySearchItem(BaseModel):
    company_number: str
    name: str
    status: str | None = None
    score: float = 0.0


class V1CompanySearchResponse(BaseModel):
    results: list[V1CompanySearchItem] = Field(default_factory=list)
    next_cursor: str | None = None


class V1GlobalCompanySearchItem(BaseModel):
    kind: Literal["company"] = "company"
    company_number: str
    name: str
    status: str | None = None
    score: float = 0.0


class V1GlobalPscSearchItem(BaseModel):
    kind: Literal["psc"] = "psc"
    psc_key: str
    company_number: str
    company_name: str
    company_status: str | None = None
    name: str
    psc_kind: str
    ceased: bool | None = None
    dob_year: int | None = None
    dob_month: int | None = None
    score: float = 0.0


class V1GlobalSearchResponse(BaseModel):
    companies: list[V1GlobalCompanySearchItem] = Field(default_factory=list)
    psc: list[V1GlobalPscSearchItem] = Field(default_factory=list)


class V1CompanyDetailResponse(BaseModel):
    company_number: str
    name: str
    status: str | None = None
    incorporation_date: date | None = None
    account_type: str | None = None
    last_accounts_made_up_to: date | None = None
    region: str | None = None
    turnover: Decimal | None = None
    employees: int | None = None
    net_assets: Decimal | None = None
    current_assets: Decimal | None = None
    creditors: Decimal | None = None
    cash: Decimal | None = None


class V1CompanyOverviewResponse(BaseModel):
    company_number: str
    name: str
    status: str | None = None
    account_type: str | None = None
    last_accounts_made_up_to: date | None = None
    turnover: Decimal | None = None
    employees: int | None = None
    net_assets: Decimal | None = None
    current_assets: Decimal | None = None
    creditors: Decimal | None = None
    cash: Decimal | None = None
    psc_count: int
    current_ratio: float | None = None
    updated_at: datetime


class V1FinancialSeriesPoint(BaseModel):
    period_date: date
    value: Decimal


class V1FinancialSeriesResponse(BaseModel):
    company_number: str
    metric: str
    points: list[V1FinancialSeriesPoint] = Field(default_factory=list)


class V1CompanyFilingItem(BaseModel):
    document_id: int
    company_number: str
    source_path: str
    doc_type: str
    parsed_at: datetime
    period_start: date | None = None
    period_end: date | None = None
    period_instant: date | None = None
    current_period_date: date | None = None


class V1CompanyFilingHistoryResponse(BaseModel):
    company_number: str
    items: list[V1CompanyFilingItem] = Field(default_factory=list)


class V1CompanyFilingMetricValue(BaseModel):
    metric_key: str
    value: Decimal
    period_date: date | None = None
    source_count: int = 0
    priority: int = 0


class V1CompanyFilingSnapshotResponse(BaseModel):
    company_number: str
    filing: V1CompanyFilingItem
    metrics: list[V1CompanyFilingMetricValue] = Field(default_factory=list)


class V1CompanyFilingCompareMetric(BaseModel):
    metric_key: str
    left_value: Decimal | None = None
    right_value: Decimal | None = None
    delta: Decimal | None = None
    delta_pct: float | None = None


class V1CompanyFilingCompareResponse(BaseModel):
    company_number: str
    left_filing: V1CompanyFilingItem
    right_filing: V1CompanyFilingItem
    metrics: list[V1CompanyFilingCompareMetric] = Field(default_factory=list)


class V1FinancialMetricDefinition(BaseModel):
    metric_key: str
    tags: list[str] = Field(default_factory=list)


class V1FinancialMetricCatalogResponse(BaseModel):
    items: list[V1FinancialMetricDefinition] = Field(default_factory=list)


class V1CompanyCompareSide(BaseModel):
    company_number: str
    name: str
    status: str | None = None
    region: str | None = None
    turnover: Decimal | None = None
    employees: int | None = None
    net_assets: Decimal | None = None
    current_assets: Decimal | None = None
    creditors: Decimal | None = None
    cash: Decimal | None = None
    psc_count: int
    current_ratio: float | None = None


class V1CompanyCompareResponse(BaseModel):
    left: V1CompanyCompareSide
    right: V1CompanyCompareSide


class V1PscItem(BaseModel):
    psc_key: str
    name: str
    kind: str
    natures_of_control: list[str] = Field(default_factory=list)
    nationality: str | None = None
    country_of_residence: str | None = None
    ceased: bool | None = None
    is_sanctioned: bool | None = None
    notified_on: date | None = None
    ceased_on: date | None = None
    dob_year: int | None = None
    dob_month: int | None = None
    description: str | None = None
    address: dict[str, Any] | None = None
    principal_office_address: dict[str, Any] | None = None
    identification: dict[str, Any] | None = None
    identity_verification: dict[str, Any] | None = None
    link_self: str | None = None
    link_statement: str | None = None
    updated_at: datetime | None = None


class V1PscListResponse(BaseModel):
    company_number: str
    items: list[V1PscItem] = Field(default_factory=list)


class V1PscRelationshipCompany(BaseModel):
    company_number: str
    company_name: str
    company_status: str | None = None
    is_seed: bool = False
    psc: V1PscItem


class V1PscRelationshipResponse(BaseModel):
    seed_company_number: str
    seed_company_name: str
    seed_company_status: str | None = None
    seed: V1PscItem
    linkable: bool
    match_basis: str | None = None
    link_issue: str | None = None
    linked_companies: list[V1PscRelationshipCompany] = Field(default_factory=list)


class V1ListCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class V1ListItemCreateRequest(BaseModel):
    company_number: str = Field(min_length=1, max_length=20)


class V1ListResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime


class V1ListCollectionResponse(BaseModel):
    items: list[V1ListResponse] = Field(default_factory=list)
    next_cursor: str | None = None


class V1ListItemResponse(BaseModel):
    list_id: int
    company_number: str
    added_at: datetime


class V1ListItemCollectionResponse(BaseModel):
    items: list[V1ListItemResponse] = Field(default_factory=list)
    next_cursor: str | None = None


class V1IngestJobHealth(BaseModel):
    job_name: str
    last_success_at: datetime | None = None
    last_error: str | None = None
    updated_at: datetime | None = None
    lag_seconds: float | None = None


class V1IngestArtifactSummary(BaseModel):
    success_count: int
    non_success_count: int
    last_finished_at: datetime | None = None


class V1IngestHealthResponse(BaseModel):
    status: str
    generated_at: datetime
    max_lag_seconds: float | None = None
    jobs: list[V1IngestJobHealth] = Field(default_factory=list)
    artifacts: V1IngestArtifactSummary
