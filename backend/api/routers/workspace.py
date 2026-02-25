from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies.tenant import get_tenant_id
from db.session import get_session
from repositories.workspace_repo import WorkspaceRepository
from schemas.workspace import (
    WorkspaceListCollectionResponse,
    WorkspaceListCreateRequest,
    WorkspaceListItemCollectionResponse,
    WorkspaceListItemCreateRequest,
    WorkspaceListItemResponse,
    WorkspaceListResponse,
)

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.get("/lists", response_model=WorkspaceListCollectionResponse)
async def get_lists(
    tenant_id: str = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
):
    repo = WorkspaceRepository(session=session, tenant_id=tenant_id)
    items = await repo.list_lists()
    return WorkspaceListCollectionResponse(
        items=[
            WorkspaceListResponse(
                id=item.id,
                name=item.name,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item in items
        ]
    )


@router.post("/lists", response_model=WorkspaceListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    payload: WorkspaceListCreateRequest,
    tenant_id: str = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
):
    list_name = payload.name.strip()
    if not list_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="List name cannot be blank")

    repo = WorkspaceRepository(session=session, tenant_id=tenant_id)
    try:
        item = await repo.create_list(name=list_name)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="List already exists for tenant",
        ) from exc

    return WorkspaceListResponse(
        id=item.id,
        name=item.name,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/lists/{list_id}/items", response_model=WorkspaceListItemCollectionResponse)
async def get_list_items(
    list_id: int,
    tenant_id: str = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
):
    repo = WorkspaceRepository(session=session, tenant_id=tenant_id)
    items = await repo.list_items(list_id=list_id)
    return WorkspaceListItemCollectionResponse(
        items=[
            WorkspaceListItemResponse(
                list_id=item.list_id,
                company_number=item.company_number,
                added_at=item.added_at,
            )
            for item in items
        ]
    )


@router.post(
    "/lists/{list_id}/items",
    response_model=WorkspaceListItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_list_item(
    list_id: int,
    payload: WorkspaceListItemCreateRequest,
    tenant_id: str = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
):
    company_number = payload.company_number.strip().upper()
    if not company_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company number cannot be blank",
        )

    repo = WorkspaceRepository(session=session, tenant_id=tenant_id)
    try:
        item = await repo.add_company(list_id=list_id, company_number=company_number)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        message = str(getattr(exc, "orig", exc)).lower()
        if "duplicate key" in message:
            detail = "List item already exists"
        elif "foreign key" in message:
            detail = "List or company not found"
        else:
            detail = "Could not add list item"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from exc

    return WorkspaceListItemResponse(
        list_id=item.list_id,
        company_number=item.company_number,
        added_at=item.added_at,
    )


@router.delete("/lists/{list_id}/items/{company_number}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list_item(
    list_id: int,
    company_number: str,
    tenant_id: str = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
):
    company_number = company_number.strip().upper()
    repo = WorkspaceRepository(session=session, tenant_id=tenant_id)
    deleted = await repo.remove_company(list_id=list_id, company_number=company_number)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List item not found")
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
