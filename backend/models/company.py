from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, JSON, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base

class Company(Base):
    __tablename__ = "companies"

    company_number: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    sic_codes: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default=text("'{}'"))
    incorporation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    registered_address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    jurisdiction: Mapped[str | None] = mapped_column(String, nullable=True)
    last_accounts_made_up_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    account_type: Mapped[str | None] = mapped_column(String, nullable=True)
    turnover: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    net_assets: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    current_assets: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    creditors: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    cash: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
