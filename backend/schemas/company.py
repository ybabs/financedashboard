from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field
from typing import List


class CompanySearchItem(BaseModel):
    company_number: str
    name: str
    status: str | None = None
    score: float = 0.0


class CompanySearchResponse(BaseModel):
    results: List[CompanySearchItem] = Field(default_factory=list)


class CompanyDetailResponse(BaseModel):
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


class PscPersonItem(BaseModel):
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


class PscListResponse(BaseModel):
    company_number: str
    items: list[PscPersonItem] = Field(default_factory=list)
