from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class FinancialMetricDictionary(Base):
    __tablename__ = "financial_metric_dictionary"
    __table_args__ = (
        UniqueConstraint("metric_key", "xbrl_tag_normalized", name="financial_metric_dictionary_metric_key_xbrl_tag_normalized_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    metric_key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    xbrl_tag_normalized: Mapped[str] = mapped_column(String, nullable=False, index=True)
    aggregation_method: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'avg'"))
    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("100"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

