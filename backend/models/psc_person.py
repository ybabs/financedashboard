from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class PscPerson(Base):
    __tablename__ = "psc_persons"

    company_number: Mapped[str] = mapped_column(String, primary_key=True)
    psc_key: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    natures_of_control: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'")
    )
    notified_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ceased_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ceased: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_sanctioned: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    nationality: Mapped[str | None] = mapped_column(String, nullable=True)
    country_of_residence: Mapped[str | None] = mapped_column(String, nullable=True)
    dob_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dob_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    principal_office_address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    identification: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    identity_verification: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    link_self: Mapped[str | None] = mapped_column(String, nullable=True)
    link_statement: Mapped[str | None] = mapped_column(String, nullable=True)
    etag: Mapped[str | None] = mapped_column(String, nullable=True)
    raw_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

