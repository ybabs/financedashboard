from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class WorkspaceList(Base):
    __tablename__ = "workspace_lists"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="workspace_lists_tenant_name_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class WorkspaceListItem(Base):
    __tablename__ = "workspace_list_items"

    list_id: Mapped[int] = mapped_column(
        ForeignKey("workspace_lists.id", ondelete="CASCADE"), primary_key=True
    )
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    company_number: Mapped[str] = mapped_column(
        ForeignKey("companies.company_number", ondelete="CASCADE"), primary_key=True
    )
    added_by: Mapped[str | None] = mapped_column(String, nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

