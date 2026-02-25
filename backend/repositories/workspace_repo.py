from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tenant import apply_tenant_context
from models.workspace import WorkspaceList, WorkspaceListItem


class WorkspaceRepository:
    def __init__(self, session: AsyncSession, tenant_id: str):
        self._session = session
        self._tenant_id = tenant_id

    async def list_lists(self):
        await apply_tenant_context(self._session, self._tenant_id)
        stmt = (
            select(WorkspaceList)
            .where(WorkspaceList.tenant_id == self._tenant_id)
            .order_by(asc(WorkspaceList.name))
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def create_list(self, name: str, created_by: str | None = None):
        await apply_tenant_context(self._session, self._tenant_id)
        new_list = WorkspaceList(
            tenant_id=self._tenant_id,
            name=name.strip(),
            created_by=created_by,
        )
        self._session.add(new_list)
        await self._session.flush()
        return new_list

    async def add_company(self, list_id: int, company_number: str, added_by: str | None = None):
        await apply_tenant_context(self._session, self._tenant_id)
        item = WorkspaceListItem(
            list_id=list_id,
            tenant_id=self._tenant_id,
            company_number=company_number,
            added_by=added_by,
        )
        self._session.add(item)
        await self._session.flush()
        return item

    async def remove_company(self, list_id: int, company_number: str) -> bool:
        await apply_tenant_context(self._session, self._tenant_id)
        stmt = select(WorkspaceListItem).where(
            WorkspaceListItem.list_id == list_id,
            WorkspaceListItem.company_number == company_number,
            WorkspaceListItem.tenant_id == self._tenant_id,
        )
        result = await self._session.execute(stmt)
        item = result.scalar_one_or_none()
        if item is None:
            return False
        await self._session.delete(item)
        return True

    async def list_items(self, list_id: int):
        await apply_tenant_context(self._session, self._tenant_id)
        stmt = (
            select(WorkspaceListItem)
            .where(
                WorkspaceListItem.list_id == list_id,
                WorkspaceListItem.tenant_id == self._tenant_id,
            )
            .order_by(asc(WorkspaceListItem.added_at))
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

